// Custom production/dev server for LocalShare.
// Runs the Next.js app AND the WebSocket hub in the same process/port so the
// whole shared space lives on one LAN address (e.g. http://192.168.1.50:3000).
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import next from "next";
import { attachWs, broadcast } from "./server/websocket/hub.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const hostname = process.env.HOST || "0.0.0.0";
const port = Number(process.env.PORT || 3000);
const dev = process.env.NODE_ENV !== "production";

const app = next({ dev, hostname, port, dir: __dirname });
const handle = app.getRequestHandler();

(async () => {
  await app.prepare();

  const server = createServer((req, res) => handle(req, res));

  // Share the WebSocket hub with API routes via a global bridge.
  attachWs(server);
  globalThis.__LOCALSHARE_HUB = { broadcast };

  server.listen(port, hostname, () => {
    console.log(`[localShare] Shared space running at http://${hostname}:${port}`);
    console.log(`[localShare] WebSocket at ws://${hostname}:${port}/ws`);
  });
})().catch((err) => {
  console.error("[localShare] failed to start", err);
  process.exit(1);
});