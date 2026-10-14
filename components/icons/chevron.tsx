import { IconBase } from "./icon-base";

/* The viewer's previous / next mark (DESIGN.md → Components → `photo-viewer`). Drawn rather than
   set as a ‹ › character, which reads tiny at any type size the header can carry. It points right;
   `flip` mirrors it for previous rather than drawing a second glyph. */

export function ChevronIcon({
  size,
  flip = false,
  className,
}: {
  size?: number;
  flip?: boolean;
  className?: string;
}) {
  return (
    <IconBase className={className} size={size} viewBox="0 0 14 24">
      <path
        d="M 3,3 L 11,12 L 3,21"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        transform={flip ? "matrix(-1 0 0 1 14 0)" : undefined}
      />
    </IconBase>
  );
}
