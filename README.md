# Rope Pull Arena

A real-time multiplayer math tug-of-war game. Two players join the same room,
race to solve each question, and pull the rope toward their team. The first
player to earn **10 correct answers** wins.

## Run locally

Requires Node.js 20 or newer.

```bash
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000). Enter a name and room code,
then send the room link to another player. The second player can join from a
different browser or device on the same reachable server.

## How a match works

1. Enter a display name and a room code. Leaving the room blank creates one.
2. Share the URL using the link button in the header.
3. The first two visitors become the Cobalt and Crimson players. Additional
   visitors can watch the live match.
4. Both players receive the same question at the same time.
5. The first correct answer wins the round and pulls the rope one point.
6. A wrong answer uses that player's attempt for the round, giving their rival
   a chance to answer.
7. The first player to 10 points wins. Either player can start a rematch.

Questions begin with addition and subtraction, then introduce multiplication
and division as a match becomes more competitive.

## Networking

The Node server hosts the static game and an authoritative WebSocket server on
the same port. Answers are checked on the server, not trusted from the browser.
Rooms are held in memory, include spectators, and are removed after everyone
leaves. WebSocket heartbeat checks remove dead connections, and the browser
uses capped exponential-backoff reconnection.

Because multiplayer requires a continuously running WebSocket server, this game
**cannot be hosted on GitHub Pages alone**. GitHub Pages only serves static
files. Deploy the repository to a Node-compatible host such as Render, Railway,
Fly.io, or a VPS, then use its public URL.

### Deployment settings

- Build command: `npm ci`
- Start command: `npm start`
- Health check: `/healthz`
- Open port: the server binds to all interfaces, uses the host-provided `PORT`
  environment variable, and falls back to `3000` locally.
- Persistent storage: not required for the current in-memory room model.

## Project structure

- `server.js` — static HTTP server, room manager, game rules, and WebSockets.
- `public/index.html` — game and lobby interface.
- `public/styles.css` — responsive arena artwork and animation.
- `public/game.js` — WebSocket client, state rendering, and interactions.
