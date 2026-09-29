export type ContentType = "text" | "link" | "file";

export interface FileMeta {
  id: string;
  original_name: string;
  mime_type: string;
  size: number;
  checksum: string | null;
  created_at: string | null;
}

export interface ContentItem {
  id: string;
  type: ContentType;
  title: string;
  body: string;
  url: string | null;
  folder_id: string | null;
  version: number;
  created_by_device: string;
  updated_by_device: string;
  created_at: string;
  updated_at: string;
  file: FileMeta | null;
}

export interface Folder {
  id: string;
  name: string;
  parent_id: string | null;
  created_by_device: string;
  created_at: string;
  updated_at: string;
}

export interface Device {
  id: string;
  display_name: string;
  metadata: Record<string, unknown>;
  last_seen: string;
  created_at: string;
}

export interface SharedState {
  content: ContentItem[];
  folders: Folder[];
  devices: Device[];
}

export interface ClientEvent {
  type: string;
  id?: string;
  data?: Partial<SharedState>;
  version?: number;
  folder_id?: string | null;
  file_id?: string | null;
  item?: ContentItem;
  folder?: Folder;
  device?: { id: string; display_name: string; last_seen?: string };
}