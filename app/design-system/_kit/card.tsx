import type { ReactNode } from "react";

/* The kit's one panel treatment, shared with ChromeFrame and the visualizers: the paper stock with
   its sheet shadow. */

interface CardProps {
  /** Token name or slug shown below the box. */
  label?: string;
  /** Merged into the inner box — the slot a ground override uses. */
  className?: string;
  children: ReactNode;
}

export function Card({ label, className, children }: CardProps) {
  return (
    <div className="flex flex-col gap-space-2xs">
      <div
        className={`flex min-h-space-3xl items-center justify-center bg-surface-elevated shadow-sheet p-space-md ${className ?? ""}`}
      >
        {children}
      </div>

      {label === undefined ? null : (
        <span className="type-body text-ink">{label}</span>
      )}
    </div>
  );
}
