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

   Foreground color is inferred: the doc states the `{colors.ink}` fill and the `{typography.action}`
   role but no text color. `{colors.ink-on-contrast}` is the doc's own primary text on the deep-green
   ground, and the fill is that same green. Padding takes the two endpoints of the stated
   16px–24px range rather than a value invented between them. */

const actionClassName =
  "type-action inline-flex min-h-(--touch-target) min-w-(--touch-target) items-center justify-center rounded-sm bg-ink px-space-md py-space-sm text-center text-ink-on-contrast";

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
