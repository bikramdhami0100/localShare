# WebSocket Protocol

Endpoint: `ws://<host>:3000/ws` (or `wss://` when behind TLS).

The socket is for **notifying** clients that stored state changed. It is not a
storage system — after every reconnect the client re-reads the authoritative
snapshot, so nothing depends on the socket to "remember" data.

## Handshake / initial sync

1. Client connects to `/ws`.
2. Client sends `HELLO` with its device identity:
   ```json
   { "type": "HELLO", "device_id": "device_abc123", "device_name": "Laptop" }
   ```
3. Server replies with the full current state:
   ```json
   { "type": "SYNC", "data": { "content": [...], "folders": [...], "devices": [...] } }
   ```
4. From then on the client applies incremental events.

Every event payload ends with `"ts"` (server time).

## Events

| Event                 | Payload highlights                                              | Action on clients          |
| --------------------- | --------------------------------------------------------------- | -------------------------- |
| `SYNC`                | `data { content[], folders[], devices[] }`                      | replace state              |
| `CONTENT_CREATED`     | `id`, `item`                                                    | upsert item                |
| `CONTENT_UPDATED`     | `id`, `item`, `version`                                         | upsert item + notice       |
| `CONTENT_DELETED`     | `id`                                                            | remove item                |
| `FILE_CREATED`        | `id`, `item`, `file_id`                                         | upsert item                |
| `FILE_DELETED`        | `id`                                                            | clear item.file            |
| `FOLDER_CREATED`      | `folder`                                                        | upsert folder              |
| `FOLDER_UPDATED`      | `folder`                                                        | upsert folder              |
| `FOLDER_DELETED`      | `id`                                                            | remove folder              |
| `DEVICE_CONNECTED`    | `device { id, display_name, last_seen }`                        | upsert device + notice     |
| `DEVICE_DISCONNECTED` | `device { id, display_name }`                                   | mark last_seen             |
| `PONG`                | echoes `t` from client `PING` (`{ "type":"PING","t":… }`)       | keepalive                  |

Example:
```json
{ "type": "CONTENT_UPDATED", "id": "content_123", "version": 4,
  "item": { "...": "..." }, "ts": "2026-09-21T09:00:00.000Z" }
```

## Reliability

- **Server-side heartbeats**: the hub pings clients every 30 s and terminates
  dead sockets.
- **Client reconnect**: on close the client shows `Reconnecting…`/`Offline`
  and retries every 2.5 s. On `open` it resends `HELLO` and gets a fresh
  `SYNC`, restoring the current authoritative state — including deletes
  (tombstones), so deleted items never resurrect.
- **Ordering**: HTTP writes are applied to PostgreSQL first; only on success is
  the WebSocket event broadcast. A write that failed on the server is never
  advertised as a success to other clients.
- Malformed client messages are ignored; the hub never trusts a client message
  as a write.

## Conflict handling

Edits carry the `version` the client last saw. Attempting to edit a stale row
returns `409`; the UI shows an inline "another device updated this item"
banner on the card and keeps the authoritative version.

## Server-side of the socket

- `server.mjs` attaches `WebSocketServer({ path: "/ws" })` to the same HTTP
  server that serves the Next.js app.
- `server/websocket/hub.mjs` owns connection lifecycle and `broadcast()`.
- API routes call `lib/broadcast.ts` → `broadcastEvent(...)`, which forwards to
  the hub via `globalThis.__LOCALSHARE_HUB` (same process).