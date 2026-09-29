"use client";

import { memo } from "react";
import {
  FileText,
  Link2,
  File,
  Download,
  Trash2,
  Check,
  Image as ImageIcon,
  Folder as FolderIcon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import type { ContentItem, Folder } from "@/types";

function timeAgo(iso: string | null): string {
  if (!iso) return "recently";
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

/* --------------------------- left rail rows --------------------------- */

export function CategoryRow({
  icon: Icon,
  label,
  count,
  active,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        onClick={onClick}
        aria-pressed={active}
        className={cn(
          "flex w-full items-center gap-2 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
          active
            ? "bg-accent font-medium text-accent-foreground"
            : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
        )}
      >
        <Icon className={cn("size-4 shrink-0", active ? "text-primary" : "")} />
        <span className="flex-1 text-left">{label}</span>
        <span
          className={cn(
            "rounded-full px-1.5 text-[11px] font-medium tabular-nums",
            active ? "bg-primary/15 text-primary" : "text-muted-foreground/60"
          )}
        >
          {count}
        </span>
      </button>
    </li>
  );
}

export function FolderRow({
  folder,
  count,
  active,
  onClick,
}: {
  folder: Folder;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        onClick={onClick}
        aria-pressed={active}
        className={cn(
          "flex w-full items-center gap-2 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
          active
            ? "bg-accent font-medium text-accent-foreground"
            : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
        )}
      >
        <FolderIcon className={cn("size-4 shrink-0", active ? "text-primary" : "text-muted-foreground/70")} />
        <span className="flex-1 truncate text-left">{folder.name}</span>
        <span
          className={cn(
            "rounded-full px-1.5 text-[11px] font-medium tabular-nums",
            active ? "bg-primary/15 text-primary" : "text-muted-foreground/60"
          )}
        >
          {count}
        </span>
      </button>
    </li>
  );
}

/* --------------------------- right list card -------------------------- */

export const SidebarCard = memo(function SidebarCard({
  item,
  active,
  confirming,
  onSelect,
  onDeleteClick,
  onDeleteConfirm,
  onDeleteCancel,
  onDownload,
}: {
  item: ContentItem;
  active: boolean;
  confirming: boolean;
  onSelect: () => void;
  onDeleteClick: () => void;
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
  onDownload?: () => void;
}) {
  const isImage = item.type === "file" && !!item.file?.mime_type?.startsWith("image/");
  const Icon = item.type === "link" ? Link2 : item.type === "file" ? File : FileText;

  const meta: string[] = [];
  if (item.type === "file" && item.file) {
    meta.push(item.file.mime_type.toUpperCase());
    meta.push(
      item.file.size >= 1024 * 1024
        ? (item.file.size / 1024 / 1024).toFixed(1) + " MB"
        : Math.max(1, Math.round(item.file.size / 1024)) + " KB"
    );
  }
  if (item.type === "link" && item.url) {
    try {
      meta.push(new URL(item.url).hostname);
    } catch {
      meta.push("link");
    }
  }
  meta.push(timeAgo(item.updated_at));

  return (
    <li
      className={cn(
        "group flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors",
        active
          ? "border-primary/50 bg-accent/50"
          : "border-transparent hover:border-border/70 hover:bg-muted/40"
      )}
    >
      {isImage && item.file ? (
        <img
          src={`/api/files/${item.file.id}`}
          alt={item.file.original_name}
          className="h-9 w-9 shrink-0 rounded-md object-cover"
        />
      ) : (
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted/60 ring-1 ring-inset ring-border/40",
            item.type === "text" && "text-foreground/80",
            item.type === "link" && "text-sky-400",
            item.type === "file" && "text-primary"
          )}
        >
          <Icon className="size-4" />
        </span>
      )}

      {confirming ? (
        <div className="flex min-w-0 flex-1 items-center gap-1">
          <span className="text-xs text-muted-foreground">Delete?</span>
          <button
            onClick={onDeleteConfirm}
            className="inline-flex items-center gap-0.5 rounded-full bg-destructive px-2 py-1 text-xs font-medium text-destructive-foreground hover:opacity-90"
          >
            <Check className="size-3" /> Yes
          </button>
          <button
            onClick={onDeleteCancel}
            className="rounded-full px-2 py-1 text-xs text-muted-foreground hover:bg-accent"
          >
            Cancel
          </button>
        </div>
      ) : (
        <>
          <button className="min-w-0 flex-1" onClick={onSelect} title="Edit in center">
            <p className={cn("truncate text-sm", active ? "font-semibold text-foreground" : "font-medium text-foreground/90")}>
              {item.title || "Untitled"}
            </p>
            <p className="truncate text-xs text-muted-foreground/70">{meta.join(" • ") || "…"}</p>
          </button>
          <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
            {item.file && onDownload && (
              <button
                onClick={onDownload}
                className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                title="Download"
                aria-label={`Download ${item.file.original_name}`}
              >
                <Download className="size-3.5" />
              </button>
            )}
            <button
              onClick={onDeleteClick}
              className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-destructive"
              title="Delete"
              aria-label={`Delete ${item.title ?? "item"}`}
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        </>
      )}
    </li>
  );
});

/* ------------------------------ empty state --------------------------- */

export function EmptyState({ searching, folder }: { searching: boolean; folder?: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted/60 ring-1 ring-inset ring-border/40">
        <ImageIcon className="size-5 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium">{searching ? "No matches" : folder ? "This folder is empty" : "Nothing here yet"}</p>
      <p className="max-w-[24ch] text-xs text-muted-foreground">
        {searching
          ? "Try a different search."
          : "Type in the editor — it appears here for everyone."}
      </p>
    </div>
  );
}

/* keep old exports in sync for any leftover references */
export function FolderChip({ folder, itemCount, active, onClick }: { folder: { id: string; name: string }; itemCount: number; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        active ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground hover:bg-accent"
      )}
    >
      <FolderIcon className="size-3.5" /> {folder.name}
      <span className="rounded-full bg-muted px-1.5 text-[10px] font-semibold">{itemCount}</span>
    </button>
  );
}