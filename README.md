# LocalShare — Local Wi-Fi / LAN Shared Content Platform

Open it → Share it → Everyone nearby sees it.

LocalShare is a local-first shared space for people on the same Wi‑Fi / LAN. No
accounts, no signup, no cloud. Anyone on the network can open the app, add
notes, links and files, and see updates from every other device in real time.

```
                     SAME WIFI / LAN

       ┌────────────┐         ┌────────────┐
       │  Laptop A  │         │   Phone B  │
       └─────┬──────┘         └──────┬─────┘
             └──────────┬───────────┘
                        │
                        ▼
             ┌──────────────────────┐
             │     LOCAL HOST        │
             │   Next.js / API       │
             │   WebSocket           │
             │   PostgreSQL (Docker) │
             │   Local File Storage  │
             └──────────┬───────────┘
                  ┌─────┴──────┐
                  ▼            ▼
             PostgreSQL    Filesystem
             Metadata      Actual Files
```

## Highlights

- **No login.** Devices join the shared space directly.
- **Persistent by design.** Content lives in PostgreSQL (Docker) + the host
  filesystem. It survives refresh, browser close, uploader disconnect and
  server restart.
- **Real‑time.** WebSocket pushes create/update/delete events to every
  connected device. WebSocket **tells** people about changes; the database
  **remembers** them.
- **Content types.** Text notes, links, file uploads (any type) and folders.
- **Concurrent editing.** Optimistic concurrency with `version` — a stale edit
  is rejected with `409` instead of silently overwriting someone.
- **Safe by default.** Input validation, path-traversal protection, MIME
  control, safe file serving, honest LAN warning.
- **PostgreSQL** runs inside Docker (the user-requested replacement for the
  SQLite shown in the original spec).

## Quick start

Requirements: Node.js ≥ 20, Docker with Compose.

```bash
# 1. start PostgreSQL inside Docker
npm run db:up        # docker compose up -d --wait

# 2. apply schema (also done automatically on first boot)
npm run db:migrate

# 3. configure environment (already works out of the box)
cp .env.example .env

# 4. run the server (Next.js + WebSocket + API on one port)
npm install
npm run dev          # http://localhost:3000
```

Other devices on the same LAN open `http://<host-ip>:3000` (find the host IP
with `ip addr` / `hostname -I`; see `DEPLOYMENT.md`).

Production:

```bash
npm run build && npm start
```

## Project structure

```
localShare/
├── app/                  # Next.js App Router pages + API routes
│   ├── page.tsx          #  the shared space home screen
│   └── api/              #  content, files, folders, device, health
├── components/           # UI (cards, add/edit modals, toolbar, status)
├── hooks/                # useDevice, useSharedSpace (state + WS)
├── lib/                  # validation, api helpers, broadcast bridge
├── server/
│   ├── pool.mjs          # PostgreSQL pool
│   ├── store.mjs         # ALL SQL (single source of truth)
│   ├── storage/files.ts  # safe filesystem storage
│   └── websocket/hub.mjs # real-time event hub
├── database/
│   ├── schema.sql        # canonical schema
│   ├── migrate.mjs       # applies schema
│   └── init/             # first-boot init script (Docker)
├── storage/shared-files/ # uploaded files (host filesystem)
├── types/                # shared TypeScript types
└── tests/                # Node test-runner acceptance tests
```

## License / status

V1 — see `ARCHITECTURE.md`, `API.md`, `DATABASE.md`, `WEBSOCKET.md`,
`DEPLOYMENT.md`, `TESTING.md`, `SECURITY.md` for details.