// Persistência em SQLite (módulo nativo node:sqlite, sem dependência externa).
// Cada registro sincronizado é um documento JSON identificado por (usuário, coleção, id).
// A ordem das mudanças de cada usuário é dada por um contador monotônico (seq).
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export const COLLECTIONS = new Set(['tasks', 'completions', 'settings', 'goals', 'goalLogs']);

export function openDb(file) {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS users (
      id          TEXT PRIMARY KEY,
      email       TEXT NOT NULL UNIQUE,
      name        TEXT NOT NULL,
      pass_hash   TEXT NOT NULL,
      seq         INTEGER NOT NULL DEFAULT 0,
      created_at  INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash  TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at  INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS records (
      user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      col         TEXT NOT NULL,
      id          TEXT NOT NULL,
      data        TEXT,
      updated_at  INTEGER NOT NULL,
      device_id   TEXT NOT NULL,
      deleted     INTEGER NOT NULL DEFAULT 0,
      seq         INTEGER NOT NULL,
      PRIMARY KEY (user_id, col, id)
    );
    CREATE INDEX IF NOT EXISTS records_by_seq ON records(user_id, seq);
  `);

  const q = {
    insertUser: db.prepare('INSERT INTO users (id, email, name, pass_hash, created_at) VALUES (?, ?, ?, ?, ?)'),
    userByEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
    userById: db.prepare('SELECT id, email, name, seq, created_at FROM users WHERE id = ?'),
    insertSession: db.prepare('INSERT INTO sessions (token_hash, user_id, created_at) VALUES (?, ?, ?)'),
    sessionUser: db.prepare('SELECT user_id FROM sessions WHERE token_hash = ?'),
    deleteSession: db.prepare('DELETE FROM sessions WHERE token_hash = ?'),
    nextSeq: db.prepare('UPDATE users SET seq = seq + 1 WHERE id = ? RETURNING seq'),
    getRecord: db.prepare('SELECT * FROM records WHERE user_id = ? AND col = ? AND id = ?'),
    upsertRecord: db.prepare(`
      INSERT INTO records (user_id, col, id, data, updated_at, device_id, deleted, seq)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (user_id, col, id) DO UPDATE SET
        data = excluded.data, updated_at = excluded.updated_at, device_id = excluded.device_id,
        deleted = excluded.deleted, seq = excluded.seq`),
    changesSince: db.prepare('SELECT * FROM records WHERE user_id = ? AND seq > ? ORDER BY seq LIMIT ?'),
  };

  return {
    raw: db,
    createUser(user) {
      q.insertUser.run(user.id, user.email, user.name, user.passHash, Date.now());
    },
    userByEmail: (email) => q.userByEmail.get(email),
    userById: (id) => q.userById.get(id),
    createSession: (tokenHash, userId) => q.insertSession.run(tokenHash, userId, Date.now()),
    sessionUser: (tokenHash) => q.sessionUser.get(tokenHash)?.user_id ?? null,
    deleteSession: (tokenHash) => q.deleteSession.run(tokenHash),

    // Aplica um lote de operações com "last writer wins" por registro.
    // Retorna os registros aceitos (para difundir) e o estado atual dos rejeitados
    // (para o dispositivo que enviou convergir para a versão vencedora).
    applyOps(userId, deviceId, ops) {
      const accepted = [];
      const rejected = [];
      db.exec('BEGIN');
      try {
        for (const op of ops) {
          const current = q.getRecord.get(userId, op.col, op.id);
          if (current && !wins(op.updatedAt, deviceId, current.updated_at, current.device_id)) {
            rejected.push(toChange(current));
            continue;
          }
          const { seq } = q.nextSeq.get(userId);
          const data = op.deleted ? null : JSON.stringify(op.data ?? {});
          q.upsertRecord.run(userId, op.col, op.id, data, op.updatedAt, deviceId, op.deleted ? 1 : 0, seq);
          accepted.push({ col: op.col, id: op.id, data: op.deleted ? null : op.data, updatedAt: op.updatedAt, deviceId, deleted: !!op.deleted, seq });
        }
        db.exec('COMMIT');
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
      return { accepted, rejected };
    },

    changesSince(userId, since, limit = 1000) {
      return q.changesSince.all(userId, since, limit).map(toChange);
    },
  };
}

// Desempate determinístico: maior timestamp vence; em empate, maior deviceId.
function wins(tsA, devA, tsB, devB) {
  return tsA > tsB || (tsA === tsB && devA > devB);
}

function toChange(row) {
  return {
    col: row.col,
    id: row.id,
    data: row.data ? JSON.parse(row.data) : null,
    updatedAt: row.updated_at,
    deviceId: row.device_id,
    deleted: !!row.deleted,
    seq: row.seq,
  };
}
