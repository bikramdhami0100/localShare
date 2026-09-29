"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ContentItem, Folder, Device, SharedState, ClientEvent } from "@/types";

export type ConnectionState = "connected" | "reconnecting" | "offline";

export type NoticeKind = "info" | "error" | "success";
export interface Notice {
  id: number;
  kind: NoticeKind;
  text: string;
}

let noticeSeq = 0;

function isClient() {
  return typeof window !== "undefined";
}

function resolveWsUrl(): string {
  return isClient() && location.protocol === "https:" ? "wss" : "ws";
}

export function useSharedSpace(deviceId: string | undefined, displayName: string) {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [connection, setConnection] = useState<ConnectionState>("offline");
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [hiddenConflict, setHiddenConflict] = useState<Record<string, boolean>>({});

  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const manualRef = useRef(false);

  const notify = useCallback((kind: NoticeKind, text: string) => {
    const id = ++noticeSeq;
    setNotices((n) => [...n, { id, kind, text }]);
    setTimeout(() => setNotices((n) => n.filter((x) => x.id !== id)), 6000);
  }, []);

  const notice = useCallback(
    (text: string, kind: NoticeKind = "info") => notify(kind, text),
    [notify]
  );

  /* ------------------------------ apply events ------------------------------ */

  const applyEvent = useCallback(
    (msg: ClientEvent) => {
      switch (msg.type) {
        case "SYNC": {
          const data = (msg as any).data as SharedState;
          setItems(data.content ?? []);
          setFolders(data.folders ?? []);
          setDevices(data.devices ?? []);
          setLoaded(true);
          break;
        }
        case "CONTENT_CREATED":
        case "FILE_CREATED":
          if (msg.item) {
            setItems((prev) => upsertItem(prev, msg.item!));
          }
          break;
        case "CONTENT_UPDATED":
          if (msg.item) {
            setItems((prev) => upsertItem(prev, msg.item!));
            notice(`${msg.item!.title || "Item"} was updated`);
          }
          break;
        case "CONTENT_DELETED":
          setItems((prev) => prev.filter((c) => c.id !== msg.id));
          break;
        case "FOLDER_CREATED":
        case "FOLDER_UPDATED":
          if (msg.folder) setFolders((prev) => upsertFolder(prev, msg.folder!));
          break;
        case "FOLDER_DELETED":
          setFolders((prev) => prev.filter((f) => f.id !== msg.id));
          break;
        case "FILE_DELETED":
          setItems((prev) =>
            prev.map((c) => (c.file?.id === msg.id ? { ...c, file: null } : c))
          );
          break;
        case "DEVICE_CONNECTED":
          if (msg.device) {
            setDevices((prev) => upsertDeviceRow(prev, msg.device!));
            notice(`${msg.device.display_name} connected`, "success");
          }
          break;
        case "DEVICE_DISCONNECTED":
          if (msg.device) {
            setDevices((prev) =>
              prev.map((d) =>
                d.id === msg.device!.id ? { ...d, last_seen: new Date().toISOString() } : d
              )
            );
          }
          break;
        default:
          break;
      }
    },
    [notify]
  );

  /* -------------------------------- websocket ------------------------------- */

  const connect = useCallback(() => {
    if (!deviceId || manualRef.current) return;
    const ws = new WebSocket(`${resolveWsUrl()}://${location.host}/ws`);
    wsRef.current = ws;
    setConnection((c) => (c === "connected" ? c : "reconnecting"));

    ws.onopen = () => {
      setConnection("connected");
      setLoaded(true); // UI renders immediately; SYNC refines it
      ws.send(
        JSON.stringify({
          type: "HELLO",
          device_id: deviceId,
          device_name: displayName,
        })
      );
    };

    ws.onmessage = (ev) => {
      try {
        applyEvent(JSON.parse(ev.data as string));
      } catch {
        /* ignore malformed */
      }
    };

    ws.onclose = () => {
      if (manualRef.current) return;
      setConnection("offline");
      retryRef.current = setTimeout(connect, 2500);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [deviceId, displayName, applyEvent]);

  useEffect(() => {
    if (!deviceId) return;
    connect();
    return () => {
      manualRef.current = true;
      if (retryRef.current) clearTimeout(retryRef.current);
      wsRef.current?.close();
    };
  }, [deviceId, connect]);

  /* ------------------------------ initial fetch ----------------------------- */

  const refresh = useCallback(async () => {
    try {
      const [c, f, d] = await Promise.all([
        fetch("/api/content").then((r) => r.json()),
        fetch("/api/folders").then((r) => r.json()),
        fetch("/api/health").then((r) => r.json()),
      ]);
      setItems(c.items ?? []);
      setFolders(f.folders ?? []);
      setLoaded(true);
      void d;
    } catch (err) {
      notice("Could not load shared content", "error");
    }
  }, [notice]);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ------------------------------- CRUD actions ----------------------------- */

  const base = useCallback(
    (extra: Record<string, unknown>) => ({
      device_id: deviceId,
      ...extra,
    }),
    [deviceId]
  );

  const request = useCallback(
    async (url: string, init: RequestInit): Promise<{ json: any; ok: boolean }> => {
      const res = await fetch(url, init);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Request failed");
      }
      return { json: data, ok: true };
    },
    []
  );

  const createContent = useCallback(
    async (type: "text" | "link", input: { title?: string; body?: string; url?: string }) => {
      try {
        const { json } = await request("/api/content", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(base({ type, ...input })),
        });
        return { ok: true as const, item: json.item as ContentItem };
      } catch (err) {
        const text = (err as Error).message;
        notice(text, "error");
        return { ok: false as const, error: text };
      }
    },
    [base, request, notice]
  );

  const moveToFolder = useCallback(
    async (itemId: string, folderId: string | null, version: number) => {
      try {
        const { json } = await request(`/api/content/${itemId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(base({ version, folder_id: folderId })),
        });
        setItems((prev) => upsertItem(prev, json.item));
        return { ok: true as const };
      } catch (err) {
        notice((err as Error).message, "error");
        return { ok: false as const, error: (err as Error).message };
      }
    },
    [base, request, notice]
  );

  const updateContent = useCallback(
    async (item: ContentItem, patch: { title?: string; body?: string }) => {
      try {
        const { json } = await request(`/api/content/${item.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(base({ version: item.version, ...patch })),
        });
        setItems((prev) => upsertItem(prev, json.item));
        return { ok: true as const, item: json.item as ContentItem };
      } catch (err) {
        const text = (err as Error).message;
        if (text.includes("Version conflict")) {
          setHiddenConflict((h) => ({ ...h, [item.id]: false }));
        }
        notice(text, "error");
        return { ok: false as const, error: text };
      }
    },
    [base, request, notice]
  );

  const deleteContent = useCallback(
    async (item: ContentItem) => {
      try {
        await request(`/api/content/${item.id}`, { method: "DELETE" });
        setItems((prev) => prev.filter((c) => c.id !== item.id));
        return { ok: true as const };
      } catch (err) {
        notice((err as Error).message, "error");
        return { ok: false as const, error: (err as Error).message };
      }
    },
    [request, notice]
  );

  const createFolder = useCallback(
    async (name: string, parentId: string | null = null) => {
      try {
        const { json } = await request("/api/folders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(base({ name, parent_id: parentId })),
        });
        setFolders((prev) => upsertFolder(prev, json.folder));
        return { ok: true as const, folder: json.folder as Folder };
      } catch (err) {
        const text = (err as Error).message;
        notice(text, "error");
        return { ok: false as const, error: text };
      }
    },
    [base, request, notice]
  );

  const deleteFolder = useCallback(
    async (folder: Folder) => {
      try {
        await request(`/api/folders/${folder.id}`, { method: "DELETE" });
        setFolders((prev) => prev.filter((f) => f.id !== folder.id));
        return { ok: true as const };
      } catch (err) {
        notice((err as Error).message, "error");
        return { ok: false as const, error: (err as Error).message };
      }
    },
    [request, notice]
  );

  /* --------------------------------- upload -------------------------------- */

  const uploadFile = useCallback(
    (file: File, folderId: string | null, onProgress?: (pct: number) => void) => {
      return new Promise<{ ok: boolean; error?: string }>((resolve) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/files/upload");
        xhr.setRequestHeader("x-file-name", file.name);
        xhr.setRequestHeader("x-file-mime", file.type || "application/octet-stream");
        xhr.setRequestHeader("x-file-size", String(file.size));
        if (deviceId) xhr.setRequestHeader("x-device-id", deviceId);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => {
          try {
            const data = JSON.parse(xhr.responseText);
            if (xhr.status >= 200 && xhr.status < 300) {
              const item = data.item as ContentItem;
              if (folderId) {
                moveToFolder(item.id, folderId, item.version);
              }
              setItems((prev) => upsertItem(prev, item));
              notice("Upload complete", "success");
              resolve({ ok: true });
            } else {
              notice(data.error || "Upload failed", "error");
              resolve({ ok: false, error: data.error || "Upload failed" });
            }
          } catch {
            notice("Upload failed", "error");
            resolve({ ok: false, error: "Upload failed" });
          }
        };
        xhr.onerror = () => {
          notice("Upload failed — connection lost. Reconnecting...", "error");
          resolve({ ok: false, error: "Network error" });
        };
        xhr.send(file);
      });
    },
    [deviceId, notice, moveToFolder]
  );

  const downloadUrl = useCallback((item: ContentItem) => {
    return "/api/files/" + item.file?.id;
  }, []);

  return {
    connection,
    loaded,
    items,
    folders,
    devices,
    notices,
    hiddenConflict,
    dismissConflict: (id: string) => setHiddenConflict((h) => ({ ...h, [id]: true })),
    refresh,
    createContent,
    updateContent,
    deleteContent,
    moveToFolder,
    createFolder,
    deleteFolder,
    uploadFile,
    downloadUrl,
    notify,
  };
}

