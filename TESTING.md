# Testing

Automated acceptance tests live in `tests/` and run with the built-in Node
test runner against a **running server** (Postgres must be up).

```bash
npm run build          # once
npm start &            # server on :3000 (default TEST_BASE_URL)
npm test
```

`TEST_BASE_URL` overrides the target (e.g. `TEST_BASE_URL=http://192.168.1.50:3000 npm test`).

## What the suite covers

| Test | MASTERPROMPT scenario |
| ---- | --------------------- |
| health endpoint           | §44 `GET /api/health`          |
| create + refresh survives | §30 Refresh Test — content remains |
| WS peers see create/update/delete live | §30–§34, §9 Real-time sync |
| edit → version bump + broadcast | §33 Edit Test |
| delete persists (tombstone) + broadcast | §34 Delete Test |
| stale edit rejected `409` | §16 Optimistic concurrency |
| upload streams, checksum, download round-trip | §17 File upload, §32 Uploader disconnect |
| folder create/use/delete ungrouping | §13 Folders |
| device registration | §15 Device ID |

## Manual acceptance checklist (multi-device)

Re-run these by hand with ≥2 laptops/apps on the same Wi‑Fi (§35):

1. **Connect** — two devices open `http://<host>:3000`, both show 🟢 Connected.
2. **Create** — A adds "Meeting today at 3 PM"; B sees it immediately.
3. **Edit** — A edits to "4 PM"; B shows `Meeting 4 PM` (notice appears).
4. **Delete** — B deletes it; A sees it disappear; A refreshes — gone.
5. **Refresh** — A adds a note, refreshes; the note is still there.
6. **Browser close** — A adds content, closes the tab; B refreshes; content present.
7. **Uploader disconnect** — A uploads a file, drops Wi‑Fi; B refreshes; file present and downloadable.
8. **Server restart** — create content; `npm start` again; content present (§41).
9. **Large file** — upload a file > 100 MB; progress bar fills; checksum verified on download.
10. **Reconnect** — stop the server mid-session; client shows Offline/Reconnecting; restart; state restored.
11. **Conflict** — A and B open the same note; A saves first, B saves stale → B gets the conflict notice, no data lost.

## Functional QA the app runs automatically for you

- The web UI shows the honest LAN warning on the home screen.
- `Storage` failures never show "Saved successfully" — they surface the
  server's error text (§39).
- Client connection status is always visible: 🟢 Connected / 🟡 Reconnecting /
  🔴 Offline (§24).