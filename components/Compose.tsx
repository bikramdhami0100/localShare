"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Copy,
  Link2,
  Upload,
  Download,
  RefreshCw,
  Trash2,
  SquarePen,
  File as FileIcon,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { SaveIndicator, type SaveState } from "@/components/ui/SaveIndicator";
import { Input } from "@/components/ui/Input";
import type { ContentItem } from "@/types";
import type { ConnectionState } from "@/hooks/useSharedSpace";

interface Props {
  connection: ConnectionState;
  activeItem: ContentItem | null; // null → a brand-new note
  items: ContentItem[];
  createContent: (
    type: "text" | "link",
    input: { title?: string; body?: string; url?: string }
  ) => Promise<{ ok: boolean; error?: string; item?: ContentItem }>;
  updateContent: (
    item: ContentItem,
    patch: { title?: string; body?: string }
  ) => Promise<{ ok: boolean; error?: string; item?: ContentItem }>;
  onUploadFiles: (files: FileList | File[]) => void;
  onRefresh: () => Promise<void>;
  onUrls: (urlsOnly: boolean) => void;
  onFirstSave: (item: ContentItem) => void;
  onNewNote: () => void;
}

const rankBtn =
  "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground/90 shadow-xs h-8 transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30 dark:border-input dark:hover:bg-input/50 [&_svg]:size-4";

function deriveTitle(body: string): string {
  const firstLine = (body.split("\n").filter(Boolean)[0] || body).trim();
  return firstLine.slice(0, 40);
}

