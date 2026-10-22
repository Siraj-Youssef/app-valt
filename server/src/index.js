import { networkInterfaces } from 'node:os';
import { createServer } from './server.js';

const port = Number(process.env.PORT ?? 8787);
const dbFile = process.env.DB_FILE ?? './data/rumo.db';

const server = createServer({ dbFile });
const actual = await server.listen(port);

console.log(`Rumo sync server ouvindo na porta ${actual} (banco: ${dbFile})`);
for (const addrs of Object.values(networkInterfaces())) {
  for (const a of addrs ?? []) {
    if (a.family === 'IPv4' && !a.internal) console.log(`  no celular use: http://${a.address}:${actual}`);
  }
}

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, async () => {
    await server.close();
    process.exit(0);
  });
}
