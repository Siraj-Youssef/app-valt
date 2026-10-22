// Contas por e-mail e senha (scrypt) e tokens de sessão opacos.
// No banco fica só o hash SHA-256 do token, nunca o token em si.
import { randomBytes, randomUUID, scryptSync, timingSafeEqual, createHash } from 'node:crypto';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class AuthError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt:${salt.toString('base64')}:${hash.toString('base64')}`;
}

export function verifyPassword(password, stored) {
  const [, saltB64, hashB64] = stored.split(':');
  const expected = Buffer.from(hashB64, 'base64');
  const actual = scryptSync(password, Buffer.from(saltB64, 'base64'), expected.length);
  return timingSafeEqual(expected, actual);
}

export const hashToken = (token) => createHash('sha256').update(token).digest('hex');

export function createAuth(db) {
  function issueToken(userId) {
    const token = randomBytes(32).toString('base64url');
    db.createSession(hashToken(token), userId);
    return token;
  }

  function publicUser(u) {
    return { id: u.id, email: u.email, name: u.name };
  }

  return {
    register({ email, password, name }) {
      email = String(email ?? '').trim().toLowerCase();
      name = String(name ?? '').trim();
      password = String(password ?? '');
      if (!EMAIL_RE.test(email)) throw new AuthError(400, 'invalid_email', 'E-mail inválido');
      if (password.length < 6) throw new AuthError(400, 'weak_password', 'A senha precisa de pelo menos 6 caracteres');
      if (!name) name = email.split('@')[0];
      if (db.userByEmail(email)) throw new AuthError(409, 'email_taken', 'Já existe uma conta com esse e-mail');
      const user = { id: randomUUID(), email, name: name.slice(0, 60), passHash: hashPassword(password) };
      db.createUser(user);
      return { token: issueToken(user.id), user: publicUser(user) };
    },

    login({ email, password }) {
      const user = db.userByEmail(String(email ?? '').trim().toLowerCase());
      if (!user || !verifyPassword(String(password ?? ''), user.pass_hash)) {
        throw new AuthError(401, 'bad_credentials', 'E-mail ou senha incorretos');
      }
      return { token: issueToken(user.id), user: publicUser(user) };
    },

    userForToken(token) {
      if (typeof token !== 'string' || !token) return null;
      const userId = db.sessionUser(hashToken(token));
      return userId ? db.userById(userId) : null;
    },

    logout(token) {
      if (typeof token === 'string' && token) db.deleteSession(hashToken(token));
    },

    publicUser,
  };
}
