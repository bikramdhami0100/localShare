# Database

PostgreSQL 16 runs inside Docker (replacing the SQLite shown in the original
spec). The database is the **authoritative source of truth** for all shared
metadata. All SQL lives in one file: `server/store.mjs`, against the schema in
`database/schema.sql`.

## Running it

```bash
npm run db:up          # docker compose up -d --wait  (Postgres + healthcheck)
npm run db:migrate     # apply database/schema.sql (idempotent)
npm run db:reset       # wipe volume + recreate + migrate
```

The first boot also seeds the schema automatically via
`database/init/01_schema.sql` (only on an empty volume).

Connection (default, from `.env` / code):
`postgresql://localshare:localshare@localhost:5432/localshare`

## Schema

```
devices   ( id, display_name, metadata jsonb, last_seen, created_at )
files     ( id, original_name, stored_name, mime_type, size,
            checksum, storage_path, uploaded_by_device, metadata, created_at )
folders   ( id, name, parent_id→folders, created_by_device, timestamps, deleted_at )
content   ( id, type text|link|file, title, body, url, file_id→files,
            folder_id→folders, version, created_by_device, updated_by_device,
            timestamps, deleted_at )
```

### content
- `version` increments on every update; used for optimistic concurrency
  (`UPDATE … WHERE id=$1 AND version=$2`).
- `deleted_at` is a **tombstone** — deletes are soft. Queries always filter
  `deleted_at IS NULL`. Rows are never resurrected by stale clients.
- `type` is `CHECK`-constrained.
- `file_id` optionally links a `file`-type row to its file record.

### files
- `stored_name` is **server-generated** (never the user's filename) and is the
  on-disk relative path under `storage/shared-files/`.
- `checksum` is sha256 of the bytes, computed while streaming.

### folders
- Delete = tombstone; content rows in the folder get `folder_id = NULL`
  (they are un-grouped, not deleted).

### IDs
Server-generated UUIDs prefixed by kind: `content_<uuid>`, `file_<uuid>`,
`folder_<uuid>`, `device_<hex>`.

## Backup / restore

The whole shared space is two things: **PostgreSQL** (metadata) and the
**`storage/shared-files/`** directory (bytes). Back them up together:

```bash
# metadata: dump from the container
docker compose exec -T postgres pg_dump -U localshare localshare > backup.sql

# files: copy the directory (or snapshot the bind mount/volume)
cp -r storage/shared-files backup-files/
```

Restore:

```bash
docker compose exec -T postgres psql -U localshare localshare < backup.sql
# and copy backup-files/* back into storage/shared-files/
```

Backup is optional for basic operation — the volume is the primary copy.