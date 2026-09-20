# Rope Pull Arena

A real-time multiplayer math tug-of-war game. Two players join the same room,
race to solve each question, and pull the rope toward their team. The first
player to earn **10 correct answers** wins.

## Play from two phones using a GitHub link

GitHub Pages cannot run this game's WebSocket server, and a `localhost` address
on your Honor Magic device is visible only to that device. The simplest
GitHub-based option is a **Codespace**: GitHub runs the server and gives you a
temporary HTTPS link that both phones can open.

On the host phone:

1. Open this repository on GitHub in Chrome, enable **Desktop site** if GitHub
   hides the **Code** button, then choose **Code → Codespaces → Create
   codespace on main**.
2. Wait for setup to finish. The included dev-container configuration installs
   the server dependency automatically.
3. Open the Codespaces terminal and run:

   ```bash
   npm start
   ```

4. Open the **Ports** panel, find port `3000`, and change **Port Visibility** to
   **Public**. Never make unrelated development ports public.
5. Use **Open in Browser** for port 3000. In the game, enter your name, leave
   the room blank to create a room, and tap the link icon in the header.
6. Send that copied `https://…app.github.dev/?room=…` link to your friend. They
   can open it in Chrome on their Honor Magic 3, enter their name, and join.

Keep the Codespace and its `npm start` terminal running while you play. Stop the
server with `Ctrl+C` and stop/delete the Codespace afterward so it does not use
additional Codespaces hours. If an organization policy prevents making the port
public, use the same-Wi-Fi option below or deploy the Node app to a public host.

### Same Wi-Fi without Codespaces

You can also run the Node server in an Android terminal environment. Start it
with `npm install && npm start`, find the host phone's Wi-Fi/LAN IP address, and
have the other phone open `http://HOST-LAN-IP:3000`. Both devices must be on the
same Wi-Fi network, and Android or the router must not block connections to port
3000. A GitHub Pages link cannot replace this server because Pages only hosts
static files.

## Run locally

Requires Node.js 20 or newer.

```bash
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000). Enter a name and room code,
then send the room link to another player. The second player can join from a
different browser or device on the same reachable server.

### One-command Docker host

If Docker Desktop or Docker Engine is installed, no local Node.js setup is
needed:

```bash
docker compose up --build
```

Open [http://localhost:3000](http://localhost:3000). To let another device on
your home network join, share `http://YOUR-LAN-IP:3000` and allow port 3000
through your firewall. Stop the server with `Ctrl+C`, then run
`docker compose down` to remove the container.

### Build it in GitHub Actions, then host it locally

The **Build local-host image** workflow creates a ready-to-run Docker image:

1. Open the repository's **Actions** tab.
2. Select **Build local-host image**, choose **Run workflow**, and wait for it
   to finish.
3. Download the `rope-pull-arena-…` artifact from the completed workflow and
   extract `rope-pull-arena.tar.gz`.
4. Run the downloaded image locally:

   ```bash
   docker load --input rope-pull-arena.tar.gz
   docker run --rm --publish 3000:3000 rope-pull-arena:local
   ```

   Then visit [http://localhost:3000](http://localhost:3000).

The workflow also starts the container and checks its home page before making
the downloadable artifact, so a broken image will not be published.

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

- Build command: `npm install`
- Start command: `npm start`
- Health/open port: the server uses the host-provided `PORT` environment
  variable and falls back to `3000` locally.
- Persistent storage: not required for the current in-memory room model.

## Project structure

- `server.js` — static HTTP server, room manager, game rules, and WebSockets.
- `.devcontainer/devcontainer.json` — phone-friendly GitHub Codespaces setup.
- `compose.yaml` — one-command local Docker host.
- `.github/workflows/local-host-image.yml` — tested, downloadable Docker image build.
- `public/index.html` — game and lobby interface.
- `public/styles.css` — responsive arena artwork and animation.
- `public/game.js` — WebSocket client, state rendering, and interactions.
