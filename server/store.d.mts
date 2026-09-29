export interface FileMeta {
  id: string;
  original_name: string;
  stored_name: string;
  mime_type: string;
  size: number;
  checksum: string | null;
  storage_path: string;
  uploaded_by_device: string;
  created_at: string;
}

export interface ContentRow {
  id: string;
  type: "text" | "link" | "file";
  title: string;
  body: string;
  url: string | null;
  folder_id: string | null;
  version: number;
  created_by_device: string;
  updated_by_device: string;
  created_at: string;
  updated_at: string;
  file: {
    id: string;
    original_name: string;
    mime_type: string;
    size: number;
    checksum: string | null;
    created_at: string | null;
  } | null;
}

export interface FolderRow {
  id: string;
  name: string;
  parent_id: string | null;
  created_by_device: string;
  created_at: string;
  updated_at: string;
}

export interface DeviceRow {
  id: string;
  display_name: string;
  metadata: Record<string, unknown>;
  last_seen: string;
  created_at: string;
}

export interface SharedStateRow {
  content: ContentRow[];
  folders: FolderRow[];
  devices: DeviceRow[];
}

export interface ListContentOptions {
  folderId?: string;
  search?: string;
  type?: string;
  sort?: "newest" | "oldest" | "updated" | "title";
  version?: number | null;
}

export declare function listContent(opts?: ListContentOptions): Promise<ContentRow[]>;
export declare function getContent(id: string): Promise<ContentRow | null>;
export declare function getContentByFileId(fileId: string): Promise<ContentRow | null>;
export declare function createContent(input: {
  id: string;
  type: "text" | "link" | "file";
  title: string;
  body: string;
  url: string | null;
  fileId?: string;
  folderId: string | null;
  createdByDevice: string;
}): Promise<ContentRow | null>;
export declare function updateContent(input: {
  id: string;
  expectedVersion: number;
  fields: Record<string, unknown>;
  byDevice: string;
}): Promise<ContentRow | null>;
export declare function softDeleteContent(id: string): Promise<true>;
export declare function createFileRecord(input: {
  id: string;
  originalName: string;
  storedName: string;
  mimeType: string;
  size: number;
  checksum: string;
  storagePath: string;
  uploadedByDevice: string;
}): Promise<FileMeta & { storage_path: string }>;
export declare function getFile(id: string): Promise<(FileMeta & { storage_path: string }) | null>;
export declare function fileIsReferencedByContent(fileId: string): Promise<boolean>;
export declare function deleteFileRecord(id: string): Promise<true>;
export declare function listFolders(): Promise<FolderRow[]>;
export declare function getFolder(id: string): Promise<FolderRow | null>;
export declare function createFolder(input: {
  id: string;
  name: string;
  parentId: string | null;
  createdByDevice: string;
}): Promise<FolderRow | null>;
export declare function updateFolder(input: {
  id: string;
  name: string;
  byDevice: string;
}): Promise<FolderRow | null>;
export declare function softDeleteFolder(id: string): Promise<true>;
export declare function unfoldContents(folderId: string): Promise<string[]>;
export declare function upsertDevice(input: {
  id: string;
  displayName: string;
  metadata?: Record<string, unknown>;
}): Promise<DeviceRow>;
export declare function touchDevice(id: string): Promise<void>;
export declare function listDevices(): Promise<DeviceRow[]>;
export declare function getSharedState(): Promise<SharedStateRow>;

export declare class HttpError extends Error {
  status: number;
  constructor(status: number, message: string);
}