function statusTime(): string {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/**
 * The center editor — always visible, never a popup.
 *  - New note: just type; it autosaves and becomes the active editable note.
 *  - Click an item in the right list and it loads here and you edit it in place.
 */
export function Compose({
  connection,
  activeItem,
  items,
  createContent,
  updateContent,
  onUploadFiles,
  onRefresh,
  onUrls,
  onFirstSave,
  onNewNote,
}: Props) {
  const editing = activeItem !== null;
  const isFile = editing && (activeItem.type === "file" || !!activeItem.file);
  const isLink = editing && activeItem.type === "link";

  const [body, setBody] = useState(activeItem?.body ?? "");
  const [title, setTitle] = useState(activeItem?.title ?? "");
  const [state, setState] = useState<SaveState>("idle");
  const [status, setStatus] = useState(
    editing
      ? isFile
        ? "File selected — preview it, download it, or remove it from the list."
        : "Editing below — changes save automatically for everyone."
      : "Type to save — a new note appears for everyone on this network."
  );
  const [urlsActive, setUrlsActive] = useState(false);
  const [copied, setCopied] = useState(false);

  const draftRef = useRef<{ id: string; version: number } | null>(
    editing ? { id: activeItem.id, version: activeItem.version } : null
  );
  const bodyRef = useRef(body);
  const titleRef = useRef(title);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const online = connection === "connected";

  useEffect(() => {
    bodyRef.current = body;
    titleRef.current = title;
  }, [body, title]);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  const persist = useCallback(
    async (attempt = 0) => {
      const value = bodyRef.current;
      const valueTitle = titleRef.current;
      if (editing && isFile) return;
      if (!editing && !value.trim()) {
        setState("idle");
        setStatus("Type to save — a new note appears for everyone on this network.");
        return;
      }
      setState("saving");
      setStatus("Saving…");
      const cur = draftRef.current;
      try {
        if (!cur) {
          const res = await createContent("text", {
            title: valueTitle.trim() || deriveTitle(value),
            body: value,
          });
          if (res.ok && res.item) {
            draftRef.current = { id: res.item.id, version: res.item.version };
            setState("saved");
            setStatus("Saved · a new note — appears in the list for everyone.");
            onFirstSave(res.item);
          } else {
            setState("error");
            setStatus(res.error ?? "Could not save. Please try again.");
          }
          return;
        }
        const patch: { title?: string; body?: string } = {};
        patch.title = valueTitle.trim() || (value ? deriveTitle(value) : undefined);
        patch.body = value;
        const res = await updateContent(
          { id: cur.id, version: cur.version } as ContentItem,
          patch
        );
        if (res.ok && res.item) {
          draftRef.current = { id: cur.id, version: res.item.version };
          setState("saved");
          setStatus("Saved · syncing to every device…");
        } else {
          const fresh = items.find((i) => i.id === cur.id);
          if (fresh && attempt < 2) {
            draftRef.current = { id: fresh.id, version: fresh.version };
            await persist(attempt + 1);
          } else {
            setState("error");
            setStatus(res.error ?? "Could not save. Another device changed this — try again.");
          }
        }
      } catch {
        setState("error");
        setStatus("Could not save. Please try again.");
      }
    },
    [editing, isFile, createContent, updateContent, items, onFirstSave]
  );

  const scheduleSave = (next?: { body?: string; title?: string }) => {
    if (next?.body !== undefined) {
      setBody(next.body);
      bodyRef.current = next.body;
    }
    if (next?.title !== undefined) {
      setTitle(next.title);
      titleRef.current = next.title;
    }
    setState("saving");
    setStatus("Saving…");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void persist(), 750);
  };

  const resetToNew = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    onNewNote();
  };

  const clearEditor = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (editing) {
      setBody(activeItem.body ?? "");
      setTitle(activeItem.title ?? "");
      bodyRef.current = activeItem.body ?? "";
      titleRef.current = activeItem.title ?? "";
      setState("idle");
      setStatus("Reverted — changes since opening were discarded.");
    } else {
      setBody("");
      setTitle("");
      bodyRef.current = "";
      titleRef.current = "";
      setState("idle");
      setStatus("Cleared — your last note is still in the right list.");
    }
  };

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      setState("saved");
      setStatus("Copied to clipboard ✓");
    } catch {
      setStatus("Could not copy. Select and copy manually.");
    }
  };

  const downloadTxt = () => {
    const blob = new Blob([isLink ? activeItem.url ?? "" : body], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "note.txt";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const toggleUrls = () => {
    const next = !urlsActive;
    setUrlsActive(next);
    onUrls(next);
  };

  const isImage = activeItem?.file?.mime_type?.startsWith("image/");

  return (
    <div>
      {/* ── toolbar row (copy / urls / upload / download / refresh) ── */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <p className="hidden items-center gap-1.5 text-sm font-medium text-foreground/80 sm:flex">
            <span className="sr-only">
              LocalShare — sync text and files across every device on your network
            </span>
            {connection === "connected"
              ? editing
                ? "Editing…"
                : `${items.length} shared on this network`
              : "Reconnecting…"}
            <span className="typing-caret" aria-hidden="true" />
          </p>
          <SaveIndicator
            state={state}
            size="lg"
            label={
              state === "saving"
                ? "Saving…"
                : state === "saved"
                  ? "Saved"
                  : state === "error"
                    ? "Could not save"
                    : "Idle"
            }
          />
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            className={rankBtn}
            onClick={() => copyText(isLink ? activeItem.url ?? "" : body)}
            title="Copy"
          >
            <Copy />
            {copied ? "Copied!" : <span className="hidden sm:inline">Copy</span>}
          </button>
          <button
            type="button"
            className={cn(rankBtn, urlsActive && "bg-accent text-accent-foreground")}
            onClick={toggleUrls}
            aria-label="URLs"
            aria-pressed={urlsActive}
            title="Toggle links list"
          >
            <Link2 /> <span className="hidden sm:inline">URLs</span>
          </button>
          <button
            type="button"
            className={rankBtn}
            onClick={() => fileInputRef.current?.click()}
            aria-label="Upload"
            title="Upload files"
          >
            <Upload /> <span className="hidden sm:inline">Upload</span>
          </button>
          <button
            type="button"
            className={rankBtn}
            onClick={downloadTxt}
            aria-label="Download as .txt"
            title="Download .txt"
          >
            <Download /> <span className="hidden sm:inline">Download</span>
          </button>
          <button
            type="button"
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:hover:bg-accent/50"
            onClick={async () => {
              await onRefresh();
              setStatus(`Refreshed · ${items.length} shared on this network.`);
            }}
            aria-label="Refresh"
            title="Refresh"
          >
            <RefreshCw className="size-4" />
          </button>
        </div>
      </div>

      {/* ── editing context chip ──────────────────── */}
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          {editing ? (
            <>
              <SquarePen className="size-3.5 shrink-0" />
              <span className="truncate">Editing “{activeItem.title || "Untitled"}”</span>
            </>
          ) : (
            <>
              <SquarePen className="size-3.5 shrink-0 text-primary" />
              <span>New note — anything you type saves for everyone</span>
            </>
          )}
        </p>
        {editing && (
          <button
            type="button"
            onClick={resetToNew}
            className="shrink-0 rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input"
            title="Start a new note"
          >
            New note
          </button>
        )}
      </div>

      {/* ── the editable part ─────────────────────── */}
      {!isFile ? (
        <textarea
          className="savr-textarea w-full resize-y rounded-xl border border-input bg-background px-4 py-3 leading-relaxed text-foreground shadow-xs outline-none transition-colors placeholder:text-muted-foreground/50 focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
          rows={12}
          style={{ fontSize: "13pt", lineHeight: "1.6" }}
          placeholder={
            isLink ? "Paste the link here if it’s missing…" : editing ? "Start typing (or paste) to edit this note…" : "Start typing…"
          }
          aria-label="Editable content"
          value={body}
          onChange={(e) => scheduleSave({ body: e.target.value })}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files.length > 0) onUploadFiles(e.dataTransfer.files);
          }}
          onDragOver={(e) => e.preventDefault()}
          disabled={!online}
        />
      ) : (
        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-start gap-3">
            {isImage && activeItem.file ? (
              <img
                src={`/api/files/${activeItem.file.id}`}
                alt={activeItem.file.original_name}
                className="h-40 w-full rounded-lg object-contain bg-muted/40"
              />
            ) : (
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-muted/60 ring-1 ring-inset ring-border/40">
                <FileIcon className="size-5 text-primary" />
              </span>
            )}
          </div>
          <div className="mt-3 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-medium">{activeItem.file?.original_name}</p>
              <p className="text-xs text-muted-foreground">
                {activeItem.file?.size.toLocaleString()} bytes ·{" "}
                {activeItem.file?.mime_type} · updated{" "}
                {new Date(activeItem.updated_at).toLocaleTimeString()}
              </p>
            </div>
            {activeItem.file && (
              <a
                href={`/api/files/${activeItem.file.id}`}
                className={cn(rankBtn, "!text-xs") + " hover:!bg-accent"}
                download={activeItem.file.original_name}
                title="Download file"
              >
                <Download /> <span className="hidden sm:inline">Download</span>
              </a>
            )}
          </div>
          <p className="mt-2 text-xs text-muted-foreground/70">
            Files can’t be typed into — download them, or remove them from the list.
          </p>
        </div>
      )}

      {/* link editing extras */}
      {editing && isLink && (
        <div className="mt-2 flex items-center gap-2 rounded-lg border border-border/70 bg-background px-3 py-2 text-sm dark:bg-input/20">
          <ExternalLink className="size-4 shrink-0 text-muted-foreground" />
          {activeItem.url ? (
            <span className="min-w-0 flex-1 truncate text-muted-foreground">{activeItem.url}</span>
          ) : (
            <Input
              value={body}
              onChange={(e) => scheduleSave({ body: e.target.value })}
              placeholder="Paste URL…"
              aria-label="URL"
            />
          )}
          {activeItem.url && (
            <button
              type="button"
              className="text-xs font-medium text-primary hover:underline"
              onClick={() => copyText(activeItem.url!)}
            >
              Copy URL
            </button>
          )}
        </div>
      )}

      {/* status row */}
      <div className="flex items-center justify-between py-1.5">
        <div className="flex items-center gap-2">
          <SaveIndicator
            state={state}
            size="sm"
            label={
              state === "saving"
                ? "Saving…"
                : state === "saved"
                  ? "Saved"
                  : state === "error"
                    ? "Could not save"
                    : "Idle"
            }
          />
          <span className="flex items-center text-xs text-muted-foreground/70" aria-live="polite">
            {status}
          </span>
        </div>
        <button
          type="button"
          onClick={clearEditor}
          className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          title={editing ? "Revert this note" : "Clear"}
        >
          <Trash2 className="size-3" /> {editing ? "Revert" : "Clear"}
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) onUploadFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}