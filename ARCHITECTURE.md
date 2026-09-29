# Architecture

The system is designed around one rule: **the local host owns persistent shared
state; the browser is only a client.**

```
Client (browser)                     Host server
───────────────                      ───────────────────────────
React UI                            Next.js (custom server, port 3000)
  │  GET /api/content ────────────►  API routes
  │  POST /api/content ──────────►   │
  │  PATCH /api/content/:id ─────►   │      server/store.mjs (SQL)
  │  DELETE /api/content/:id ────►   │            │
  │  POST /api/files/upload ─────►   │            ▼
  │                                   │     PostgreSQL (Docker)   
  │                                   │            │  metadata
  │  WebSocket /ws ──────────────►   │   WebSocket hub ──► filesystem
  │        ◄── events ───────────────┤            │  real files
```

## Roles (the simple mental model)

| Layer       | Question it answers          | Implementation                        |
| ----------- | ---------------------------- | ------------------------------------- |
| Database    | "What exists?"               | PostgreSQL inside Docker (metadata)   |
| File store  | "Where is the actual file?"  | Host filesystem under `storage/`      |
| API         | "Can I create/change/delete?"| Next.js route handlers                |
| WebSocket   | "Who needs to know?"         | `ws` hub on the same host port        |
| Browser     | "How do I display it?"       | React UI, targeted updates            |

## Data flow for every write

```
Client  →  API  →  PostgreSQL + filesystem  →  success  →  WebSocket broadcast  →  all clients
```

WebSocket is **never** treated as storage. A deleted item is a tombstone
(`deleted_at`) in PostgreSQL; on reconnect the client re-fetches authoritative
state, so deleted content can never resurrect from a stale browser cache.

## WebSocket vs. polling

The browser connects to `/ws` once. The server sends a full `SYNC` snapshot on
`HELLO`, then incremental events (`CONTENT_CREATED/UPDATED/DELETED`,
`FOLDER_*`, `FILE_*`, `DEVICE_*`). The UI applies targeted updates — no
full-page reloads. Search/filter/sort run locally against the in-memory copy
that mirrors the server state; the initial fetch always comes from the server.

## Concurrency

Each content row has `version`, `updated_at`, `updated_by_device`.
`PATCH /api/content/:id` requires the client's `version`; PostgreSQL performs
`UPDATE ... WHERE version = ?`. A mismatch returns `409` and the client shows a
conflict banner instead of silently losing someone's edit. This is optimistic
concurrency control (OCC) — CRDT/Yjs are deliberately deferred to future
versions (see MASTERPROMPT §16).

## Deployment model

The host runs one process on one port serving **UI + API + WebSocket**:
- `server.mjs` boots Next.js, mounts it on an HTTP server, and attaches the
  WebSocket hub to the same server at `/ws`.
- PostgreSQL runs as a separate Docker container (user-requested replacement
  for SQLite), reached over `localhost:5432`.

## Persistence guarantees

| Scenario                              | Guarantee                                              |
| ------------------------------------- | ------------------------------------------------------ |
| Browser refresh                       | Data re-fetched from PostgreSQL                        |
| Browser close                         | Nothing stored in the browser persists shared state    |
| Uploader disconnects                  | File bytes already on host filesystem                  |
| Server restart                        | Data in PostgreSQL + filesystem                        |
| Deleted item                          | Tombstoned; never resurrects                          |