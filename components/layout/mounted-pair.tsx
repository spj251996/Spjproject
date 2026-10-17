import type { ReactNode } from "react";
import type { MeasuredFit } from "./mounted-sheet-frame";
import { FRAME_CLASS, frameScopeClass } from "./mounted-sheet-frame-css";

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

/* THE FITTED PAIR'S PAINT. A pair is never the hero, so it is always mounted (DESIGN.md -> Foundations
   -> Layout -> `mounted-sheet` -> The card's two states). Which surface shows is decided by the generated
   stylesheet, which strips whichever one a layout does not reveal -- so both the mount and the leaf
   carry a fill here and the stylesheet picks. */
const PAIR_MOUNT_PAINT = `${CARD_CORNERS} bg-surface-mount shadow-mount`;

const PAIR_LEAF_PAINT = `${CARD_CORNERS} bg-surface-mount shadow-mount`;

const PAIR_SHEET_PAINT = `${CARD_CORNERS} bg-surface-elevated shadow-stock`;

/* The reveal ladder's rungs from `{breakpoints.md}` up, with the gap twice each one so both sheets
   sit centred on their own leaf. Below `{breakpoints.md}` the pair stacks and has no mount, so the
   base gap is two cards' spacing rather than a rung of the ladder.

   GEOMETRY ONLY, with the paint in its own constants below: one constant answering two questions has
   been ungatable for one of them three times in this codebase. */
const UNFITTED_MOUNT = `relative flex flex-col gap-space-md md:flex-row md:gap-space-md lg:gap-space-lg xl:gap-space-xl md:p-space-xs lg:p-space-sm xl:p-space-md`;

const UNFITTED_SHEET = `relative flex-1 p-space-lg md:p-space-2xl lg:p-space-3xl`;

/* The unfitted branch's paint. The mount keeps the `md:` prefixes the ladder had: below
   `{breakpoints.md}` a stacked specimen shows no mount, so its fill and cast appear from that breakpoint
   up. */
const UNFITTED_MOUNT_PAINT = `${CARD_CORNERS} md:bg-surface-mount md:shadow-mount`;

const UNFITTED_SHEET_PAINT = `${CARD_CORNERS} bg-surface-elevated shadow-mount md:shadow-stock`;

export function MountedPair({ children, fit }: MountedPairProps) {
  const [first, second] = children;

  if (fit !== undefined) {
    const leaf = `${FRAME_CLASS.leaf} relative ${PAIR_LEAF_PAINT}`;
    const sheet = `${FRAME_CLASS.sheet} ${PAIR_SHEET_PAINT}`;
    return (
      <div className={frameScopeClass(fit)}>
        <div className={FRAME_CLASS.box}>
          <div className={`${FRAME_CLASS.mount} relative ${PAIR_MOUNT_PAINT}`}>
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
    );
  }

  const unfittedMount = `${UNFITTED_MOUNT} ${UNFITTED_MOUNT_PAINT}`;
  const unfittedSheet = `${UNFITTED_SHEET} ${UNFITTED_SHEET_PAINT}`;
  return (
    <div className={unfittedMount}>
      <div aria-hidden className={`hidden md:block ${CREASE_GEOMETRY}`} />
      <div className={unfittedSheet}>{first}</div>
      <div className={unfittedSheet}>{second}</div>
    </div>
  );
}
