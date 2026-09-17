import type { ReactNode } from "react";

/* Diagonal sizing and `nudge`: DESIGN.md → Foundations → Iconography. */

interface IconBaseProps {
  /** Nominal optical span in px, measured on the diagonal. */
  size?: number;
  /** The glyph's crop box, in its source's own user space. */
  viewBox: string;
  /** Per-glyph optical correction. 1 is no correction. */
  nudge?: number;
  className?: string;
  children: ReactNode;
}

export function IconBase({
  size = 96,
  viewBox,
  nudge = 1,
  className,
  children,
}: IconBaseProps) {
  const [, , w, h] = viewBox.split(" ").map(Number);
  const scale = (size / Math.hypot(w, h)) * nudge;

  return (
    <svg
      aria-hidden
      className={className}
      fill="currentColor"
      height={h * scale}
      role="presentation"
      viewBox={viewBox}
      width={w * scale}
    >
      {children}
    </svg>
  );
}
