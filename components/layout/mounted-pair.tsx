import type { ReactNode } from "react";
import type { FramePaint, MeasuredFit } from "./mounted-sheet-frame";
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
  /** Which of the card's paints to apply, as `mounted-sheet` takes it. A pair has only two of the
      three: `"mount"`, today's painted pair and the default, and `"stock"`, the thread lab's
      mountless stock. `"none"` throws -- the unpainted card is the hero's alone and a pair is never
      the hero. */
  paint?: FramePaint;
}

const CREASE_GEOMETRY =
  "pointer-events-none absolute inset-y-0 left-1/2 w-(--crease-width) -translate-x-1/2 bg-(image:--crease-fill)";

/* Named as `mounted-sheet.tsx` names it, so the two files state one shape once each. Every layer
   here takes it: the leaf is the mount that hugs its stock once the pair stacks, and it goes on
   casting `shadow-mount` in that shape either way. */
const CARD_CORNERS = "rounded-card";

/* THE FITTED PAIR'S PAINT, per paint state. Which of these shows is decided by the generated
   stylesheet, which strips whichever surface a layout does not reveal -- so both the mount and the leaf
   carry a fill here and the stylesheet picks.

   Under `"stock"` the LEAF is the plate: it takes the stock's fill, the corners and the composed cast,
   and the mount is stripped side by side so the band between the plates shows the page's own ground
   (DESIGN.md -> Foundations -> Layout -> `mounted-sheet` -> The card's three paints). `"none"` throws
   above, so its arms are unreachable and exist only to complete the record. */
const PAIR_MOUNT_PAINT: Record<FramePaint, string> = {
  mount: `${CARD_CORNERS} bg-surface-mount shadow-mount`,
  stock: `${CARD_CORNERS} bg-surface-mount shadow-mount`,
  none: "",
};

const PAIR_LEAF_PAINT: Record<FramePaint, string> = {
  mount: `${CARD_CORNERS} bg-surface-mount shadow-mount`,
  stock: `${CARD_CORNERS} bg-surface-elevated shadow-mounted-stock`,
  none: "",
};

const PAIR_SHEET_PAINT: Record<FramePaint, string> = {
  mount: `${CARD_CORNERS} bg-surface-elevated shadow-stock`,
  stock: "",
  none: "",
};

/* The reveal ladder's rungs from `{breakpoints.md}` up, with the gap twice each one so both sheets
   sit centred on their own leaf. Below `{breakpoints.md}` the pair stacks and has no mount, so the
   base gap is two cards' spacing rather than a rung of the ladder.

   GEOMETRY ONLY, with the paint in its own records below. They were one string until the review found
   that the unfitted branch took a `paint` argument and ignored it: `<MountedPair paint="stock">` with no
   fit rendered a fully mount-painted pair, with `tsc` clean and every gate green, because the generator
   -call scan that guards the fitted branch has no call to find here. Third instance in this codebase of
   one constant answering two questions and so being ungatable for one of them. */
const UNFITTED_MOUNT = `relative flex flex-col gap-space-md md:flex-row md:gap-space-md lg:gap-space-lg xl:gap-space-xl md:p-space-xs lg:p-space-sm xl:p-space-md`;

const UNFITTED_SHEET = `relative flex-1 p-space-lg md:p-space-2xl lg:p-space-3xl`;

/* The unfitted branch's paint, per state. The mount arm keeps the `md:` prefixes the ladder had: below
   `{breakpoints.md}` a stacked specimen shows no mount, so its fill and cast appear from that breakpoint
   up, exactly as before. Under `"stock"` the SHEET is the painted surface at every width — the specimen
   has no leaf to promote — so the mount paints nothing and the sheet carries the composed cast. */
const UNFITTED_MOUNT_PAINT: Record<FramePaint, string> = {
  mount: `${CARD_CORNERS} md:bg-surface-mount md:shadow-mount`,
  stock: "",
  none: "",
};

const UNFITTED_SHEET_PAINT: Record<FramePaint, string> = {
  mount: `${CARD_CORNERS} bg-surface-elevated shadow-mount md:shadow-stock`,
  stock: `${CARD_CORNERS} bg-surface-elevated shadow-mounted-stock`,
  none: "",
};

export function MountedPair({
  children,
  fit,
  paint = "mount",
}: MountedPairProps) {
  const [first, second] = children;

  /* Stated as a throw rather than left to compose into a silent no-op: the unpainted option exists
     for the page's opening card, and `mounted-sheet-frame-css` already refuses a hero pair outright,
     so an unpainted pair is a mistake at the call site rather than a configuration. */
  if (paint === "none") {
    throw new Error(
      "mounted-pair: a pair takes no unpainted option. The unpainted card is the hero's alone (DESIGN.md -> Foundations -> Layout -> `mounted-sheet`), and a pair is never the hero.",
    );
  }

  if (fit !== undefined) {
    const leaf = `${FRAME_CLASS.leaf} relative ${PAIR_LEAF_PAINT[paint]}`;
    const sheet = `${FRAME_CLASS.sheet} ${PAIR_SHEET_PAINT[paint]}`;
    return (
      <>
        <style>{mountedSheetFrameCss(fit, false, "pair", paint)}</style>
        <div className={frameScopeClass(fit)}>
          <div className={FRAME_CLASS.box}>
            <div
              className={`${FRAME_CLASS.mount} relative ${PAIR_MOUNT_PAINT[paint]}`}
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

  const unfittedMount = `${UNFITTED_MOUNT} ${UNFITTED_MOUNT_PAINT[paint]}`;
  const unfittedSheet = `${UNFITTED_SHEET} ${UNFITTED_SHEET_PAINT[paint]}`;
  return (
    <div className={unfittedMount}>
      {/* The crease is a fold in the mat, so it goes with the mat the stock paint does not show. */}
      {paint === "stock" ? null : (
        <div aria-hidden className={`hidden md:block ${CREASE_GEOMETRY}`} />
      )}
      <div className={unfittedSheet}>{first}</div>
      <div className={unfittedSheet}>{second}</div>
    </div>
  );
}
