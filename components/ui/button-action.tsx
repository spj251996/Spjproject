import type { ReactNode } from "react";

/* DESIGN.md → Components → UI → `button-action`.

   Element choice follows the described behavior, not the name: the entry specifies handing off to
   an external destination (Google Maps), which is navigation — so the `href` form
   renders an anchor with no handler and needs no client boundary.

   The `onClick` form exists because DESIGN.md → `timeline-node` composes "a `button-action` to open
   the gallery", which this entry's own "never opens an in-page view" forbids. The contradiction is
   reported as drift; rendering both statements requires both elements, and duplicating the visual
   spec into a second component would have been the worse resolution. This file still takes no
   `'use client'` — a caller supplying `onClick` is the client boundary.

   The engraved rule is two horizontal borders, not two pseudo-elements: `border-y` IS the pair of
   hairlines the doc describes. The doc's "no border" means no box around the control, which holds —
   there is no left or right edge and no radius.

   The element is the hit area and nothing else: transparent, borderless, at least
   `{touch-target}` each way. The rules, the mark and the label sit on an inner span, so the
   hairlines can hug the word while the target stays full size. The span's padding sets the rules:
   `{spacing.space-sm}` sideways, so they overrun the label and read as rules rather than as an
   underline, and `{spacing.space-3xs}` above and below, so they sit close to the word.

   Hover is the doc's own sentence and nothing more — rules and label to `{colors.ink}`, the space
   between them warmed. It is read off the element (`group-hover`), so the whole target triggers it.
   Focus takes the global ring on the element only; the doc gives focus no color change of its
   own, so none is invented here. The transition sits on the inner span and carries its own
   reduced-motion gate at the source.

   The transitioned properties are named rather than using `transition-colors`, which in Tailwind v4
   includes `outline-color`. That made the focus ring FADE IN over the hover duration, starting from
   `currentColor` — measured at 0ms, 120ms and 520ms after focus, the ring ran gold → part-way → ink.
   A focus indicator must be correct on the frame it appears, and for that whole fade it sat below the
   3:1 an indicator needs. Hover colors transition; the ring does not. */

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
  /* One section mark set before the label, which takes the label's colour. The marks are already
     hidden from assistive technology (components/icons/icon-base.tsx), so the name stays the label. */
  mark?: ReactNode;
  /* For actions that share a visible label, such as the four map links. It must begin with that
     label, so a speech user saying what they see still reaches the control. */
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
    /* An external hand-off, so a new tab keeps the invitation open behind it. */
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
