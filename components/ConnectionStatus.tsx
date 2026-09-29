"use client";

import { cn } from "@/lib/cn";
import type { ConnectionState } from "@/hooks/useSharedSpace";

// Small header chip: colored dot + word, like Simple.Savr's status chips.
export function ConnectionStatus({
  state,
  className,
}: {
  state: ConnectionState;
  className?: string;
}) {
  const map = {
    connected: { dot: "bg-emerald-500", text: "Live", label: "Connected to shared space" },
    reconnecting: { dot: "bg-amber-500", text: "Reconnecting", label: "Reconnecting to shared space" },
    offline: { dot: "bg-rose-500", text: "Offline", label: "Connection lost" },
  } as const;

  const s = map[state];
  return (
    <span
      role="status"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        state === "connected" && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
        state === "reconnecting" && "bg-amber-500/10 text-amber-600 dark:text-amber-400",
        state === "offline" && "bg-rose-500/10 text-rose-600 dark:text-rose-400",
        className
      )}
    >
      <span className={cn("relative flex h-2 w-2", state === "reconnecting" && "animate-pulse")}>
        {state === "offline" && <span className="absolute inset-0 rounded-full bg-rose-500" />}
        {state !== "offline" && (
          <span
            className={cn(
              "absolute inline-flex h-full w-full rounded-full opacity-50",
              s.dot,
              state === "reconnecting" && "animate-ping"
            )}
          />
        )}
        <span className={cn("relative inline-flex h-2 w-2 rounded-full", s.dot)} />
      </span>
      <span className="sr-only">{s.label}</span>
      <span>{s.text}</span>
    </span>
  );
}