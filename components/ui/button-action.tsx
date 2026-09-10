import type { ReactNode } from "react";

/* DESIGN.md → Components → UI → `button-action`.

   Element choice follows the described behavior, not the name: the entry specifies handing off to
   an external destination (Google Maps, phone, WhatsApp), which is navigation — so the `href` form
   renders an anchor with no handler and needs no client boundary.

   The `onClick` form exists because DESIGN.md → `timeline-node` composes "a `button-action` to open
   the gallery", which this entry's own "never opens an in-page view" forbids. The contradiction is
   reported as drift; rendering both statements requires both elements, and duplicating the visual
   spec into a second component would have been the worse resolution. This file still takes no
   `'use client'` — a caller supplying `onClick` is the client boundary.

   The engraved rule is two horizontal borders, not two pseudo-elements: `border-y` IS the pair of
   hairlines the doc describes. The doc's "no border" means no box around the control, which holds —
   there is no left or right edge and no radius.

   Padding is inferred: the doc states the hairlines, the type role and the hit area, but no padding
   for the engraved form. On-scale values are used so the rules overrun the label slightly, which is
   what makes them read as rules rather than as an underline. Reported as inferred.

   Hover is the doc's own sentence and nothing more — rules and label to `{colors.ink}`, the space
   between them warmed. Focus takes the global ring only; the doc gives focus no color change of its
   own, so none is invented here. The transition carries its own reduced-motion gate at the source.

   The transitioned properties are named rather than using `transition-colors`, which in Tailwind v4
   includes `outline-color`. That made the focus ring FADE IN over the hover duration, starting from
   `currentColor` — measured at 0ms, 120ms and 520ms after focus, the ring ran gold → part-way → ink.
   A focus indicator must be correct on the frame it appears, and for that whole fade it sat below the
   3:1 an indicator needs. Hover colors transition; the ring does not. */

const actionClassName = [
  "type-action inline-flex items-center justify-center text-center",
  "min-h-(--touch-target) min-w-(--touch-target)",
  "border-y-(length:--stroke-divider) border-accent-gold text-accent-gold",
  "px-space-sm py-space-xs",
  "transition-[color,background-color,border-color] duration-(--duration-fast) ease-settle motion-reduce:transition-none",
  "hover:border-ink hover:bg-accent-gold/10 hover:text-ink",
].join(" ");

type ButtonActionProps = {
  children: ReactNode;
  className?: string;
} & ({ href: string; onClick?: never } | { href?: never; onClick: () => void });

export function ButtonAction({
  children,
  className,
  href,
  onClick,
}: ButtonActionProps) {
  const composed = `${actionClassName} ${className ?? ""}`;

  if (href !== undefined) {
    return (
      <a className={composed} href={href}>
        {children}
      </a>
    );
  }

  return (
    <button className={composed} onClick={onClick} type="button">
      {children}
    </button>
  );
}
