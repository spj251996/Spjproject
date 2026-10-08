import { IconBase } from "./icon-base";

/* A stock line drawing brought into the set: its ends are squared, where the source rounded them,
   and its weight is set to the set's own (DESIGN.md → Foundations → Iconography). Stroke-drawn like
   `map`, so the weight is the stroke itself rather than the drawn contour. */

export function ChatIcon({
  size,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <IconBase
      className={className}
      nudge={0.8492}
      size={size}
      viewBox="2.21 2.21 19.57 19.95"
    >
      <g
        fill="none"
        stroke="currentColor"
        strokeLinecap="butt"
        strokeLinejoin="miter"
        strokeWidth={0.695}
      >
        <path d="M8 8H16M8 12H13M3 10C3 4.64706 5.11765 3 12 3C18.8824 3 21 4.64706 21 10C21 15.3529 18.8824 17 12 17C11.6592 17 11.3301 16.996 11.0124 16.9876L7 21V16.4939C4.0328 15.6692 3 13.7383 3 10Z" />
      </g>
    </IconBase>
  );
}
