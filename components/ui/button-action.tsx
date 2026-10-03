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
  "type-action inline-flex items-center gap-space-xs text-accent-gold",
  "px-space-sm py-space-3xs",
  /* Hover thickens the mark optically — a heavier cut would widen the text and shift the disc
     sideways on every hover, which the mark's no-reflow requirement forbids. */
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

/* Justification is a lookup rather than a class the caller appends, because two utilities setting
   the same property resolve by stylesheet order, not by the order they are written — so an appended
   `justify-start` would win or lose unpredictably. Exactly one is ever emitted.

   `stretchStart` exists for a STACK of actions: two centred rows whose labels differ in width put
   their discs at different x, which reads as a ragged bulleted list (couple, 2026-10-02). Centred is
   the default, and every other caller takes it. */
const ALIGN = {
  center: "justify-center",
  /* `w-full` as well as the justification: the target itself is `justify-center`, so without it this
     span is sized to its own content and centred inside a stretched target — the justification then
     has no room to act and the discs stay apart. Measured: 19.65px apart with `justify-start` alone.
     Hence the name: this member only does anything inside a stretched parent (`items-stretch`), and a
     caller who passes it without one gets the ragged pair back with nothing warning them. */
  stretchStart: "w-full justify-start",
} as const;

/* The mark sits on its own raised disc (owner, 2026-09-28), replacing the pair of hairline rules
   that used to flank the label. The disc is the stock's own surface and shadow, so it reads as a
   small piece of paper laid on the card rather than as a control borrowed from an application. */
const discClassName = [
  "inline-flex shrink-0 items-center justify-center rounded-full",
  /* The token as a bare colour, not the `bg-surface-elevated` utility: that utility also lays the
     stock's grain, and a tile sized for a whole sheet reads as noise inside a 44px circle (owner,
     2026-09-28). The disc wants the surface's colour and its shadow, nothing else. */
  "size-(--touch-target) bg-(--color-surface-elevated) shadow-mount",
  /* Scaled here rather than by raising each caller's `size`: `IconBase` derives its box from the
     drawing's own DIAGONAL, so equal `size` values across different marks do not give equal
     rendered boxes, and a uniform scale keeps each mark's aspect while filling more of the disc. */
  "[&_svg]:[transform:scale(1.65)]",
].join(" ");

type ButtonActionProps = {
  children: ReactNode;
  className?: string;
  /** Where the mark and label sit within the target. `stretchStart` requires a stretched parent. */
  align?: keyof typeof ALIGN;
  /* Marks are already hidden from assistive technology (icons/icon-base.tsx), so the accessible
     name stays the label. */
  mark?: ReactNode;
  "aria-label"?: string;
} & ({ href: string; onClick?: never } | { href?: never; onClick: () => void });

export function ButtonAction({
  children,
  className,
  align = "center",
  mark,
  "aria-label": accessibleName,
  href,
  onClick,
}: ButtonActionProps) {
  const composed = `${targetClassName} ${className ?? ""}`;
  const label = (
    <span className={`${markClassName} ${ALIGN[align]}`}>
      {mark !== undefined && <span className={discClassName}>{mark}</span>}
      {children}
    </span>
  );

  if (href !== undefined) {
    /* A web destination opens in its own tab so the invitation is never navigated away from; a
       `tel:` handoff leaves the browser entirely, and a new tab would be left behind empty. A
       root-relative href is this site, and replaces the page rather than opening beside it.
       `//host` is excluded explicitly: it starts with `/` but is an EXTERNAL destination, so
       treating it as same-tab would drop `rel="noopener noreferrer"` along with the new tab. */
    const sameTab =
      href.startsWith("tel:") ||
      (href.startsWith("/") && !href.startsWith("//"));
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
