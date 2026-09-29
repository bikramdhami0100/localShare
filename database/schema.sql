-- LocalShare PostgreSQL schema
-- The database is the authoritative source of truth for shared-space metadata.

CREATE TABLE IF NOT EXISTS devices (
    id           TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    metadata     JSONB NOT NULL DEFAULT '{}'::jsonb,
    last_seen    TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS files (
    id            TEXT PRIMARY KEY,
    original_name TEXT NOT NULL,
    stored_name   TEXT NOT NULL,
    mime_type     TEXT NOT NULL,
    size          BIGINT NOT NULL DEFAULT 0,
    checksum      TEXT,
    storage_path  TEXT NOT NULL,
    uploaded_by_device TEXT NOT NULL,
    metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS folders (
    id                TEXT PRIMARY KEY,
    name              TEXT NOT NULL,
    parent_id         TEXT REFERENCES folders(id) ON DELETE SET NULL,
    created_by_device TEXT NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at        TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS content (
    id                TEXT PRIMARY KEY,
    type              TEXT NOT NULL CHECK (type IN ('text', 'link', 'file')),
    title             TEXT NOT NULL DEFAULT '',
    body              TEXT NOT NULL DEFAULT '',
    url               TEXT,
    file_id           TEXT REFERENCES files(id) ON DELETE SET NULL,
    folder_id         TEXT REFERENCES folders(id) ON DELETE SET NULL,
    version           INTEGER NOT NULL DEFAULT 1,
    created_by_device TEXT NOT NULL,
    updated_by_device TEXT NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_content_deleted_at ON content (deleted_at);
CREATE INDEX IF NOT EXISTS idx_content_folder_id   ON content (folder_id);
CREATE INDEX IF NOT EXISTS idx_content_updated_at  ON content (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_folders_deleted_at  ON folders (deleted_at);
CREATE INDEX IF NOT EXISTS idx_folders_parent_id   ON folders (parent_id);