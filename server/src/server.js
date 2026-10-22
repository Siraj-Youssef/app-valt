// HTTP (contas) + WebSocket (sincronização em tempo real) no mesmo processo e porta.
//
// Protocolo do WebSocket /sync (JSON, um objeto por mensagem):
//   cliente -> servidor
//     { t: 'hello', token, deviceId, since }      autentica e pede tudo com seq > since
//     { t: 'push', batch, ops: [ {col,id,data,updatedAt,deleted} ] }
//     { t: 'ping' }
//   servidor -> cliente
//     { t: 'welcome', user }                      autenticado
//     { t: 'changes', changes: [...] }            mudanças (catch-up ou de outro dispositivo)
//     { t: 'synced', seq }                        fim do catch-up
//     { t: 'ack', batch, changes: [...] }         lote aplicado; changes = versão vencedora de cada registro
//     { t: 'error', code, message }
//     { t: 'pong' }
import { createServer as createHttpServer } from 'node:http';
import { WebSocketServer } from 'ws';
import { openDb, COLLECTIONS } from './db.js';
import { createAuth, AuthError } from './auth.js';

const MAX_OPS_PER_BATCH = 500;
const MAX_RECORD_BYTES = 16 * 1024;
const HELLO_TIMEOUT_MS = 10_000;
const HEARTBEAT_MS = 30_000;

