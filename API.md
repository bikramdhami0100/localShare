# API

Base URL: `http://<host>:3000`. JSON in/out. Errors return
`{ "error": "message" }` with a fitting status code.

Every write endpoint identifies the caller's **device** via `device_id`
(a cookie is not used; it is sent in the body/headers). This is an audit
handle, not authentication.

## Content

### `GET /api/content`
List content. Query params:
- `q` — full-text ILIKE search over title/body
- `type` — `text` | `link` | `file`
- `folder_id` — items inside a folder
- `sort` — `newest` (default) | `oldest` | `updated` | `title`
- `since` — return items with `version >= n`

```json
{ "items": [{ "id":"content_…", "type":"text", "title":"…", "body":"…",
              "url":null, "folder_id":null, "version":3, "created_at":"…",
              "updated_at":"…", "file": null }] }
```

### `POST /api/content`
Body: `{ "device_id": "...", "type": "text|link", "title?", "body?", "url?",
"folder_id?" }` for text/link. Returns `201 { "item": … }`.

### `GET /api/content/:id`
Returns `{ "item": … }` or 404.

### `PATCH /api/content/:id`
Body: `{ "device_id", "version", "title"?|"body"?|"url"?|"folder_id"? }`.
Optimistic concurrency: `version` must match the stored one or the update is
rejected with `409`. Returns the bumped item.

### `DELETE /api/content/:id`
Soft-deletes (tombstone, never reappears). Returns `{ "ok": true }`.

## Files

### `POST /api/files/upload`
Raw binary body (not multipart) — the file bytes. Headers:
- `x-file-name` — original filename (display only)
- `x-file-mime` — mime type
- `x-file-size` — byte length
- `x-device-id` — device id

The file streams to disk (large-file friendly), a sha256 is computed and stored,
a `file` content item is created. Returns `201 { "file", "item", "checksum" }`.
Exceeding `MAX_UPLOAD_BYTES` returns `413`.

### `GET /api/files/:id`
Streams the stored file with safe headers. Supports range-less downloads;
always `Content-Disposition: attachment` with `nosniff`.

### `DELETE /api/files/:id`
Removes the file record + disk bytes, and soft-deletes its linked content item.

## Folders

### `GET /api/folders`
```json
{ "folders": [{ "id":"folder_…", "name":"Documents", "parent_id":null }] }
```

### `POST /api/folders`
Body: `{ "device_id", "name", "parent_id"? }`.

### `PATCH /api/folders/:id`
Body: `{ "device_id", "name" }`.

### `DELETE /api/folders/:id`
Deletes the folder; content inside is un-grouped (never deleted or lost).

## Device

### `PUT /api/device`
Body: `{ "device_id", "display_name", "metadata"? }`. Upserts the device
record and broadcasts `DEVICE_CONNECTED`.

## Health

### `GET /api/health`
```json
{ "status": "ok", "db": "connected", "ws_clients": 2, "time": "…" }
```

Status codes you will meet: `400` validation, `404` missing, `409` version
conflict / already deleted, `413` payload too large, `500` persistence
failure (never "saved ok" when it wasn't).