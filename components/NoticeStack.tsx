"use client";

import { CheckCircle2, XCircle, Info } from "lucide-react";
import type { Notice } from "@/hooks/useSharedSpace";

export function NoticeStack({ notices }: { notices: Notice[] }) {
  return (
    <div className="pointer-events-none fixed bottom-4 left-1/2 z-50 flex w-full max-w-md -translate-x-1/2 flex-col items-center gap-2 px-4">
      {notices.map((n) => {
        const Icon =
          n.kind === "success" ? CheckCircle2 : n.kind === "error" ? XCircle : Info;
        const cls =
          n.kind === "success"
            ? "border-emerald-500/40 text-emerald-200"
            : n.kind === "error"
              ? "border-destructive/50 text-destructive-foreground"
              : "border-border text-foreground";
        return (
          <div
            key={n.id}
            role="status"
            className={`pointer-events-auto flex w-full items-center gap-2 rounded-lg border bg-card/95 px-3 py-2 text-sm shadow-lg backdrop-blur ${cls}`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate">{n.text}</span>
          </div>
        );
      })}
    </div>
  );
}