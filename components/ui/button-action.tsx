import type { ReactNode } from "react";

/* The `href` form is an anchor with no handler, so this file needs no client boundary; a caller
   supplying `onClick` (the timeline-node gallery action) is the boundary.

   Transitions name their properties instead of `transition-colors`, which in Tailwind v4 includes
   `outline-color` and would fade the focus ring in from `currentColor`. */

const targetClassName =
  "group inline-flex items-center justify-center text-center min-h-(--touch-target) min-w-(--touch-target)";

const rulesClassName = [
  "type-action inline-flex items-center justify-center gap-space-2xs",
  "border-y-(length:--stroke-divider) border-accent-gold text-accent-gold",
  "px-space-sm py-space-3xs",
  "transition-[color,background-color,border-color] duration-(--duration-fast) ease-settle motion-reduce:transition-none",
  "group-hover:border-ink group-hover:bg-accent-gold/10 group-hover:text-ink",
].join(" ");

type ButtonActionProps = {
  children: ReactNode;
  className?: string;
  /* Marks are already hidden from assistive technology (icons/icon-base.tsx), so the accessible
     name stays the label. */
  mark?: ReactNode;
  "aria-label"?: string;
} & ({ href: string; onClick?: never } | { href?: never; onClick: () => void });

export function ButtonAction({
  children,
  className,
  mark,
  "aria-label": accessibleName,
  href,
  onClick,
}: ButtonActionProps) {
  const composed = `${targetClassName} ${className ?? ""}`;
  const label = (
    <span className={rulesClassName}>
      {mark}
      {children}
    </span>
  );

  if (href !== undefined) {
    return (
      <a
        aria-label={accessibleName}
        className={composed}
        href={href}
        rel="noopener noreferrer"
        target="_blank"
      >
        {label}
      </a>
    );
  }

  return (
    <button
      aria-label={accessibleName}
      className={composed}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}
