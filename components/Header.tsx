"use client";

import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ConnectionStatus } from "@/components/ConnectionStatus";
import { useTheme } from "@/hooks/useTheme";
import type { ConnectionState } from "@/hooks/useSharedSpace";

function LogoMark() {
  return (
    <svg
      viewBox="0 0 96 96"
      className="h-9 w-9"
      aria-hidden="true"
      fill="none"
    >
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="96" y2="96">
          <stop offset="0%" stopColor="#FA7A7A" />
          <stop offset="100%" stopColor="#DC4245" />
        </linearGradient>
      </defs>
      <rect width="96" height="96" rx="21.5" fill="url(#lg)" />
      {/* packet: rounded white bar + dot */}
      <rect x="28" y="38" width="40" height="20" rx="6" fill="white" fillOpacity="0.92" />
      <circle cx="64" cy="48" r="5" fill="#DC4245" />
    </svg>
  );
}

export function Header({
  connection,
  onAdd,
}: {
  connection: ConnectionState;
  onAdd: () => void;
}) {
  const { dark, toggle } = useTheme();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/70 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4">
        <a href="/" className="flex items-center gap-2.5" aria-label="LocalShare home">
          <LogoMark />
          <span className="logo-wm hidden items-baseline font-bold text-[1.32rem] sm:flex">
            <span className="text-foreground">local</span>
            <span className="ml-0.5 text-[#EC5A5D]">share</span>
          </span>
        </a>

        <div className="flex items-center gap-1.5">
          <ConnectionStatus state={connection} />
          <Button size="sm" variant="chip" onClick={onAdd} className="ml-1 hidden sm:inline-flex">
            + Add
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={toggle}
            aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
          >
            {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
        </div>
      </div>
    </header>
  );
}