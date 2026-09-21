import type { ReactNode } from "react";
import type { MeasuredFit } from "./mounted-sheet-frame";
import {
  FRAME_CLASS,
  frameScopeClass,
  mountedSheetFrameCss,
} from "./mounted-sheet-frame-css";

/* With a fit, the generated stylesheet sets every layout step. The leaves and the mount carry both
   surface utilities because the stylesheet strips whichever one a layout does not show. The frame
   contracts in mounted-sheet.tsx bind this caller too.

   Without a fit, the static form is for a specimen box.

   The leaves carry `relative` so they paint above the absolutely positioned crease. */

interface MountedPairProps {
  children: [ReactNode, ReactNode];
  /* Measured from the taller of the two sheets. */
  fit?: MeasuredFit;
  /* Opt-in: the fit whose padding chain the stacked sheets borrow instead of their own tier
     steps. Only where the borrowed chain still reaches this section's smallest step, or the
     give-way rule is emitted and never matches (`mounted-sheet` → When space runs
     out). No section borrows. */
  stackedPadding?: MeasuredFit;
}

const CREASE_GEOMETRY =
  "pointer-events-none absolute inset-y-0 left-1/2 w-(--crease-width) -translate-x-1/2 bg-(image:--crease-fill)";

const MOUNT =
  "relative flex flex-col gap-space-md md:flex-row md:gap-space-md xl:gap-space-lg md:bg-surface-mount md:p-space-xs xl:p-space-sm md:shadow-mount";

const SHEET =
  "relative flex-1 bg-surface-elevated p-space-lg shadow-mount md:p-space-2xl md:shadow-sheet lg:p-space-3xl";

export function MountedPair({
  children,
  fit,
  stackedPadding,
}: MountedPairProps) {
  const [first, second] = children;

  if (fit !== undefined) {
    const leaf = `${FRAME_CLASS.leaf} relative bg-surface-mount shadow-mount`;
    const sheet = `${FRAME_CLASS.sheet} bg-surface-elevated shadow-sheet`;
    return (
      <>
        <style>
          {mountedSheetFrameCss(fit, false, "pair", stackedPadding)}
        </style>
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
