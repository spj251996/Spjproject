import type { ReactNode } from "react";

/* The `href` form is an anchor with no handler, so this file needs no client boundary; a caller
   supplying `onClick` (photo-row's View photos action) is the boundary.

   Transitions name their properties instead of `transition-colors`, which in Tailwind v4 includes
   `outline-color` and would fade the focus ring in from `currentColor`. */

const targetClassName =
  "group inline-flex items-center justify-center text-center min-h-(--touch-target) min-w-(--touch-target)";

/* The mark scales on hover, which makes this span a stacking context. It is not an ancestor of any
   botanical piece, so no blend is isolated (Background → Botanical Edge).

   Hover and press apply to the inner span rather than the target, so neither dims or transforms
   the focus ring the target draws. */
const markClassName = [
  "type-action inline-flex items-center text-accent-gold",
  /* Hover thickens the mark optically — a heavier cut would widen the text and shift it sideways on
     every hover, which the mark's no-reflow requirement forbids. */
  "group-hover:[transform:scale(1.06)]",
  "group-hover:[text-shadow:0.35px_0_0_currentColor,-0.35px_0_0_currentColor]",
  "group-hover:[&_svg]:[filter:drop-shadow(0_0_0.4px_currentColor)]",
  /* Press is the only feedback a touch device gets, so it is not gated on hover support. */
  "group-active:opacity-80",
  /* Every part of the transition is gated, the duration included: an ungated `transition-duration`
     leaves `transition-property` at its `all` initial value, so the mark still animates under
     reduced motion with nothing in the source saying so. */
  "motion-safe:transition-[transform,text-shadow,opacity] motion-safe:duration-(--duration-fast) motion-safe:ease-settle",
].join(" ");

/* The plain ground is the label alone, italic in the card's own written voice, with no paper: an
   action reads as part of the card, not as a control borrowed from an application. */
const plainMarkClassName = "gap-space-xs px-space-sm py-space-3xs";

/* THE PILL GROUND IS THE MAP ACTION'S ALONE (owner, 2026-10-30): a piece of the card's paper holding
   the mark and an upright label, so a guest reads "Get directions" as the way to the venue rather
   than as a line of the card's prose. It is paper, not a fill — the surface's colour and the mount
   shadow, at full radius. The colour is the token used bare, not the `bg-surface-elevated` utility:
   that utility also lays the stock's grain, and a tile sized for a whole sheet reads as noise
   inside a shape this small.

   The start and the gap are tight, and the label never wraps: with a wider start and gap it broke
   onto a second line on a 320px phone and the pill swelled into a 60px capsule. The end keeps
   space-sm, so the text is not cramped against the pill's edge (owner, 2026-10-30). */
const pillMarkClassName = [
  "rounded-full bg-(--color-surface-elevated) shadow-mount not-italic",
  "gap-space-3xs ps-space-3xs pe-space-sm py-space-3xs whitespace-nowrap",
].join(" ");

/* The mark's box carries no paper of its own (the disc's paper was retired 2026-10-30: the only
   mark sits on the pill). `--action-disc`, not `--touch-target`: this size is visual only. The
   target's own `min-h/min-w-(--touch-target)` holds the 44px hit area and must stay. */
const markBoxClassName = [
  "inline-flex shrink-0 items-center justify-center size-(--action-disc)",
  /* Scaled here rather than by raising each caller's `size`: `IconBase` derives its box from the
     drawing's own DIAGONAL, so equal `size` values across different marks do not give equal
     rendered boxes, and a uniform scale keeps each mark's aspect while filling more of the box.

     1.2 is 1.65 x 32/44 — the scale the 44px box carried, held in proportion as the box came down,
     so the mark keeps its share of it and reads as the same drawing rather than a crowded one.
     Move it with `--action-disc` or not at all. */
  "[&_svg]:[transform:scale(1.2)]",
].join(" ");

type ButtonActionProps = {
  children: ReactNode;
  className?: string;
  ground?: "plain" | "pill";
  /* Marks are already hidden from assistive technology (icons/icon-base.tsx), so the accessible
     name stays the label. */
  mark?: ReactNode;
  "aria-label"?: string;
} & ({ href: string; onClick?: never } | { href?: never; onClick: () => void });

export function ButtonAction({
  children,
  className,
  ground = "plain",
  mark,
  "aria-label": accessibleName,
  href,
  onClick,
}: ButtonActionProps) {
  const pill = ground === "pill";
  /* The focus ring is drawn on the target, so in the pill ground the target takes the pill's radius
     and the ring follows it instead of boxing it (owner, 2026-10-30). */
  const composed = `${targetClassName}${pill ? " rounded-full" : ""} ${className ?? ""}`;
  const label = (
    <span
      className={`${markClassName} ${pill ? pillMarkClassName : plainMarkClassName} justify-center`}
    >
      {mark !== undefined && <span className={markBoxClassName}>{mark}</span>}
      {children}
    </span>
  );

  if (href !== undefined) {
    /* A web destination opens in its own tab so the invitation is never navigated away from. A
       root-relative href is this site, and replaces the page rather than opening beside it.
       `//host` is excluded explicitly: it starts with `/` but is an EXTERNAL destination, so
       treating it as same-tab would drop `rel="noopener noreferrer"` along with the new tab. */
    const sameTab = href.startsWith("/") && !href.startsWith("//");
    return (
      <a
        aria-label={accessibleName}
        className={composed}
        href={href}
        rel={sameTab ? undefined : "noopener noreferrer"}
        target={sameTab ? undefined : "_blank"}
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
