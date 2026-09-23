const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer, WebSocket } = require('ws');

const parsedPort = Number.parseInt(process.env.PORT || '3000', 10);
const PORT = Number.isInteger(parsedPort) && parsedPort >= 0 && parsedPort <= 65535 ? parsedPort : 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const WIN_SCORE = 10;
const rooms = new Map();

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml'
};

const server = http.createServer((request, response) => {
  let requested;
  try {
    requested = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  } catch {
    response.writeHead(400).end('Bad request');
    return;
  }

  if (requested === '/healthz') {
    response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end('Method not allowed');
    return;
  }

  requested = requested === '/' ? 'index.html' : requested.replace(/^\/+/, '');
  const filePath = path.resolve(PUBLIC_DIR, requested);

  if (filePath !== PUBLIC_DIR && !filePath.startsWith(`${PUBLIC_DIR}${path.sep}`)) {
    response.writeHead(403).end('Forbidden');
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(404).end('Not found');
      return;
    }
    response.writeHead(200, { 'Content-Type': mimeTypes[path.extname(filePath)] || 'application/octet-stream' });
    response.end(request.method === 'HEAD' ? undefined : data);
  });
});

const wss = new WebSocketServer({ server });

function safeName(value) {
  const name = String(value || 'Player').replace(/[^a-zA-Z0-9 _-]/g, '').trim();
  return name.slice(0, 16) || 'Player';
}

function safeRoom(value) {
  return String(value || 'QUICK').toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 12) || 'QUICK';
}

function makeQuestion(level) {
  let left;
  let right;
  let answer;
  let text;
  const mode = Math.floor(Math.random() * (level < 4 ? 2 : level < 8 ? 3 : 4));

  if (mode === 0) {
    left = Math.floor(Math.random() * 35) + 8;
    right = Math.floor(Math.random() * 35) + 6;
    answer = left + right;
    text = `${left} + ${right}`;
  } else if (mode === 1) {
    answer = Math.floor(Math.random() * 32) + 7;
    right = Math.floor(Math.random() * 25) + 5;
    left = answer + right;
    text = `${left} − ${right}`;
  } else if (mode === 2) {
    left = Math.floor(Math.random() * 10) + 3;
    right = Math.floor(Math.random() * 9) + 2;
    answer = left * right;
    text = `${left} × ${right}`;
  } else {
    right = Math.floor(Math.random() * 8) + 2;
    answer = Math.floor(Math.random() * 10) + 2;
    left = right * answer;
    text = `${left} ÷ ${right}`;
  }

  return { text, answer };
}

function createRoom(id) {
  const room = {
    id,
    clients: new Set(),
    players: [null, null],
    score: [0, 0],
    round: 0,
    question: null,
    questionStarted: 0,
    phase: 'waiting',
    nextTimer: null
  };
  rooms.set(id, room);
  return room;
}

function send(socket, payload) {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload));
}

function snapshot(room) {
  return {
    type: 'state',
    room: room.id,
    phase: room.phase,
    score: room.score,
    winScore: WIN_SCORE,
    round: room.round,
    players: room.players.map(player => player ? { name: player.name, side: player.side } : null),
    spectators: Math.max(0, room.clients.size - room.players.filter(Boolean).length),
    question: room.question ? room.question.text : null,
    questionStarted: room.questionStarted
  };
}

function broadcast(room, payload) {
  const message = JSON.stringify(payload);
  room.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) client.send(message);
  });
}

function broadcastState(room) {
  broadcast(room, snapshot(room));
}

function beginRound(room, delay = 900) {
  clearTimeout(room.nextTimer);
  room.phase = 'between';
  room.question = null;
  broadcastState(room);
  room.nextTimer = setTimeout(() => {
    if (!room.players[0] || !room.players[1]) return;
    room.round += 1;
    room.question = makeQuestion(Math.max(...room.score));
    room.questionStarted = Date.now();
    room.phase = 'playing';
    room.players.forEach(player => { player.answeredRound = 0; });
    broadcastState(room);
  }, delay);
}

