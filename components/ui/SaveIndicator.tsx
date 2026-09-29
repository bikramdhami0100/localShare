import { cn } from "@/lib/cn";

export type SaveState = "idle" | "saving" | "saved" | "error";

/**
 * ssavr-style autosave indicator: a ring with a pulsing halo that shows
 * a tick (saved), a spinning arc (saving) or a cross (error).
 */
export function SaveIndicator({
  state = "idle",
  size = "sm",
  className,
  label,
}: {
  state?: SaveState;
  size?: "sm" | "lg";
  className?: string;
  label: string;
}) {
  return (
    <span
      className={cn("save-ind", size === "sm" ? "size-sm" : "size-lg", className)}
      role="status"
      aria-live="polite"
      title={label}
    >
      <span className="save-halo" aria-hidden="true" />
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={cn(state === "saving" && "save-spin")}>
        <circle className="save-track" cx="12" cy="12" r="9" />
        {state === "saving" && <circle className="save-arc" cx="12" cy="12" r="9" />}
        {state === "saved" && <path className="save-tick" d="M8.2 12.8l2.5 2.5L16 9" />}
        {state === "error" && (
          <g className="save-cross">
            <path d="M9.4 9.4l5.2 5.2M14.6 9.4l-5.2 5.2" />
          </g>
        )}
      </svg>
      <span className="sr-only">{label}</span>
    </span>
  );
}