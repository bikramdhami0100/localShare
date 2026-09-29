# Deployment — Local Host

Stack it on anything that stays on the LAN: a laptop, mini‑PC, office server,
or Raspberry Pi 4/5. The host is infrastructure — it is not modelled as an
"application user".

## One process, everything in it

`npm start` boots a single custom Next.js server on `0.0.0.0:3000` that serves:

- the web app,
- the REST API,
- the WebSocket hub (`/ws`),

and a separate Docker container provides PostgreSQL.

### Options / Docker for the whole thing (recommended for a shared host)

`docker-compose.yml` also runs the Postgres container. To containerize the app
process too, add:

```yaml
  app:
    build: .
    ports: ["3000:3000"]
    environment:
      DATABASE_URL: postgresql://localshare:localshare@postgres:5432/localshare
      STORAGE_DIR: /data/files
    volumes:
      - ./storage/shared-files:/data/files
    depends_on:
      postgres:
        condition: service_healthy
```

with a `Dockerfile` like:

```dockerfile
FROM node:20-slim
WORKDIR /srv
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

(For a dockerized app the schema auto-applies on first Postgres boot; you can
also run `npm run db:migrate` in the app container.)

## LAN access

The host must be reachable from other devices:

1. Confirm the host IP:
   ```bash
   hostname -I      # e.g. 192.168.1.50
   ```
2. Devices on the same Wi‑Fi/LAN open:
   ```
   http://192.168.1.50:3000
   ```
3. Open the firewall port if needed:
   ```bash
   # Linux (ufw)
   sudo ufw allow 3000/tcp
   # daemon exposes Postgres on 5432 for the app; do NOT open 5432 to the LAN
   ```

Do **not** open port 5432 to other machines unless you understand the risk.

## Environment

`.env` (see `.env.example`):

| Variable          | Meaning                                     | Default                       |
| ----------------- | ------------------------------------------- | ----------------------------- |
| `HOST`            | bind address                                | `0.0.0.0`                     |
| `PORT`            | listen port                                 | `3000`                        |
| `DATABASE_URL`    | PostgreSQL connection string                | localhost localshare:…        |
| `STORAGE_DIR`     | where uploaded files live                   | `./storage/shared-files`      |
| `MAX_UPLOAD_BYTES`| per-file upload limit                       | `2147483648` (2 GB)           |

## Lifecycle & data

| Command          | Effect                                   |
| ---------------- | ---------------------------------------- |
| `npm run dev`    | dev server + WebSocket                   |
| `npm run build`  | production build                         |
| `npm start`      | production server + WebSocket            |
| `npm run db:up`  | start PostgreSQL (Docker)                |
| `npm run db:down`| stop PostgreSQL (data volume kept)       |
| `npm run db:migrate` | apply schema (idempotent)            |
| `npm run db:reset` | wipe DB volume, recreate, migrate     |

The shared space survives app restarts (PostgreSQL + filesystem persist).

## Backup / restore

See `DATABASE.md`. Backup = `pg_dump` of metadata + a copy of
`storage/shared-files/` together.

## Notes

- No internet is required for core sharing.
- Anyone with network access to the shared space can view/edit/delete its
  contents. This is by design and is printed in the UI. If you need isolation,
  put the host on a separate VLAN or add the optional shared-space password in
  a future version.