/* --------------------------------- helpers -------------------------------- */

function upsertItem(prev: ContentItem[], next: ContentItem): ContentItem[] {
  if (next.folder_id) {
    // items can also be nested under folders; folders remain flat in state
  }
  const idx = prev.findIndex((c) => c.id === next.id);
  if (idx === -1) return [next, ...prev];
  const copy = [...prev];
  const existing = copy[idx];
  // Prefer the higher version (server is authoritative).
  copy[idx] = existing.version > next.version ? existing : next;
  return copy;
}

function upsertFolder(prev: Folder[], next: Folder): Folder[] {
  const idx = prev.findIndex((f) => f.id === next.id);
  if (idx === -1) return [...prev, next];
  const copy = [...prev];
  copy[idx] = next;
  return copy;
}

function upsertDeviceRow(
  prev: Device[],
  next: Partial<Device> & { id: string }
): Device[] {
  const idx = prev.findIndex((d) => d.id === next.id);
  if (idx === -1) {
    return [
      {
        id: next.id,
        display_name: next.display_name ?? "Device",
        metadata: next.metadata ?? {},
        last_seen: next.last_seen ?? new Date().toISOString(),
        created_at: next.created_at ?? new Date().toISOString(),
      },
      ...prev,
    ];
  }
  const copy = [...prev];
  copy[idx] = { ...copy[idx], ...next };
  return copy;
}