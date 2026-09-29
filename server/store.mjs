// Single source of SQL for the LocalShare server.
// Used by API routes, the WebSocket hub and the custom server for initial sync.
// The database is the authoritative source of truth for shared-space metadata.
import { getPool } from "./pool.mjs";

const iso = (d) => (d instanceof Date ? d.toISOString() : d ?? null);

function rowsOut(r) {
  return {
    id: r.id,
    type: r.type,
    title: r.title,
    body: r.body,
    url: r.url,
    folder_id: r.folder_id,
    version: Number(r.version),
    created_by_device: r.created_by_device,
    updated_by_device: r.updated_by_device,
    created_at: iso(r.created_at),
    updated_at: iso(r.updated_at),
    file: r.file_id
      ? {
          id: r.file_id,
          original_name: r.file_original_name ?? r.original_name,
          mime_type: r.file_mime_type ?? r.mime_type,
          size: Number(r.file_size ?? r.size ?? 0),
          checksum: r.file_checksum ?? r.checksum,
          created_at: iso(r.file_created_at),
        }
      : null,
  };
}

/* ------------------------------- CONTENT -------------------------------- */

export async function listContent({
  folderId,
  search,
  type,
  sort = "newest",
  version = null,
} = {}) {
  const db = getPool();
  const where = ["c.deleted_at IS NULL"];
  const params = [];

  if (folderId) {
    params.push(folderId);
    where.push(`c.folder_id = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    where.push(`(c.title ILIKE $${params.length} OR c.body ILIKE $${params.length})`);
  }
  if (type) {
    params.push(type);
    where.push(`c.type = $${params.length}`);
  }
  if (version !== null) {
    params.push(version);
    where.push(`c.version >= $${params.length}`);
  }

  const orderMap = {
    newest: "c.created_at DESC",
    oldest: "c.created_at ASC",
    updated: "c.updated_at DESC",
    title: "c.title ASC",
  };
  const order = orderMap[sort] ?? orderMap.newest;

  const sql = `SELECT
      c.id, c.type, c.title, c.body, c.url, c.folder_id, c.version,
      c.created_by_device, c.updated_by_device, c.created_at, c.updated_at,
      f.id AS file_id, f.original_name AS file_original_name,
      f.mime_type AS file_mime_type, f.size AS file_size,
      f.checksum AS file_checksum, f.created_at AS file_created_at
    FROM content c
    LEFT JOIN files f ON f.id = c.file_id
    WHERE ${where.join(" AND ")}
    ORDER BY ${order}`;

  const res = await db.query(sql, params);
  return res.rows.map(rowsOut);
}

export async function getContent(id) {
  const db = getPool();
  const res = await db.query(
    `SELECT
      c.id, c.type, c.title, c.body, c.url, c.folder_id, c.version,
      c.created_by_device, c.updated_by_device, c.created_at, c.updated_at,
      f.id AS file_id, f.original_name AS file_original_name,
      f.mime_type AS file_mime_type, f.size AS file_size,
      f.checksum AS file_checksum, f.created_at AS file_created_at
     FROM content c
     LEFT JOIN files f ON f.id = c.file_id
     WHERE c.id = $1 AND c.deleted_at IS NULL`,
    [id]
  );
  return res.rows.length ? rowsOut(res.rows[0]) : null;
}

export async function createContent({
  id,
  type,
  title,
  body,
  url,
  fileId,
  folderId,
  createdByDevice,
}) {
  const db = getPool();
  await db.query(
    `INSERT INTO content
      (id, type, title, body, url, file_id, folder_id, created_by_device, updated_by_device)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8)`,
    [id, type, title, body, url, fileId, folderId, createdByDevice]
  );
  return getContent(id);
}

export async function updateContent({ id, expectedVersion, fields, byDevice }) {
  const db = getPool();
  const sets = [];
  const params = [];

  const allowed = ["title", "body", "url", "folder_id"];
  for (const key of allowed) {
    if (key in fields) {
      params.push(fields[key]);
      sets.push(`${key} = $${params.length}`);
    }
  }
  params.push(expectedVersion);
  params.push(byDevice);
  params.push(id);

  if (sets.length === 0) throw new HttpError(400, "No updatable fields provided");

  const sql = `UPDATE content
    SET ${sets.join(", ")}, updated_at = now(), version = version + 1,
        updated_by_device = $${params.length - 1}
    WHERE id = $${params.length} AND version = $${params.length - 2}
      AND deleted_at IS NULL`;

  const res = await db.query(sql, params);
  if (res.rowCount === 0) {
    const existing = await getContent(id);
    if (!existing) throw new HttpError(404, "Content not found");
    throw new HttpError(
      409,
      `Version conflict: another device changed this item (current version ${existing.version}). Reload and try again.`
    );
  }
  return getContent(id);
}

export async function softDeleteContent(id) {
  const db = getPool();
  // Tombstone: keep the row, mark deleted_at. Deleted items never reappear.
  const res = await db.query(
    `UPDATE content SET deleted_at = now(), updated_at = now(), version = version + 1
     WHERE id = $1 AND deleted_at IS NULL`,
    [id]
  );
  if (res.rowCount === 0) {
    const existing = await db.query("SELECT id FROM content WHERE id=$1", [id]);
    if (!existing.rows.length) throw new HttpError(404, "Content not found");
    throw new HttpError(400, "Content already deleted");
  }
  return true;
}

/* -------------------------------- FILES --------------------------------- */

export async function createFileRecord({
  id,
  originalName,
  storedName,
  mimeType,
  size,
  checksum,
  storagePath,
  uploadedByDevice,
}) {
  const db = getPool();
  await db.query(
    `INSERT INTO files
      (id, original_name, stored_name, mime_type, size, checksum, storage_path, uploaded_by_device)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [id, originalName, storedName, mimeType, size, checksum, storagePath, uploadedByDevice]
  );
  const res = await db.query("SELECT * FROM files WHERE id=$1", [id]);
  return fileRowOut(res.rows[0]);
}

