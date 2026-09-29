"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/Input";

export type TypeFilter = "all" | "text" | "link" | "file";
export type SortKey = "newest" | "oldest" | "updated" | "title";

interface Props {
  search: string;
  onSearch: (v: string) => void;
  typeFilter: TypeFilter;
  onTypeFilter: (v: TypeFilter) => void;
  sort: SortKey;
  onSort: (v: SortKey) => void;
  total: number;
}

const selectCls =
  "h-8 rounded-md border border-border bg-background px-2 pr-7 text-xs text-muted-foreground shadow-xs outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30 dark:border-input";

export function Toolbar({ search, onSearch, typeFilter, onTypeFilter, sort, onSort, total }: Props) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative w-full sm:max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search shared content…"
          aria-label="Search shared content"
          className="h-8 rounded-md pl-8 text-xs shadow-xs"
        />
      </div>
      <div className="flex items-center gap-1.5">
        <span className="mr-1 hidden text-xs text-muted-foreground/60 md:inline">{total} item{total === 1 ? "" : "s"}</span>
        <select value={typeFilter} onChange={(e) => onTypeFilter(e.target.value as TypeFilter)} className={selectCls} aria-label="Filter by type">
          <option value="all">All</option>
          <option value="text">Notes</option>
          <option value="link">Links</option>
          <option value="file">Files</option>
        </select>
        <select value={sort} onChange={(e) => onSort(e.target.value as SortKey)} className={selectCls} aria-label="Sort order">
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="updated">Updated</option>
          <option value="title">Title A→Z</option>
        </select>
      </div>
    </div>
  );
}