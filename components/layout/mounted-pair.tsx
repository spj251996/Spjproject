import type { ReactNode } from "react";
import type { MeasuredFit } from "./mounted-sheet-frame";
import {
  FRAME_CLASS,
  frameScopeClass,
  mountedSheetFrameCss,
} from "./mounted-sheet-frame-css";

/* DESIGN.md → Foundations → Layout → `mounted-pair`.

   The mount is a single card creased down the middle and opened flat, and the two sheets are pasted
   onto its leaves. The gap between them is TWICE the mount's reveal, not once: each sheet is centred
   on its own leaf, so the sheet's reveal on the fold side meets the other sheet's at the crease.

   Given a section's measured fit, the pair is framed to the window. It sits side by side only in a
   landscape window whose mount shows; everywhere else the two sheets stack and each leaf becomes a
   card's mount of its own. Every step is in the generated stylesheet, which is also why the leaves
   and the mount carry both surface utilities here — the stylesheet strips whichever one a layout does
   not show, rather than a layout having to restore one. The frame contracts in mounted-sheet.tsx
   bind this caller too.

   Without a fit the pair is the static form below, for a specimen box: stacked below md, side by
   side on the mount above it. Each stacked sheet then swaps `shadow-sheet` for `shadow-mount`,
   because standing on the ground it does the lifting the mount was doing.

   The leaves carry `relative` so they paint above the crease, which is absolutely positioned on the
   mount and would otherwise sit over them.

   No state, no effects, no handlers, so no client boundary. */

interface MountedPairProps {
  /* Exactly two — the layout is a pair, not a list. */
  children: [ReactNode, ReactNode];
  /* The section's measured fit — the taller of the two sheets — which frames the pair. */
  fit?: MeasuredFit;
}

const CREASE_GEOMETRY =
  "pointer-events-none absolute inset-y-0 left-1/2 w-(--crease-width) -translate-x-1/2 bg-(image:--crease-fill)";

/* The static form's mount ladder, matching `mounted-sheet`: no mount below md, 12px at md, 16px at
   lg, with the gap twice the reveal at each step. */
const MOUNT =
  "relative flex flex-col gap-space-md md:flex-row md:gap-space-md lg:gap-space-lg md:bg-surface-mount md:p-space-xs lg:p-space-sm md:shadow-mount";

const SHEET =
  "relative flex-1 bg-surface-elevated p-space-lg shadow-mount md:p-space-2xl md:shadow-sheet lg:p-space-3xl";

export function MountedPair({ children, fit }: MountedPairProps) {
  const [first, second] = children;

  if (fit !== undefined) {
    const leaf = `${FRAME_CLASS.leaf} relative bg-surface-mount shadow-mount`;
    const sheet = `${FRAME_CLASS.sheet} bg-surface-elevated shadow-sheet`;
    return (
      <>
        <style>{mountedSheetFrameCss(fit, false, "pair")}</style>
        <div className={frameScopeClass(fit)}>
          <div className={FRAME_CLASS.box}>
            <div
              className={`${FRAME_CLASS.mount} relative bg-surface-mount shadow-mount`}
            >
              <div
                aria-hidden
                className={`${FRAME_CLASS.crease} ${CREASE_GEOMETRY}`}
              />
              <div className={leaf}>
                <div className={sheet}>{first}</div>
              </div>
              <div className={leaf}>
                <div className={sheet}>{second}</div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <div className={MOUNT}>
      <div aria-hidden className={`hidden md:block ${CREASE_GEOMETRY}`} />
      <div className={SHEET}>{first}</div>
      <div className={SHEET}>{second}</div>
    </div>
  );
}