function fileRowOut(r) {
  return {
    id: r.id,
    original_name: r.original_name,
    stored_name: r.stored_name,
    mime_type: r.mime_type,
    size: Number(r.size),
    checksum: r.checksum,
    storage_path: r.storage_path,
    uploaded_by_device: r.uploaded_by_device,
    created_at: iso(r.created_at),
  };
}

export async function getFile(id) {
  const db = getPool();
  const res = await db.query("SELECT * FROM files WHERE id=$1", [id]);
  return res.rows.length ? fileRowOut(res.rows[0]) : null;
}

export async function fileIsReferencedByContent(fileId) {
  const db = getPool();
  const res = await db.query(
    `SELECT c.id FROM content c WHERE c.file_id = $1 AND c.deleted_at IS NULL LIMIT 1`,
    [fileId]
  );
  return res.rows.length > 0;
}

export async function getContentByFileId(fileId) {
  const db = getPool();
  const res = await db.query(
    `SELECT
      c.id, c.type, c.title, c.body, c.url, c.folder_id, c.version,
      c.created_by_device, c.updated_by_device, c.created_at, c.updated_at,
      f.id AS file_id, f.original_name AS file_original_name,
      f.mime_type AS file_mime_type, f.size AS file_size,
      f.checksum AS file_checksum, f.created_at AS file_created_at
     FROM content c
     LEFT JOIN files f ON f.id = c.file_id
     WHERE c.file_id = $1 AND c.deleted_at IS NULL
     ORDER BY c.created_at ASC LIMIT 1`,
    [fileId]
  );
  return res.rows.length ? rowsOut(res.rows[0]) : null;
}

export async function deleteFileRecord(id) {
  const db = getPool();
  const res = await db.query("DELETE FROM files WHERE id=$1", [id]);
  if (res.rowCount === 0) throw new HttpError(404, "File not found");
  return true;
}

/* ------------------------------- FOLDERS -------------------------------- */

