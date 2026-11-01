import { IconBase } from "./icon-base";

/* The viewer's All photos mark — four tiles, for the grid it returns to (DESIGN.md → Components →
   `photo-viewer`). Stroked in the same style as Close and the chevrons, not at an exact matching
   rendered weight. */

export function GridIcon({
  size,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <IconBase className={className} size={size} viewBox="0 0 16 16">
      <g
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth={1.6}
      >
        <rect height={5} rx={1} width={5} x={2} y={2} />
        <rect height={5} rx={1} width={5} x={9} y={2} />
        <rect height={5} rx={1} width={5} x={2} y={9} />
        <rect height={5} rx={1} width={5} x={9} y={9} />
      </g>
    </IconBase>
  );
}
