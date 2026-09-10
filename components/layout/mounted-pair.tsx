import type { ReactNode } from "react";

/* DESIGN.md → Foundations → Layout → `mounted-pair`.

   The mount is a single card creased down the middle and opened flat, and the two sheets are pasted
   onto its leaves. The gap between them is TWICE the mount's reveal, not once: each sheet is centred
   on its own leaf, so the sheet's reveal on the fold side meets the other sheet's at the crease. The
   test is measurable — half the gap either equals the outer reveal or the sheets are off-centre.

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
   The gap is twice the reveal at each step, which is what centres each sheet on its leaf. */
const MOUNT =
  "relative flex flex-col gap-space-md md:flex-row md:gap-space-md lg:gap-space-lg md:bg-surface-mount md:p-space-xs lg:p-space-sm md:shadow-mount";

/* Inside the mount a sheet separates from the mount; stacked on the ground it does the lifting.
   Padding is the same ladder `mounted-sheet` uses — one rule across both layouts. */
const SHEET =
  "relative flex-1 bg-surface-elevated p-space-lg shadow-mount md:p-space-2xl md:shadow-sheet lg:p-space-3xl";

/* The fold, painted on the mount. The sheets are opaque and sit above it, so it is visible only
   inside the gap. It goes when the mount goes — an unfolded card has no fold. */
const CREASE =
  "pointer-events-none absolute inset-y-0 left-1/2 hidden w-(--crease-width) -translate-x-1/2 bg-(image:--crease-fill) md:block";

export function MountedPair({ children, className }: MountedPairProps) {
  const [first, second] = children;
  return (
    <div className={`${MOUNT} ${className ?? ""}`}>
      <div aria-hidden className={CREASE} />
      <div className={SHEET}>{first}</div>
      <div className={SHEET}>{second}</div>
    </div>
  );
}
