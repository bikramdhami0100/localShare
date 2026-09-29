"use client";

import { useEffect, useMemo, useState } from "react";
import { ShieldAlert, LayoutGrid, FileText, Link2, File } from "lucide-react";
import { useDevice } from "@/hooks/useDevice";
import { useSharedSpace } from "@/hooks/useSharedSpace";
import { Header } from "@/components/Header";
import { Compose } from "@/components/Compose";
import { CategoryRow, FolderRow, SidebarCard, EmptyState } from "@/components/ContentCard";
import { AddContentModal } from "@/components/AddContentModal";
import { NoticeStack } from "@/components/NoticeStack";
import { Spinner } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import type { ContentItem } from "@/types";

type AddTarget = { mode: "text" | "link" | "file" | "folder" } | null;
type Category = "all" | "text" | "link" | "file";
type SortKey = "newest" | "oldest" | "updated" | "title";

export default function HomePage() {
  const { device, setDisplayName } = useDevice();
  const space = useSharedSpace(device.id, device.displayName);

  const [add, setAdd] = useState<AddTarget>(null);
  const [category, setCategory] = useState<Category>("all");
  const [viewFolder, setViewFolder] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");

  const { items, folders } = space;
  const offline = space.connection === "offline";

  /* ---------- active item ---------- */
  const activeItem = useMemo(
    () => (activeId ? items.find((c) => c.id === activeId) ?? null : null),
    [items, activeId]
  );

  useEffect(() => {
    if (activeId && !items.some((c) => c.id === activeId)) setActiveId(null);
  }, [items, activeId]);

  /* ---------- filtering (right list) ---------- */
  const visibleItems = useMemo(() => {
    let list = [...items];
    if (category !== "all") list = list.filter((c) => c.type === category);
    if (viewFolder) list = list.filter((c) => c.folder_id === viewFolder);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.body.toLowerCase().includes(q) ||
          (c.url ?? "").toLowerCase().includes(q) ||
          (c.file?.original_name ?? "").toLowerCase().includes(q)
      );
    }
    const s: Record<SortKey, (a: ContentItem, b: ContentItem) => number> = {
      newest: (a, b) => b.created_at.localeCompare(a.created_at),
      oldest: (a, b) => a.created_at.localeCompare(b.created_at),
      updated: (a, b) => b.updated_at.localeCompare(a.updated_at),
      title: (a, b) => a.title.localeCompare(b.title),
    };
    list.sort(s[sort]);
    return list;
  }, [items, category, viewFolder, search, sort]);

  const counts = useMemo(() => {
    const c = { all: items.length, text: 0, link: 0, file: 0 };
    const f = new Map<string, number>();
    for (const it of items) {
      if (it.type === "text") c.text++;
      else if (it.type === "link") c.link++;
      else if (it.type === "file") c.file++;
      if (it.folder_id) f.set(it.folder_id, (f.get(it.folder_id) ?? 0) + 1);
    }
    return { c, f };
  }, [items]);

  const searching = search.trim() !== "";

  const uploadMany = async (files: FileList | File[]) => {
    for (const file of Array.from(files)) {
      await space.uploadFile(file, viewFolder, () => {});
    }
  };

  const handleDelete = async (item: ContentItem) => {
    setConfirmingId(null);
    await space.deleteContent(item);
  };

  const handleDownload = (item: ContentItem) => {
    if (!item.file) return;
    const a = document.createElement("a");
    a.href = space.downloadUrl(item);
    a.download = item.file.original_name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const selectCategory = (c: Category) => {
    setCategory(c);
    setViewFolder(null);
  };

  const selectFolder = (id: string | null) => {
    setViewFolder(id);
  };

  return (
    <>
      <Header connection={space.connection} onAdd={() => setAdd({ mode: "text" })} />

      <main id="main-content" className="flex-1 py-4">
        <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-5 px-3 sm:px-4 lg:flex-row lg:gap-6 lg:px-6">
          {/* ─────────── LEFT: categories & folders ─────────── */}
          <aside aria-label="Collected" className="lg:w-52 lg:shrink-0">
            <nav className="space-y-5">
              <div>
                <p className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                  Collected
                </p>
                <ul className="no-scrollbar flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
                  <CategoryRow
                    icon={LayoutGrid}
                    label="All"
                    count={counts.c.all}
                    active={category === "all" && !viewFolder}
                    onClick={() => selectCategory("all")}
                  />
                  <CategoryRow
                    icon={FileText}
                    label="Notes"
                    count={counts.c.text}
                    active={category === "text" && !viewFolder}
                    onClick={() => selectCategory("text")}
                  />
                  <CategoryRow
                    icon={Link2}
                    label="Links"
                    count={counts.c.link}
                    active={category === "link" && !viewFolder}
                    onClick={() => selectCategory("link")}
                  />
                  <CategoryRow
                    icon={File}
                    label="Files"
                    count={counts.c.file}
                    active={category === "file" && !viewFolder}
                    onClick={() => selectCategory("file")}
                  />
                </ul>
              </div>

              {folders.length > 0 && (
                <div>
                  <p className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                    Folders
                  </p>
                  <ul className="no-scrollbar flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
                    {folders.map((f) => (
                      <FolderRow
                        key={f.id}
                        folder={f}
                        count={counts.f.get(f.id) ?? 0}
                        active={viewFolder === f.id}
                        onClick={() => selectFolder(viewFolder === f.id ? null : f.id)}
                      />
                    ))}
                  </ul>
                </div>
              )}
            </nav>
          </aside>

          {/* ─────────── CENTER: the editable part (never a popup) ─────────── */}
          <section className="min-w-0 flex-1" aria-label="Editor">
            <p className="mb-3 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-600 dark:text-amber-400">
              <ShieldAlert className="size-3.5 shrink-0 text-amber-500" aria-hidden="true" />
              Anyone with access to this network can view, edit and delete this shared content.
            </p>

            <Compose
              key={activeId ?? "new"}
              connection={space.connection}
              activeItem={activeItem}
              items={space.items}
              createContent={space.createContent}
              updateContent={space.updateContent}
              onUploadFiles={uploadMany}
              onRefresh={space.refresh}
              onUrls={(v) => setCategory(v ? "link" : "all")}
              onFirstSave={(item) => setActiveId(item.id)}
              onNewNote={() => setActiveId(null)}
            />
          </section>

          {/* ─────────── RIGHT: the items list (search + sort on top) ─────────── */}
          <aside aria-label="Shared items" className="lg:w-[340px] lg:shrink-0">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search…"
                  aria-label="Search"
                  className="h-8 rounded-md pl-3 text-xs shadow-xs"
                />
              </div>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="h-8 rounded-md border border-border bg-background px-2 text-xs text-muted-foreground shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30 dark:border-input"
                aria-label="Sort"
              >
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
                <option value="updated">Updated</option>
                <option value="title">Title A→Z</option>
              </select>
            </div>

            <div className="mt-3 border-t border-border/60 pt-2">
              {!space.loaded ? (
                <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                  <Spinner /> Loading…
                </div>
              ) : visibleItems.length === 0 ? (
                <EmptyState searching={searching} folder={!!viewFolder} />
              ) : (
                <ul
                  className="no-scrollbar space-y-0.5 lg:max-h-[calc(100vh-170px)] lg:overflow-y-auto"
                  aria-label="Shared items"
                >
                  {visibleItems.map((item) => (
                    <SidebarCard
                      key={item.id}
                      item={item}
                      active={activeId === item.id}
                      confirming={confirmingId === item.id}
                      onSelect={() => {
                        setConfirmingId(null);
                        setActiveId(item.id);
                      }}
                      onDeleteClick={() => setConfirmingId(item.id)}
                      onDeleteConfirm={() => handleDelete(item)}
                      onDeleteCancel={() => setConfirmingId(null)}
                      onDownload={item.file ? () => handleDownload(item) : undefined}
                    />
                  ))}
                </ul>
              )}
            </div>
          </aside>
        </div>
      </main>

      <footer className="mt-auto border-t border-border/60 px-4 py-3">
        <div className="mx-auto flex w-full max-w-[1400px] flex-col items-center justify-between gap-2 text-xs text-muted-foreground sm:flex-row">
          <span className="flex items-center gap-1.5">
            Connected as{" "}
            <button
              onClick={() => {
                const name = window.prompt("Your device name shown to others:", device.displayName);
                if (name && name.trim()) setDisplayName(name.trim());
              }}
              className="font-medium text-foreground/80 underline-offset-2 hover:text-primary hover:underline"
            >
              {device.displayName}
            </button>
          </span>
          <span>Content lives on this host — it survives refresh, restart and disconnects.</span>
        </div>
      </footer>

      <AddContentModal
        key={add?.mode ?? "closed"}
        open={add !== null}
        initialMode={add?.mode ?? "text"}
        onClose={() => setAdd(null)}
        folders={folders}
        createContent={space.createContent}
        createFolder={(name) => space.createFolder(name)}
        uploadFile={space.uploadFile}
      />

      <NoticeStack notices={space.notices} />
    </>
  );
}