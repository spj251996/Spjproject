import type { ReactNode } from "react";

/* The frame every glyph in the set shares. Not an icon itself and not a documented entry — the
   design doc names six marks, and this is only the structure they have in common.

   Sizing runs off the DIAGONAL, not width or height. The marks have very different proportions —
   the plate is 1.28 wide to tall, the map pin 0.65 — so matching any single dimension makes some
   read large and others small. Matching the diagonal gives them a common optical span.

   `nudge` is the per-glyph correction on top of that, derived from measured ink density: the church
   lays down 8.2% ink and the plate 21%, so at an equal span the church reads light and the plate
   heavy. The values live with each glyph rather than here.

   The marks are filled outline, not stroked line, so they carry no stroke token. They take their
   colour from the surface, which is how one file serves both the ivory and the green stock. */

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
