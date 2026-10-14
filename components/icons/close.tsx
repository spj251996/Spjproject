import { IconBase } from "./icon-base";

/* The gallery's Close mark (DESIGN.md → Components → `photo-viewer`, `gallery-modal`), drawn at the
   chevron's stroke so the header's three marks read as one set. */

export function CloseIcon({
  size,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <IconBase className={className} size={size} viewBox="0 0 16 16">
      <path
        d="M 3,3 L 13,13 M 13,3 L 3,13"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth={2}
      />
    </IconBase>
  );
}
