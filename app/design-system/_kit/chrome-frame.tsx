import type { ReactNode } from "react";

/* curate-gallery scaffold kit — ChromeFrame (skill → references/scaffold-kit.md).

   `transform: translateZ(0)` is the entire mechanism: it makes the frame a CSS containing block, so
   `position: fixed` descendants resolve to the frame instead of the viewport. Without it
   `thread-overlay` and `paper-base` — both `fixed inset-0` — escape any bounded demo and cover the
   page. Frame surface + border come from DESIGN.md: the ivory base as the ground a chrome layer sits
   over, outlined with the documented divider (`{stroke.divider}` 1px in `{colors.accent-gold}`),
   which is this system's only stated hairline. */

interface ChromeFrameProps {
  /** Explicit px height. REQUIRED whenever a `position: fixed` child must be bounded; omit for flow content. */
  height?: number;
  /** Explicit px width; omit to fill the column (the Specimen children container stretches). */
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
      className={`relative overflow-hidden border-(length:--stroke-divider) border-accent-gold bg-surface-base ${className ?? ""}`}
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
