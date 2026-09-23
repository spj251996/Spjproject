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
}

const CREASE_GEOMETRY =
  "pointer-events-none absolute inset-y-0 left-1/2 w-(--crease-width) -translate-x-1/2 bg-(image:--crease-fill)";

/* Named as `mounted-sheet.tsx` names it, so the two files state one shape once each. Every layer
   here takes it: the leaf is the mount that hugs its stock once the pair stacks, and it goes on
   casting `shadow-mount` in that shape either way. */
const CARD_CORNERS = "rounded-card";

/* The reveal ladder's rungs from `{breakpoints.md}` up, with the gap twice each one so both sheets
   sit centred on their own leaf. Below `{breakpoints.md}` the pair stacks and has no mount, so the
   base gap is two cards' spacing rather than a rung of the ladder. */
const MOUNT = `relative flex flex-col gap-space-md ${CARD_CORNERS} md:flex-row md:gap-space-md lg:gap-space-lg xl:gap-space-xl md:bg-surface-mount md:p-space-xs lg:p-space-sm xl:p-space-md md:shadow-mount`;

const SHEET = `relative flex-1 ${CARD_CORNERS} bg-surface-elevated p-space-lg shadow-mount md:p-space-2xl md:shadow-sheet lg:p-space-3xl`;

export function MountedPair({ children, fit }: MountedPairProps) {
  const [first, second] = children;

  if (fit !== undefined) {
    const leaf = `${FRAME_CLASS.leaf} relative ${CARD_CORNERS} bg-surface-mount shadow-mount`;
    const sheet = `${FRAME_CLASS.sheet} ${CARD_CORNERS} bg-surface-elevated shadow-sheet`;
    return (
      <>
        <style>{mountedSheetFrameCss(fit, false, "pair")}</style>
        <div className={frameScopeClass(fit)}>
          <div className={FRAME_CLASS.box}>
            <div
              className={`${FRAME_CLASS.mount} relative ${CARD_CORNERS} bg-surface-mount shadow-mount`}
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
