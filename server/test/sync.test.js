import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import WebSocket from 'ws';
import { createServer } from '../src/server.js';

let server, base;

before(async () => {
  server = createServer({ dbFile: ':memory:', log: {} });
  const port = await server.listen(0, '127.0.0.1');
  base = `127.0.0.1:${port}`;
});
after(() => server.close());

async function register(email) {
  const res = await fetch(`http://${base}/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: 'segredo123', name: 'Teste' }),
  });
  assert.equal(res.status, 201);
  return (await res.json()).token;
}

// Cliente mínimo que guarda todas as mensagens e permite esperar por uma específica.
function connect(token, deviceId, since = 0) {
  const ws = new WebSocket(`ws://${base}/sync`);
  const inbox = [];
  const waiters = [];
  ws.on('message', (raw) => {
    const msg = JSON.parse(raw);
    inbox.push(msg);
    for (const w of [...waiters]) if (w.match(msg)) { waiters.splice(waiters.indexOf(w), 1); w.resolve(msg); }
  });
  const next = (match, timeoutMs = 3000) => {
    const found = inbox.find(match);
    if (found) { inbox.splice(inbox.indexOf(found), 1); return Promise.resolve(found); }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timeout esperando mensagem')), timeoutMs);
      waiters.push({ match: (m) => { if (!match(m)) return false; clearTimeout(timer); inbox.splice(inbox.indexOf(m), 1); return true; }, resolve });
    });
  };
  const ready = new Promise((resolve) => ws.on('open', resolve)).then(() => {
    ws.send(JSON.stringify({ t: 'hello', token, deviceId, since }));
    return next((m) => m.t === 'synced');
  });
  return { ws, next, ready, push: (batch, ops) => ws.send(JSON.stringify({ t: 'push', batch, ops })) };
}

test('mudança de um dispositivo chega ao outro em tempo real', async () => {
  const token = await register('a@teste.com');
  const phone = connect(token, 'phone');
  const tablet = connect(token, 'tablet');
  await Promise.all([phone.ready, tablet.ready]);

  phone.push('b1', [{ col: 'tasks', id: 't1', data: { title: 'Academia', points: 10 }, updatedAt: 1000 }]);
  const ack = await phone.next((m) => m.t === 'ack' && m.batch === 'b1');
  assert.equal(ack.changes[0].id, 't1');

  const live = await tablet.next((m) => m.t === 'changes');
  assert.deepEqual(live.changes[0].data, { title: 'Academia', points: 10 });
  phone.ws.close();
  tablet.ws.close();
});

test('dispositivo offline recebe só o que perdeu ao reconectar', async () => {
  const token = await register('b@teste.com');
  const phone = connect(token, 'phone');
  const first = await phone.ready;
  phone.push('b1', [{ col: 'tasks', id: 'x', data: { title: 'Ler' }, updatedAt: 1 }]);
  const ack = await phone.next((m) => m.t === 'ack');
  const lastSeq = ack.changes[0].seq;
  assert.equal(first.seq, 0);

  const laptop = connect(token, 'laptop');
  await laptop.ready;
  laptop.push('b2', [{ col: 'tasks', id: 'y', data: { title: 'Correr' }, updatedAt: 2 }]);
  await laptop.next((m) => m.t === 'ack');
  phone.ws.close();

  const back = connect(token, 'phone', lastSeq);
  const catchUp = await back.next((m) => m.t === 'changes');
  assert.deepEqual(catchUp.changes.map((c) => c.id), ['y']);
  back.ws.close();
  laptop.ws.close();
});

test('conflito: a edição mais recente vence e o perdedor recebe a versão vencedora', async () => {
  const token = await register('c@teste.com');
  const a = connect(token, 'A');
  const b = connect(token, 'B');
  await Promise.all([a.ready, b.ready]);

  a.push('n', [{ col: 'settings', id: 'goals', data: { daily: [60] }, updatedAt: 2000 }]);
  await a.next((m) => m.t === 'ack');
  b.push('o', [{ col: 'settings', id: 'goals', data: { daily: [10] }, updatedAt: 1500 }]); // edição antiga, feita offline
  const ack = await b.next((m) => m.t === 'ack');
  assert.deepEqual(ack.changes[0].data, { daily: [60] });
  a.ws.close();
  b.ws.close();
});

test('dados de um usuário não vazam para outro', async () => {
  const t1 = await register('d@teste.com');
  const t2 = await register('e@teste.com');
  const u1 = connect(t1, 'p');
  const u2 = connect(t2, 'p');
  await Promise.all([u1.ready, u2.ready]);
  u1.push('z', [{ col: 'tasks', id: 'secreta', data: { title: 'privada' }, updatedAt: 1 }]);
  await u1.next((m) => m.t === 'ack');
  await assert.rejects(u2.next((m) => m.t === 'changes', 500));
  u1.ws.close();
  u2.ws.close();
});

test('token inválido é recusado', async () => {
  const bad = connect('token-falso', 'p');
  bad.ready.catch(() => {}); // nunca chega 'synced' para um token inválido
  const err = await bad.next((m) => m.t === 'error');
  assert.equal(err.code, 'unauthorized');
  const closed = await new Promise((resolve) => bad.ws.on('close', (code) => resolve(code)));
  assert.equal(closed, 4003);
});

test('operação inválida é recusada sem gravar nada', async () => {
  const token = await register('f@teste.com');
  const c = connect(token, 'p');
  await c.ready;
  c.push('bad', [{ col: 'hack', id: '1', data: {}, updatedAt: 1 }]);
  const err = await c.next((m) => m.t === 'error');
  assert.equal(err.code, 'invalid_op');
  assert.equal(err.batch, 'bad');
  c.ws.close();
});
