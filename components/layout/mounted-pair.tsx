import type { ReactNode } from "react";

/* DESIGN.md → Foundations → Layout → `mounted-pair`.

   Two sheets sharing one mount. The reveal shows between them as well as around them, so the gap
   between the sheets is the same value as the mount's padding at every step of the ladder — that is
   what makes the pair read as two leaves of one card rather than two cards side by side.

   Below the md breakpoint the mount goes and the sheets stack. Each sheet then swaps `shadow-sheet`
   for `shadow-mount`: inside the mount a sheet only has to separate from the mount, but standing on
   the ground it has to do the lifting the mount was doing. This is the pair's version of the rule
   `mounted-sheet` states — the lift never disappears with the mount.

   No state, no effects, no handlers, so no client boundary. */

interface MountedPairProps {
  /* Exactly two — the layout is a pair, not a list. */
  children: [ReactNode, ReactNode];
  className?: string;
}

/* The mount's own ladder, matching `mounted-sheet`: no mount below md, 12px at md, 16px at lg.
   The gap tracks the padding so the reveal is even on all sides of both sheets. */
const MOUNT =
  "flex flex-col gap-space-md md:flex-row md:gap-space-xs lg:gap-space-sm md:bg-surface-mount md:p-space-xs lg:p-space-sm md:shadow-mount";

/* Inside the mount a sheet separates from the mount; stacked on the ground it does the lifting. */
const SHEET = "flex-1 bg-surface-elevated shadow-mount md:shadow-sheet";

export function MountedPair({ children, className }: MountedPairProps) {
  const [first, second] = children;
  return (
    <div className={`${MOUNT} ${className ?? ""}`}>
      <div className={SHEET}>{first}</div>
      <div className={SHEET}>{second}</div>
    </div>
  );
}
