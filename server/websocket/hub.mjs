// Real-time synchronization hub.
// WebSocket = "tell everyone the data changed", NOT persistent storage.
import { WebSocket, WebSocketServer } from "ws";
import { getSharedState } from "../store.mjs";

let wss = null;
const clients = new Map(); // ws -> { id, deviceName, registered }

export function attachWs(server) {
  wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws, req) => {
    const state = {
      id: null,
      deviceName: "Device",
      registered: false,
      alive: true,
    };
    clients.set(ws, state);

    ws.isAlive = true;
    ws.on("pong", () => {
      ws.isAlive = true;
    });

    ws.on("message", async (raw) => {
      try {
        const msg = JSON.parse(raw.toString());

        if (msg.type === "HELLO") {
          state.id = String(msg.device_id || "unknown");
          state.deviceName = String(msg.device_name || "Device");
          state.registered = true;
          const snapshot = await getSharedState();
          send(ws, {
            type: "SYNC",
            data: snapshot,
          });
          broadcast({
            type: "DEVICE_CONNECTED",
            device: {
              id: state.id,
              display_name: state.deviceName,
              last_seen: new Date().toISOString(),
            },
          });
        } else if (msg.type === "PING") {
          send(ws, { type: "PONG", t: msg.t });
        }
      } catch (err) {
        // Malformed client message — ignore, never trust it as a write.
        console.error("[ws] bad message", err);
      }
    });

    ws.on("close", () => {
      clients.delete(ws);
      if (state.registered) {
        broadcast({
          type: "DEVICE_DISCONNECTED",
          device: { id: state.id, display_name: state.deviceName },
        });
      }
    });

    ws.on("error", () => {
      clients.delete(ws);
    });
  });

  const interval = setInterval(() => {
    for (const ws of clients.keys()) {
      if (ws.isAlive === false) {
        ws.terminate();
        clients.delete(ws);
        continue;
      }
      ws.isAlive = false;
      try {
        ws.ping();
      } catch {
        /* socket gone */
      }
    }
  }, 30000);
  wss.on("close", () => clearInterval(interval));

  return wss;
}

export function broadcast(event) {
  if (!wss) return;
  const payload = JSON.stringify({ ...event, ts: new Date().toISOString() });
  for (const ws of clients.keys()) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  }
}

function send(ws, event) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ ...event, ts: new Date().toISOString() }));
  }
}

export function clientCount() {
  return clients.size;
}