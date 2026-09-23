import type { ReactNode } from "react";

/* The `href` form is an anchor with no handler, so this file needs no client boundary; a caller
   supplying `onClick` (the timeline-node gallery action) is the boundary.

   Transitions name their properties instead of `transition-colors`, which in Tailwind v4 includes
   `outline-color` and would fade the focus ring in from `currentColor`. */

const targetClassName =
  "group inline-flex items-center justify-center text-center min-h-(--touch-target) min-w-(--touch-target)";

/* The mark scales on hover, which makes this span a stacking context. It is not an ancestor of any
   botanical piece, so no blend is isolated (Background → Botanical Edge).

   Hover and press apply to the inner span rather than the target, so neither dims or transforms
   the focus ring the target draws. */
const markClassName = [
  "type-action inline-flex items-center justify-center gap-space-2xs text-accent-gold",
  "px-space-sm py-space-3xs",
  /* `currentColor` keeps the rules on the label's colour through every state. */
  "before:content-[''] before:shrink-0 before:w-space-sm before:h-(--stroke-divider) before:bg-current",
  "after:content-[''] after:shrink-0 after:w-space-sm after:h-(--stroke-divider) after:bg-current",
  /* Hover thickens the mark optically — a heavier cut would widen the text and shift the rules
     sideways on every hover, which the mark's no-reflow requirement forbids. */
  "group-hover:[transform:scale(1.06)]",
  "group-hover:[text-shadow:0.35px_0_0_currentColor,-0.35px_0_0_currentColor]",
  "group-hover:[&_svg]:[filter:drop-shadow(0_0_0.4px_currentColor)]",
  "group-hover:before:h-[calc(var(--stroke-divider)*1.6)]",
  "group-hover:after:h-[calc(var(--stroke-divider)*1.6)]",
  /* Press is the only feedback a touch device gets, so it is not gated on hover support. */
  "group-active:opacity-80",
  /* Every part of the transition is gated, the duration included: an ungated `transition-duration`
     leaves `transition-property` at its `all` initial value, so the mark still animates under
     reduced motion with nothing in the source saying so. */
  "motion-safe:transition-[transform,text-shadow,opacity] motion-safe:duration-(--duration-fast) motion-safe:ease-settle",
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
    <span className={markClassName}>
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
