const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const test = require('node:test');
const { WebSocket } = require('ws');

const PORT = 31000 + Math.floor(Math.random() * 1000);
const ORIGIN = `http://127.0.0.1:${PORT}`;
let server;

async function waitUntilReady() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`${ORIGIN}/healthz`);
      if (response.ok) return;
    } catch {
      // The child may still be binding its socket.
    }
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error('Server did not become ready');
}

test.before(async () => {
  server = spawn(process.execPath, ['server.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(PORT) },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  await waitUntilReady();
});

test.after(async () => {
  if (!server || server.exitCode !== null) return;
  server.kill('SIGTERM');
  await once(server, 'exit');
});

test('serves the application and health check', async () => {
  const health = await fetch(`${ORIGIN}/healthz`);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { status: 'ok' });

  const page = await fetch(`${ORIGIN}/`);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Rope Pull Arena/);

  const head = await fetch(`${ORIGIN}/styles.css`, { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
});

test('rejects unsafe paths and unsupported methods', async () => {
  const traversal = await fetch(`${ORIGIN}/..%2fserver.js`);
  assert.equal(traversal.status, 403);

  const post = await fetch(`${ORIGIN}/`, { method: 'POST' });
  assert.equal(post.status, 405);
  assert.equal(post.headers.get('allow'), 'GET, HEAD');
});

test('accepts WebSocket players and broadcasts room state', async () => {
  const first = new WebSocket(`ws://127.0.0.1:${PORT}`);
  const second = new WebSocket(`ws://127.0.0.1:${PORT}`);
  await Promise.all([once(first, 'open'), once(second, 'open')]);

  const joined = new Promise((resolve, reject) => {
    first.on('message', raw => {
      const message = JSON.parse(raw);
      if (message.type === 'state' && message.players.every(Boolean)) resolve(message);
    });
    first.once('error', reject);
  });
  first.send(JSON.stringify({ type: 'join', name: 'One', room: 'TEST' }));
  second.send(JSON.stringify({ type: 'join', name: 'Two', room: 'TEST' }));

  const state = await joined;
  assert.deepEqual(state.players.map(player => player.name), ['One', 'Two']);
  first.close();
  second.close();
});