function joinRoom(socket, data) {
  const roomId = safeRoom(data.room);
  const room = rooms.get(roomId) || createRoom(roomId);
  socket.room = room;
  socket.name = safeName(data.name);
  room.clients.add(socket);

  const openSide = room.players.findIndex(player => !player);
  if (openSide !== -1) {
    socket.side = openSide;
    socket.answeredRound = 0;
    room.players[openSide] = socket;
  } else {
    socket.side = -1;
  }

  send(socket, { type: 'joined', side: socket.side, room: roomId });
  broadcast(room, { type: 'notice', message: socket.side < 0 ? `${socket.name} is watching` : `${socket.name} joined Team ${socket.side ? 'Crimson' : 'Cobalt'}!` });
  broadcastState(room);
  if (room.players[0] && room.players[1] && room.phase === 'waiting') beginRound(room, 1200);
}

function answerQuestion(socket, data) {
  const room = socket.room;
  if (!room || socket.side < 0 || room.phase !== 'playing' || socket.answeredRound === room.round) return;

  const answer = Number(data.answer);
  if (!Number.isFinite(answer)) return;
  socket.answeredRound = room.round;

  if (answer !== room.question.answer) {
    send(socket, { type: 'answer', correct: false });
    broadcast(room, { type: 'miss', side: socket.side, name: socket.name });
    if (room.players.every(player => player && player.answeredRound === room.round)) {
      broadcast(room, { type: 'notice', message: `Nobody got it — the answer was ${room.question.answer}` });
      beginRound(room, 1100);
    }
    return;
  }

  const responseTime = Date.now() - room.questionStarted;
  room.phase = 'between';
  room.score[socket.side] += 1;
  broadcast(room, { type: 'point', side: socket.side, name: socket.name, responseTime, score: room.score });

  if (room.score[socket.side] >= WIN_SCORE) {
    room.phase = 'finished';
    room.question = null;
    broadcast(room, { type: 'winner', side: socket.side, name: socket.name, score: room.score });
    broadcastState(room);
  } else {
    beginRound(room);
  }
}

function restart(socket) {
  const room = socket.room;
  if (!room || socket.side < 0 || room.phase !== 'finished') return;
  room.score = [0, 0];
  room.round = 0;
  broadcast(room, { type: 'notice', message: `${socket.name} started a rematch!` });
  beginRound(room, 1200);
}

wss.on('connection', socket => {
  socket.isAlive = true;
  socket.on('pong', () => { socket.isAlive = true; });
  socket.on('message', raw => {
    if (raw.length > 512) return;
    let data;
    try { data = JSON.parse(raw); } catch { return; }
    if (data.type === 'join' && !socket.room) joinRoom(socket, data);
    if (data.type === 'answer') answerQuestion(socket, data);
    if (data.type === 'restart') restart(socket);
  });
  socket.on('close', () => {
    const room = socket.room;
    if (!room) return;
    room.clients.delete(socket);
    if (socket.side >= 0 && room.players[socket.side] === socket) room.players[socket.side] = null;
    clearTimeout(room.nextTimer);
    room.phase = 'waiting';
    room.question = null;
    broadcast(room, { type: 'notice', message: `${socket.name} left the arena` });
    broadcastState(room);
    if (!room.clients.size) rooms.delete(room.id);
  });
});

server.on('error', error => {
  console.error(`Unable to start Rope Pull Arena: ${error.message}`);
  process.exitCode = 1;
});

server.listen(PORT, '0.0.0.0', () => console.log(`Rope Pull Arena is running on port ${server.address().port}`));

function shutdown() {
  clearInterval(heartbeat);
  rooms.forEach(room => clearTimeout(room.nextTimer));
  wss.clients.forEach(socket => socket.close(1001, 'Server shutting down'));
  server.close(error => {
    if (error) {
      console.error(`Error while shutting down: ${error.message}`);
      process.exitCode = 1;
    }
  });
}

const heartbeat = setInterval(() => {
  wss.clients.forEach(socket => {
    if (!socket.isAlive) return socket.terminate();
    socket.isAlive = false;
    socket.ping();
  });
}, 30000);

process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