export function createServer({ dbFile = ':memory:', log = console } = {}) {
  const db = openDb(dbFile);
  const auth = createAuth(db);
  const sockets = new Map(); // userId -> Set<WebSocket>

  const http = createHttpServer((req, res) => handleHttp(req, res).catch((err) => {
    log.error?.(err);
    sendJson(res, 500, { error: 'internal', message: 'Erro interno' });
  }));

  async function handleHttp(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'content-type, authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    if (req.method === 'OPTIONS') return void res.writeHead(204).end();

    const url = new URL(req.url, 'http://localhost');
    try {
      if (req.method === 'GET' && url.pathname === '/health') {
        return sendJson(res, 200, { ok: true, clients: [...sockets.values()].reduce((n, s) => n + s.size, 0) });
      }
      if (req.method === 'POST' && url.pathname === '/auth/register') {
        return sendJson(res, 201, auth.register(await readJson(req)));
      }
      if (req.method === 'POST' && url.pathname === '/auth/login') {
        return sendJson(res, 200, auth.login(await readJson(req)));
      }
      if (req.method === 'POST' && url.pathname === '/auth/logout') {
        auth.logout(bearer(req));
        return sendJson(res, 200, { ok: true });
      }
      if (req.method === 'GET' && url.pathname === '/auth/me') {
        const user = auth.userForToken(bearer(req));
        if (!user) return sendJson(res, 401, { error: 'unauthorized', message: 'Sessão inválida' });
        return sendJson(res, 200, { user: auth.publicUser(user) });
      }
      sendJson(res, 404, { error: 'not_found' });
    } catch (err) {
      if (err instanceof AuthError) return sendJson(res, err.status, { error: err.code, message: err.message });
      if (err instanceof SyntaxError) return sendJson(res, 400, { error: 'bad_json', message: 'JSON inválido' });
      throw err;
    }
  }

  const wss = new WebSocketServer({ server: http, path: '/sync', maxPayload: 2 * 1024 * 1024 });

  wss.on('connection', (ws) => {
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });
    const helloTimer = setTimeout(() => ws.close(4001, 'hello timeout'), HELLO_TIMEOUT_MS);

    ws.on('message', (raw) => {
      let msg;
      try { msg = JSON.parse(raw.toString()); } catch { return sendError(ws, 'bad_json', 'Mensagem inválida'); }
      ws.isAlive = true;

      if (msg.t === 'ping') return send(ws, { t: 'pong' });

      if (!ws.userId) {
        if (msg.t !== 'hello') return sendError(ws, 'not_authenticated', 'Envie hello primeiro');
        const user = auth.userForToken(msg.token);
        if (!user) {
          sendError(ws, 'unauthorized', 'Sessão inválida');
          return ws.close(4003, 'unauthorized');
        }
        clearTimeout(helloTimer);
        ws.userId = user.id;
        ws.deviceId = String(msg.deviceId || 'unknown').slice(0, 64);
        send(ws, { t: 'welcome', user: auth.publicUser(user) });

        // Catch-up e registro do socket acontecem no mesmo tick: nenhuma mudança se perde no meio.
        let since = Number.isFinite(msg.since) ? msg.since : 0;
        for (;;) {
          const page = db.changesSince(user.id, since);
          if (page.length === 0) break;
          send(ws, { t: 'changes', changes: page });
          since = page[page.length - 1].seq;
        }
        send(ws, { t: 'synced', seq: since });
        if (!sockets.has(user.id)) sockets.set(user.id, new Set());
        sockets.get(user.id).add(ws);
        return;
      }

      if (msg.t === 'push') return handlePush(ws, msg);
      sendError(ws, 'unknown_type', `Tipo desconhecido: ${msg.t}`);
    });

    ws.on('close', () => {
      clearTimeout(helloTimer);
      const set = ws.userId && sockets.get(ws.userId);
      if (set) {
        set.delete(ws);
        if (set.size === 0) sockets.delete(ws.userId);
      }
    });
    ws.on('error', (err) => log.warn?.('ws error', err.message));
  });

  function handlePush(ws, msg) {
    const ops = Array.isArray(msg.ops) ? msg.ops : [];
    if (ops.length > MAX_OPS_PER_BATCH) return sendError(ws, 'batch_too_large', `Máximo de ${MAX_OPS_PER_BATCH} operações por lote`, msg.batch);
    const problem = ops.map(validateOp).find(Boolean);
    if (problem) return sendError(ws, 'invalid_op', problem, msg.batch);

    const { accepted, rejected } = db.applyOps(ws.userId, ws.deviceId, ops);
    send(ws, { t: 'ack', batch: msg.batch, changes: [...accepted, ...rejected] });
    if (accepted.length === 0) return;
    for (const other of sockets.get(ws.userId) ?? []) {
      if (other !== ws) send(other, { t: 'changes', changes: accepted });
    }
  }

  // Derruba conexões mortas (rede caiu sem FIN, celular dormiu etc.).
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.isAlive) { ws.terminate(); continue; }
      ws.isAlive = false;
      ws.ping();
    }
  }, HEARTBEAT_MS);
  heartbeat.unref();

  return {
    http,
    listen(port, host = '0.0.0.0') {
      return new Promise((resolve) => http.listen(port, host, () => resolve(http.address().port)));
    },
    async close() {
      clearInterval(heartbeat);
      for (const ws of wss.clients) ws.terminate();
      await new Promise((resolve) => wss.close(() => http.close(() => resolve())));
      db.raw.close();
    },
  };
}

function validateOp(op) {
  if (!op || typeof op !== 'object') return 'Operação inválida';
  if (!COLLECTIONS.has(op.col)) return `Coleção desconhecida: ${op.col}`;
  if (typeof op.id !== 'string' || !op.id || op.id.length > 128) return 'id inválido';
  if (!Number.isFinite(op.updatedAt)) return 'updatedAt inválido';
  if (!op.deleted) {
    if (!op.data || typeof op.data !== 'object' || Array.isArray(op.data)) return 'data deve ser um objeto';
    if (JSON.stringify(op.data).length > MAX_RECORD_BYTES) return 'Registro grande demais';
  }
  return null;
}

function send(ws, msg) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

function sendError(ws, code, message, batch) {
  send(ws, { t: 'error', code, message, batch });
}

function bearer(req) {
  const h = req.headers.authorization ?? '';
  return h.startsWith('Bearer ') ? h.slice(7) : null;
}

async function readJson(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 64 * 1024) throw new SyntaxError('body too large');
  }
  return body ? JSON.parse(body) : {};
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}
