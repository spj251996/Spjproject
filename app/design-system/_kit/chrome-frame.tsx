import type { ReactNode } from "react";

/* `transform: translateZ(0)` makes the frame a containing block, so `position: fixed` descendants
   resolve to the frame instead of the viewport. Without it `thread-overlay` escapes the demo and
   covers the page. */

interface ChromeFrameProps {
  /** Explicit px height — a per-demo gallery layout constant, not a design token. Required whenever a
      `position: fixed` child must be bounded; omit for flow content. */
  height?: number;
  /** Explicit px width — a per-demo gallery layout constant. Omit to fill the column. */
  width?: number;
  /** True when the framed component duplicates a live landmark elsewhere on the page. */
  ariaHidden?: boolean;
  className?: string;
  children: ReactNode;
}

export function ChromeFrame({
  height,
  width,
  ariaHidden,
  className,
  children,
}: ChromeFrameProps) {
  return (
    <div
      aria-hidden={ariaHidden}
      className={`relative overflow-hidden bg-surface-elevated shadow-stock ${className ?? ""}`}
      style={{
        transform: "translateZ(0)",
        height,
        width,
        maxWidth: "100%",
      }}
    >
      {children}
    </div>
  );
}
