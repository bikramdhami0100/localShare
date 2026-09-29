# Security

LocalShare is designed for trusted LANs, **not** to be internet-facing without
a tunnel. There is no login by design, so the shared space is only as secure as
the network it runs on.

> **Honest warning (shown in the UI):** "This shared space is accessible to
> devices on the local network. Anyone with network access may view, edit, or
> delete this content."
>
> Do not put this host on an untrusted network without protection (e.g. a VPN
> or a reverse proxy with authentication). The app never claims to be
> "private", "secure" or "encrypted" — because it is not.

## What is implemented

### Input validation (`lib/validation.ts`)
- Text/title/length limits; body ≤ 100k, title ≤ 300 chars.
- URLs must be `http/https` with a real host.
- Filenames are sanitized: path separators stripped, control chars removed.
- MIME strings validated against a safe charset.
- Device/folder/content ids restricted to `[A-Za-z0-9_-]{1,80}`.

### File security (`server/storage/files.ts`)
- **Never** uses the user's filename as a filesystem path; a server-generated
  name is used (`storage/shared-files/xx/yy/<uuid>.bin`).
- Every path resolution re-verifies containment inside the storage root
  (path-traversal / absolute-path resistance).
- Uploads stream to a temp file, size-capped (`MAX_UPLOAD_BYTES`, default
   2 GB; excess → `413` and cleanup), sha256 computed, then atomically renamed
  into place.
- On persistence failure the temporary/partial bytes are removed — no orphan
  junk on disk.

### Safe file serving (`app/api/files/[id]/route.ts`)
- `X-Content-Type-Options: nosniff`
- `Content-Disposition: attachment` with a sanitized filename (forces download
  rather than inline script execution).
- Response `Content-Type` uses the DB mime, but see the note below on inline
  risk — attachment mode plus `nosniff` is the controlling safeguard.

### API security
- Requests validated on every write; nothing walks to the filesystem or DB
  before validation.
- CORS: same-origin only by default (the app and API share one origin).
- Rate limiting: `http`-level per-IP limiting is *not* shipped in V1
  (single-LAN hosts rarely need it, and a naive limiter can break legitimate
  multi-device beats). It is easy to add behind the proxy in DEPLOYMENT.md —
  front with `nginx` `limit_req` if you expose this beyond the LAN.
- No CSRF tokens are needed beyond same-origin + JSON: all state-changing
  requests are same-origin (same port) with JSON/XHR; cross-site forms cannot
  set the `Content-Type: application/json` header we require for writes, so
  classic CSRF vectors are neutralized. If you ever proxy the API to another
  origin, revisit this.
- Secure headers: `X-Content-Type-Options: nosniff` set on file responses;
  add `helmet`-style headers behind the proxy if desired.

### Honest claims
The app does **not** pretend to be secure:
- No account system, no per-user encryption.
- LAN access is transmitted in the clear between clients and host.
- Anyone on the network can connect and mutate shared content — that is the
  product.

## Threat notes / recommendations

| Risk | Mitigation |
| ---- | ---------- |
| Rogue device on the same Wi-Fi reads/modifies shared content | Fundamental by design; put the shared space on a trusted VLAN, or add the optional shared-space password (future). |
| Malicious file exploit (e.g. unsafe attachment types) | Downloads are forced (`attachment` + `nosniff`); browser-unsafe attachments cannot run inline. Keep this on modern browsers. |
| Upload disk exhaustion | `MAX_UPLOAD_BYTES` cap per upload; temp cleanup on failure. Add host disk monitoring for shared hosts. |
| Postgres exposed to LAN | Compose binds `5432:5432` so the app container reaches it; **do not** open that port to the LAN in your router/firewall. |
| Path traversal via names/ids | Sanitization + containment checks + strict id regex. |

## Running over TLS / the public internet
Not a V1 goal, but the custom server binds `0.0.0.0:3000` and is proxy-ready.
Put `nginx`/Caddy in front with TLS if you ever expose it beyond the LAN; the
WebSocket client automatically upgrades to `wss://` when the page is https.