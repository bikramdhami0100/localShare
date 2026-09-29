"use client";

import { useState } from "react";
import { Loader2, Check } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import type { ContentItem, Folder } from "@/types";

interface Props {
  item: ContentItem | null;
  folders: Folder[];
  onClose: () => void;
  onSave: (
    item: ContentItem,
    patch: { title?: string; body?: string }
  ) => Promise<{ ok: boolean; error?: string }>;
  onMove: (item: ContentItem, folderId: string | null) => Promise<{ ok: boolean; error?: string }>;
}

export function EditContentModal({ item, folders, onClose, onSave, onMove }: Props) {
  const [title, setTitle] = useState(item?.title ?? "");
  const [body, setBody] = useState(item?.body ?? "");
  const [folderId, setFolderId] = useState(item?.folder_id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!item) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const patch: { title?: string; body?: string } = {};
    if (title !== item.title) patch.title = title;
    if (body !== item.body) patch.body = body;
    const res = await onSave(item, patch);
    setBusy(false);
    if (res.ok) onClose();
    else setError(res.error ?? "Could not save changes. Please try again.");
  };

  const handleFolder = async (v: string) => {
    setFolderId(v);
    const target = v === "" ? null : v;
    if (target !== item.folder_id) {
      const res = await onMove(item, target);
      if (!res.ok) setError(res.error ?? "Could not move item.");
    }
  };

  return (
    <Modal open onClose={onClose} title={`Edit — ${item.title || "Untitled"}`}>
      <form onSubmit={handleSubmit} className="space-y-3">
        {item.type === "text" && (
          <>
            <Input
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              aria-label="Title"
            />
            <Textarea
              rows={6}
              placeholder="Note text"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              aria-label="Note text"
            />
          </>
        )}
        {item.type === "link" && (
          <>
            <Input
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              aria-label="Title"
            />
            <Input readOnly value={item.url ?? ""} aria-label="URL (read only)" className="opacity-60" />
          </>
        )}
        {item.type === "file" && item.file && (
          <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            <span className="truncate">{item.file.original_name}</span>
          </div>
        )}

        {folders.length > 0 && (
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Folder</span>
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs dark:bg-input/30 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              value={folderId}
              onChange={(e) => handleFolder(e.target.value)}
            >
              <option value="">No folder</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {error && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            Save
          </Button>
        </div>
      </form>
    </Modal>
  );
}