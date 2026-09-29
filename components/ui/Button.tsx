"use client";

import { cn } from "@/lib/cn";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "chip" | "ghost" | "destructive" | "outline";
type Size = "sm" | "md" | "lg" | "icon" | "iconSm";

// Subtle chips, like Simple.Savr's toolbar buttons — red appears on hover.
const variants: Record<Variant, string> = {
  primary:
    "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90",
  chip:
    "border border-border bg-background shadow-xs text-foreground hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
  outline:
    "border border-border bg-transparent text-foreground hover:bg-accent dark:hover:bg-accent/50",
  ghost: "text-foreground hover:bg-accent dark:hover:bg-accent/50",
  destructive:
    "text-destructive hover:bg-destructive/10 focus-visible:ring-destructive/40",
};

const sizes: Record<Size, string> = {
  sm: "h-8 gap-1.5 rounded-md px-3 text-xs",
  md: "h-9 gap-1.5 rounded-md px-4 text-sm",
  lg: "h-10 gap-2 rounded-md px-5 text-sm",
  icon: "size-8 rounded-md",
  iconSm: "size-7 rounded-md",
};

const base =
  "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap font-medium transition-all outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children?: ReactNode;
}

export function Button({
  variant = "chip",
  size = "md",
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    >
      {children}
    </button>
  );
}