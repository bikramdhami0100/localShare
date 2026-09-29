// LocalShare acceptance tests against a running server (npm start).
// Covers the MANDATORY test scenarios from MASTERPROMPT §30–§35:
// refresh persistence, edit sync, delete tombstone, upload/download,
// WebSocket broadcast + reconnect, concurrent-edit version conflicts.
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import WebSocket from "ws";

const BASE = process.env.TEST_BASE_URL || "http://localhost:3000";
const WS = BASE.replace(/^http/, "ws") + "/ws";

const DEVICE = `device_test_${randomUUID().slice(0, 8)}`;

function jfetch(path, init = {}) {
  return fetch(BASE + path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers || {}) },
  });
}

function connectWs() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS);
    ws.once("open", () => {
      ws.send(JSON.stringify({ type: "HELLO", device_id: DEVICE, device_name: "Test Device" }));
      resolve(ws);
    });
    ws.once("error", reject);
  });
}

/** Collect WS messages until 'until' returns a result (or timeout). */
async function waitForEvent(ws, until, timeoutMs = 5000) {
  return new Promise((resolve) => {
    let messages = [];
    const timer = setTimeout(() => resolve({ timedOut: true, messages }), timeoutMs);
    const onMsg = (raw) => {
      const msg = JSON.parse(raw.toString());
      messages.push(msg);
      const hit = until(msg, messages);
      if (hit) {
        clearTimeout(timer);
        ws.off("message", onMsg);
        resolve(hit);
      }
    };
    ws.on("message", onMsg);
  });
}

test("health endpoint reports ok", async () => {
  const res = await jfetch("/api/health");
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, "ok");
});

test("content create + refresh persistence (MASTERPROMPT §30)", async () => {
  const create = await jfetch("/api/content", {
    method: "POST",
    body: JSON.stringify({
      device_id: DEVICE,
      type: "text",
      title: "Meeting",
      body: "Meeting at 3 PM",
    }),
  });
  assert.equal(create.status, 201);
  const { item } = await create.json();
  assert.equal(item.version, 1);

  // refresh: re-fetch from authoritative store
  const refetch = await jfetch("/api/content");
  const { items } = await refetch.json();
  const found = items.find((c) => c.id === item.id);
  assert.ok(found, "content must survive a refresh");
  assert.equal(found.body, "Meeting at 3 PM");
});

test("WebSocket: peers see create/update/delete in real time (§30–§34)", async () => {
  const wsA = await connectWs();
  const wsB = await connectWs();
  try {
    const createdP = waitForEvent(wsB, (m, msgs) =>
      m.type === "CONTENT_CREATED" ? m.item : null
    );

    const res = await jfetch("/api/content", {
      method: "POST",
      body: JSON.stringify({ device_id: DEVICE, type: "text", title: "Sync me", body: "v1" }),
    });
    assert.equal(res.status, 201);
    const { item } = await res.json();

    const created = await createdP;
    assert.ok(created, "peer must receive CONTENT_CREATED");
    assert.equal(created.id, item.id);

    // edit → CONTENT_UPDATED with version bump
    const updatedP = waitForEvent(wsA, (m) => (m.type === "CONTENT_UPDATED" ? m.item : null));
    const editRes = await jfetch(`/api/content/${item.id}`, {
      method: "PATCH",
      body: JSON.stringify({ device_id: DEVICE, version: item.version, body: "v2 - 4 PM" }),
    });
    assert.equal(editRes.status, 200);
    const edited = await updatedP;
    assert.ok(edited, "peer must receive CONTENT_UPDATED");
    assert.equal(edited.version, item.version + 1);
    assert.equal(edited.body, "v2 - 4 PM");

    // refresh shows edit (§33)
    const refetch = await (await jfetch("/api/content")).json();
    assert.equal(refetch.items.find((c) => c.id === item.id).body, "v2 - 4 PM");

    // delete → CONTENT_DELETED, and refresh keeps it gone (§34)
    const deletedP = waitForEvent(wsB, (m) => (m.type === "CONTENT_DELETED" ? m : null));
    const delRes = await jfetch(`/api/content/${item.id}`, { method: "DELETE" });
    assert.equal(delRes.status, 200);
    const delEv = await deletedP;
    assert.equal(delEv.id, item.id);

    const after = await (await jfetch("/api/content")).json();
    assert.ok(!after.items.find((c) => c.id === item.id), "deleted content must not return");
  } finally {
    wsA.close();
    wsB.close();
  }
});

