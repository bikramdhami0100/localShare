"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  FileText,
  Link2,
  FolderPlus,
  UploadCloud,
  Loader2,
  Check,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { cn } from "@/lib/cn";
import type { Folder } from "@/types";

type Mode = "text" | "link" | "file" | "folder";

interface Props {
  open: boolean;
  onClose: () => void;
  folders: Folder[];
  initialMode?: Mode;
  createContent: (
    type: "text" | "link",
    input: { title?: string; body?: string; url?: string }
  ) => Promise<{ ok: boolean; error?: string }>;
  createFolder: (name: string) => Promise<{ ok: boolean; error?: string }>;
  uploadFile: (
    file: File,
    targetFolder: string | null,
    onProgress?: (pct: number) => void
  ) => Promise<{ ok: boolean; error?: string }>;
}

const MODES: { id: Mode; label: string; icon: typeof FileText }[] = [
  { id: "text", label: "Text", icon: FileText },
  { id: "link", label: "Link", icon: Link2 },
  { id: "file", label: "File", icon: UploadCloud },
  { id: "folder", label: "Folder", icon: FolderPlus },
];

export function AddContentModal({
  open,
  onClose,
  folders,
  initialMode = "text",
  createContent,
  createFolder,
  uploadFile,
}: Props) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [folderName, setFolderName] = useState("");
  const [targetFolder, setTargetFolder] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setTitle("");
    setBody("");
    setUrl("");
    setFolderName("");
    setTargetFolder("");
    setBusy(false);
    setError(null);
    setProgress(null);
    setMode("text");
  }, []);

  useEffect(() => {
    if (open) setMode(initialMode);
  }, [open, initialMode]);

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmitText = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() && !body.trim()) {
      setError("Add a title or some text");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await createContent("text", {
      title: title.trim() || body.trim().slice(0, 40),
      body,
    });
    setBusy(false);
    if (res.ok) handleClose();
    else setError(res.error ?? "Could not save changes. Please try again.");
  };

  const handleSubmitLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) {
      setError("Add a URL");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await createContent("link", {
      title: title.trim() || url.trim(),
      url,
    });
    setBusy(false);
    if (res.ok) handleClose();
    else setError(res.error ?? "Could not save changes. Please try again.");
  };

  const handleSubmitFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderName.trim()) {
      setError("Add a folder name");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await createFolder(folderName.trim());
    setBusy(false);
    if (res.ok) handleClose();
    else setError(res.error ?? "Could not create folder.");
  };

  const doUpload = async (files: FileList | File[]) => {
    for (const file of Array.from(files)) {
      setBusy(true);
      setError(null);
      setProgress(0);
      const res = await uploadFile(
        file,
        targetFolder || null,
        (pct) => setProgress(pct)
      );
      setProgress(null);
      setBusy(false);
      if (!res.ok) {
        setError(res.error ?? "Upload failed");
        return;
      }
    }
    handleClose();
  };

  const iconButtonCls = (isActive: boolean) =>
    cn(
      "flex flex-1 flex-col items-center gap-1.5 rounded-lg border px-2 py-3 text-xs font-medium transition-colors",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      isActive
        ? "border-accent bg-accent/40 text-accent-foreground"
        : "border-border bg-secondary/30 text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
    );

  return (
    <Modal open={open} onClose={handleClose} title="Add to Shared Space">
      <div className="mb-5 grid grid-cols-4 gap-2" role="tablist" aria-label="Content type">
        {MODES.map((m) => {
          const Icon = m.icon;
          return (
            <button
              key={m.id}
              role="tab"
              aria-selected={mode === m.id}
              className={iconButtonCls(mode === m.id)}
              onClick={() => setMode(m.id)}
            >
              <Icon className="h-5 w-5" />
              {m.label}
            </button>
          );
        })}
      </div>

      {folders.length > 0 && (
        <label className="mb-4 block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">
            Put in folder (optional)
          </span>
          <select
            className="h-10 w-full rounded-lg border border-input bg-secondary/40 px-3 text-sm"
            value={targetFolder}
            onChange={(e) => setTargetFolder(e.target.value)}
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

      {mode === "text" && (
        <form onSubmit={handleSubmitText} className="space-y-3">
          <Input
            placeholder="Title (optional)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
            aria-label="Title"
          />
          <Textarea
            rows={5}
            placeholder="Write a note…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            aria-label="Note text"
          />
          <ErrorLine error={error} />
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Share note
          </Button>
        </form>
      )}

      {mode === "link" && (
        <form onSubmit={handleSubmitLink} className="space-y-3">
          <Input
            placeholder="Title (optional)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-label="Title"
          />
          <Input
            placeholder="https://example.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            autoFocus
            inputMode="url"
            aria-label="URL"
          />
          <ErrorLine error={error} />
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Share link
          </Button>
        </form>
      )}

      {mode === "file" && (
        <div>
          <div
            role="button"
            tabIndex={0}
            aria-label="Upload file or drag and drop"
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              doUpload(e.dataTransfer.files);
            }}
            className={cn(
              "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition-colors",
              dragOver
                ? "border-primary bg-primary/10"
                : "border-border bg-secondary/20 hover:border-accent"
            )}
          >
            <UploadCloud
              className={cn("h-8 w-8", dragOver ? "text-primary" : "text-muted-foreground")}
            />
            <div className="text-sm text-muted-foreground">
              {progress !== null
                ? `Uploading… ${progress}%`
                : "Drag & drop files here, or click to browse"}
            </div>
            <input
              ref={inputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => e.target.files && e.target.files.length > 0 && doUpload(e.target.files)}
            />
          </div>
          {progress !== null && (
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
          <ErrorLine error={error} />
        </div>
      )}

      {mode === "folder" && (
        <form onSubmit={handleSubmitFolder} className="space-y-3">
          <Input
            placeholder="Folder name, e.g. Documents"
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            autoFocus
            aria-label="Folder name"
          />
          <ErrorLine error={error} />
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderPlus className="h-4 w-4" />}
            Create folder
          </Button>
        </form>
      )}
    </Modal>
  );
}

function ErrorLine({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {error}
    </p>
  );
}