/** Un-group content from a folder (used when a folder is deleted). */
export async function unfoldContents(folderId) {
  const db = getPool();
  const res = await db.query(
    `UPDATE content SET folder_id = NULL, updated_at = now(), version = version + 1
     WHERE folder_id = $1 AND deleted_at IS NULL
     RETURNING id`,
    [folderId]
  );
  return res.rows.map((r) => r.id);
}

export async function listFolders() {
  const db = getPool();
  const res = await db.query(
    `SELECT id, name, parent_id, created_by_device, created_at, updated_at
     FROM folders WHERE deleted_at IS NULL ORDER BY name ASC`
  );
  return res.rows.map((r) => ({
    id: r.id,
    name: r.name,
    parent_id: r.parent_id,
    created_by_device: r.created_by_device,
    created_at: iso(r.created_at),
    updated_at: iso(r.updated_at),
  }));
}

export async function getFolder(id) {
  const db = getPool();
  const res = await db.query(
    `SELECT id, name, parent_id, created_by_device, created_at, updated_at
     FROM folders WHERE id=$1 AND deleted_at IS NULL`,
    [id]
  );
  return res.rows.length ? res.rows[0] : null;
}

export async function createFolder({ id, name, parentId, createdByDevice }) {
  const db = getPool();
  await db.query(
    `INSERT INTO folders (id, name, parent_id, created_by_device) VALUES ($1,$2,$3,$4)`,
    [id, name, parentId, createdByDevice]
  );
  return getFolder(id);
}

export async function updateFolder({ id, name, byDevice }) {
  const db = getPool();
  const res = await db.query(
    `UPDATE folders SET name=$2, updated_at=now() WHERE id=$1 AND deleted_at IS NULL`,
    [id, name]
  );
  if (res.rowCount === 0) throw new HttpError(404, "Folder not found");
  return getFolder(id);
}

export async function softDeleteFolder(id) {
  const db = getPool();
  const res = await db.query(
    `UPDATE folders SET deleted_at=now(), updated_at=now() WHERE id=$1 AND deleted_at IS NULL`,
    [id]
  );
  if (res.rowCount === 0) throw new HttpError(404, "Folder not found");
  return true;
}

/* ------------------------------- DEVICES -------------------------------- */

export async function upsertDevice({ id, displayName, metadata = {} }) {
  const db = getPool();
  const res = await db.query(
    `INSERT INTO devices (id, display_name, metadata, last_seen)
     VALUES ($1,$2,$3,now())
     ON CONFLICT (id) DO UPDATE SET
       display_name = EXCLUDED.display_name,
       metadata = EXCLUDED.metadata,
       last_seen = now()
     RETURNING id, display_name, metadata, last_seen, created_at`,
    [id, displayName, metadata]
  );
  const r = res.rows[0];
  return {
    id: r.id,
    display_name: r.display_name,
    metadata: r.metadata,
    last_seen: iso(r.last_seen),
    created_at: iso(r.created_at),
  };
}

export async function touchDevice(id) {
  const db = getPool();
  await db.query(
    `INSERT INTO devices (id, display_name, last_seen)
     VALUES ($1, 'Device', now())
     ON CONFLICT (id) DO UPDATE SET last_seen = now()`,
    [id]
  );
}

export async function listDevices() {
  const db = getPool();
  const res = await db.query(
    `SELECT id, display_name, metadata, last_seen, created_at
     FROM devices ORDER BY last_seen DESC LIMIT 100`
  );
  return res.rows.map((r) => ({
    id: r.id,
    display_name: r.display_name,
    metadata: r.metadata,
    last_seen: iso(r.last_seen),
    created_at: iso(r.created_at),
  }));
}

/* ---------------------------- INITIAL SYNC ------------------------------ */

export async function getSharedState() {
  const [content, folders, devices] = await Promise.all([
    listContent({}),
    listFolders(),
    listDevices(),
  ]);
  return { content, folders, devices };
}

/* --------------------------------- ERRORS ------------------------------- */

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}