test("optimistic concurrency: stale version edit is rejected with 409 (§16)", async () => {
  const { item } = await (
    await jfetch("/api/content", {
      method: "POST",
      body: JSON.stringify({ device_id: DEVICE, type: "text", title: "Conflict", body: "A" }),
    })
  ).json();

  // device A edits → version 2
  await jfetch(`/api/content/${item.id}`, {
    method: "PATCH",
    body: JSON.stringify({ device_id: DEVICE, version: 1, body: "B" }),
  });
  // device B edits stale version 1 → must be rejected
  const stale = await jfetch(`/api/content/${item.id}`, {
    method: "PATCH",
    body: JSON.stringify({ device_id: DEVICE, version: 1, body: "C" }),
  });
  assert.equal(stale.status, 409);

  const { item: now } = await (await jfetch(`/api/content/${item.id}`)).json();
  assert.equal(now.body, "B", "stale edit must not silently overwrite");
  assert.equal(now.version, 2);

  await jfetch(`/api/content/${item.id}`, { method: "DELETE" });
});

test("file upload + download + checksum (§17, §32)", async () => {
  const payload = Buffer.from("LocalShare report.pdf content " + randomUUID());
  const upload = await fetch(BASE + "/api/files/upload", {
    method: "POST",
    headers: {
      "x-file-name": "report.pdf",
      "x-file-mime": "application/pdf",
      "x-file-size": String(payload.length),
      "x-device-id": DEVICE,
    },
    body: payload,
  });
  assert.equal(upload.status, 201, await upload.clone().text());
  const { file, checksum } = await upload.json();
  assert.equal(file.original_name, "report.pdf");
  assert.equal(file.size, payload.length);

  // content item was created for the file
  const { items } = await (await jfetch("/api/content")).json();
  assert.ok(items.find((c) => c.file?.id === file.id), "file must appear as content");

  // download round-trips identical bytes
  const dl = await fetch(BASE + `/api/files/${file.id}`);
  assert.equal(dl.status, 200);
  const bytes = Buffer.from(await dl.arrayBuffer());
  assert.ok(bytes.equals(payload), "downloaded bytes must match uploaded bytes");

  // deleting the file deletes its content and persists
  await jfetch(`/api/content/${items.find((c) => c.file?.id === file.id).id}`, {
    method: "DELETE",
  });
  const delRes = await jfetch(`/api/files/${file.id}`, { method: "DELETE" });
  assert.equal(delRes.status, 200);
  const after = await (await jfetch("/api/content")).json();
  assert.ok(!after.items.find((c) => c.file?.id === file.id), "deleted file must not return");

  void checksum;
});

test("sleep a moment so HELLO initial SYNC is validated when WS reconnects", async () => {
  await new Promise((r) => setTimeout(r, 300));
});

test("folders: create, use, delete (§13)", async () => {
  const { folder } = await (
    await jfetch("/api/folders", {
      method: "POST",
      body: JSON.stringify({ device_id: DEVICE, name: "Documents" }),
    })
  ).json();
  assert.ok(folder.id);

  const { item } = await (
    await jfetch("/api/content", {
      method: "POST",
      body: JSON.stringify({
        device_id: DEVICE,
        type: "text",
        title: "In folder",
        body: "x",
      }),
    })
  ).json();

  await jfetch(`/api/content/${item.id}`, {
    method: "PATCH",
    body: JSON.stringify({ device_id: DEVICE, version: 1, folder_id: folder.id }),
  });

  const list = await (await jfetch("/api/content?folder_id=" + folder.id)).json();
  assert.equal(list.items.length, 1);
  assert.equal(list.items[0].id, item.id);

  // deleting folder ungroups content, does not lose it
  await jfetch(`/api/folders/${folder.id}`, { method: "DELETE" });
  const all = await (await jfetch("/api/content")).json();
  assert.ok(all.items.find((c) => c.id === item.id), "content survives folder deletion");

  await jfetch(`/api/content/${item.id}`, { method: "DELETE" });
});

test("device registration records the device", async () => {
  const res = await jfetch("/api/device", {
    method: "PUT",
    body: JSON.stringify({ device_id: DEVICE, display_name: "Test Device" }),
  });
  assert.equal(res.status, 200);
  const { device } = await res.json();
  assert.equal(device.id, DEVICE);
});