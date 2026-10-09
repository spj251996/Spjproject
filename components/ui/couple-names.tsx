import type { ReactElement } from "react";

/* THE COUPLE'S NAMES AS DRAWN GEOMETRY, placing the three word-groups that
   `components/icons/couple-names-symbol.tsx` defines. It supersedes `type-display-name` at the
   invite and `type-heading-script` at Wishes; both roles stay in the tree as `/preview`'s lever-2
   alternate until the couple choose.

   MEASURED INK OF EACH GROUP, in the source file's own viewBox units (tmp/half2/names-bbox.mjs, a
   real engine). `x`/`y` are where the group sits in the SOURCE box, which is what makes the stacked
   layout free: the drawn lockup IS those positions, so stacking is a re-origin and nothing else. */
const SEBASTIAN = { w: 599.68, h: 190.11, x: 0.32, y: 0.19 };
const AMPERSAND = { w: 101.43, h: 84.63, x: 271.35, y: 160.17 };
const FLEMY = { w: 415.43, h: 183.42, x: 101.36, y: 262.08 };

/* The single line's word gap, in the same units. Measured: at this value the line is 1156.94 x
   190.11, 6.09:1, cleanly spaced; at -400 the ampersand tucks under Sebastian's `n` and at -900 it
   collides with both neighbours. The spec's "200 path units" is this number seen through the
   source group's own `scale(0.1)`. */
const GAP = 20.2;

/* The ampersand's scale on the single line only — the stacked lockup is left exactly as drawn,
   because scaling one word of a drawn composition is not the same decision as re-laying it. One
   number, because it is the owner's tuning lever on /preview and everything below derives from it. */
const AMPERSAND_SCALE = 1;

/* STROKE WEIGHT, PER CALL SITE. The trace is a FILLED OUTLINE, not a stroked path, so there is no
   pen width to turn up — the only way to make the lettering heavier is to DILATE the contours, by
   painting a stroke along them in the same colour. Centred, so half of it falls outside the fill:
   a stroke of `w` units widens every limb by `w`.

   IT IS A LEGIBILITY FLOOR BEFORE IT IS A WEIGHT. The trace's thinnest strokes measure ~2.0 units,
   and a stroke under one DEVICE pixel washes out on an ordinary dpr-1 monitor. So the value each
   site needs is set by how large THAT lockup renders at its smallest, and the two differ a lot:

     lockup                 px per unit   hairline undilated   dilation for 1px
     invite stack, phone         0.3939             0.79 px                0.54
     invite line, laptop         0.5039             1.01 px                   0
     Wishes line, phone          0.2253             0.45 px                2.44

   ONE SHARED VALUE THEREFORE CANNOT GIVE ONE OPTICAL WEIGHT, and the owner read that off the page
   before the arithmetic did: at a shared 2.2 the invite was "too thick" and Wishes "ok". The
   invite renders its drawing far larger relative to its own viewBox, so the same unit count lands
   about 1.75x heavier there in actual pixels — and larger lettering wants relatively LIGHTER
   strokes, not heavier, which is the ordinary optical-size relationship.

   THE COST OF OVERDOING IT: dilation is uniform, so it adds the same absolute width to a hairline
   as to a stem, compressing the taper, and past a point adjacent limbs fuse and the counters
   close. Measured on an 1800px raster of the drawing: distinct ink runs fall 3.4% at 2.2 units and
   16.5% at 8. `couple-names.test.ts` holds every site between its own pixel floor and 4 units.

   In VIEWBOX units, which is what the two layout boxes are measured in. The paths live inside the
   source group's own `scale(0.1)`, so the attribute carries ten times this number — the conversion
   is here rather than at the call site so the lever stays one figure in the units everything else
   on this component uses. */

/* WIDTHS ARE SET IN `em` OF THE CALL SITE'S OWN TYPE ROLE, in the class literals below — which is
   how the asset inherits the names scale the owner settled rather than taking a size chosen here.
   Both figures are MEASURED, not picked: today's lockup renders 236.2px wide at
   `--text-display-name`'s 94px and 276.4px at its 110px, which is **2.513em** at both, because
   "Sebastian" is what sets the width at any size. The single line reproduces the script signature
   the same way — 260.8px at 56px, 335.2px at 72px, 298px at 64px, **4.656em** at every one.
   They are literals rather than constants because Tailwind finds classes by scanning source, so a
   constant could not drive them and would only be a second copy to keep in step;
   `couple-names.test.ts` asserts the literals against those measurements instead.
   THE SINGLE LINE GROWS ON THE TWO WIDE LANDSCAPE BANDS — 5.3em at laptop and 5.8em at desktop
   against the 4.656em it reproduces elsewhere (owner, 2026-10-09). The condition is written the
   way Wishes' own signature margins already write it, so "laptop" and "desktop" mean the same
   windows here as they do there, and a landscape phone is not caught by either. One change
   reaches BOTH call sites, because both render this same lockup.
   THE CONSEQUENCE TO CARRY: the asset's SIZE still comes from `--text-display-name` and
   `--text-heading-script`, so those TOKENS outlive the ROLES that are retiring. Phase 9 must not
   sweep them with the classes. */

const ampersand = {
  w: AMPERSAND.w * AMPERSAND_SCALE,
  h: AMPERSAND.h * AMPERSAND_SCALE,
};

/* The line, left to right, baseline-aligned on Sebastian: the ampersand is centred on the lockup's
   own height rather than set on the baseline, because it is a swash mark between two words and not
   a letter in either. */
const LINE = {
  sebastian: { x: 0, y: 0 },
  ampersand: {
    x: SEBASTIAN.w + GAP,
    y: (SEBASTIAN.h - ampersand.h) / 2,
  },
  flemy: {
    x: SEBASTIAN.w + GAP + ampersand.w + GAP,
    y: SEBASTIAN.h - FLEMY.h,
  },
  w: SEBASTIAN.w + GAP + ampersand.w + GAP + FLEMY.w,
  h: SEBASTIAN.h,
};

/* The stack is the source box re-origined on its ink, so every position is the drawing's own. */
const STACK = {
  sebastian: { x: 0, y: 0 },
  ampersand: { x: AMPERSAND.x - SEBASTIAN.x, y: AMPERSAND.y - SEBASTIAN.y },
  flemy: { x: FLEMY.x - SEBASTIAN.x, y: FLEMY.y - SEBASTIAN.y },
  w: SEBASTIAN.w,
  h: FLEMY.y + FLEMY.h - SEBASTIAN.y,
};

export type CoupleNamesLayout = "stacked" | "line" | "orientation";

function Lockup({
  layout,
  className,
  strokeUnits,
}: {
  layout: "stacked" | "line";
  className: string;
  strokeUnits: number;
}): ReactElement {
  const box = layout === "line" ? LINE : STACK;
  const amp = layout === "line" ? ampersand : AMPERSAND;
  return (
    <svg
      aria-hidden
      className={className}
      role="presentation"
      /* `round` on both, not the default miter: a trace of handwriting is full of shallow cusps,
         and a mitered join turns each one into a spike that reads as a burr on the letterform. */
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={strokeUnits * 10}
      /* PADDED BY A FULL STROKE WIDTH ON EVERY SIDE. The group boxes are tight to the drawing's
         ink, and the outermost <svg> clips at its viewBox by default, so a stroke that falls
         outside the contour had its swash tips shaved flat instead of tapering to a point —
         measured as ink sitting in the first and last pixel columns at both call sites.
         THE PAD IS EMPIRICAL, NOT DERIVED: half the stroke is what the geometry says should be
         enough, and it still left ink on the edge at both sites; a full stroke width takes every
         edge to zero. Measured, not reasoned, because the shortfall is in the sub-pixel behaviour
         of joins and antialiasing rather than in the arithmetic.
         The ink therefore renders about 0.5% narrower than the box for a given CSS width, which is
         below the measuring sweep's own resolution and leaves the `em` figures above intact. */
      viewBox={`${-strokeUnits} ${-strokeUnits} ${box.w + 2 * strokeUnits} ${box.h + 2 * strokeUnits}`}
    >
      <use
        height={SEBASTIAN.h}
        href="#names-sebastian"
        width={SEBASTIAN.w}
        x={box.sebastian.x}
        y={box.sebastian.y}
      />
      <use
        height={amp.h}
        href="#names-ampersand"
        width={amp.w}
        x={box.ampersand.x}
        y={box.ampersand.y}
      />
      <use
        height={FLEMY.h}
        href="#names-flemy"
        width={FLEMY.w}
        x={box.flemy.x}
        y={box.flemy.y}
      />
    </svg>
  );
}

/* `names` is the accessible name and the ONLY text here. It is read once however many lockups
   render: the orientation form draws two and a second `sr-only` would make the `<h1>` stutter the
   couple's names. */
export function CoupleNames({
  layout,
  names,
  strokeUnits,
}: {
  layout: CoupleNamesLayout;
  names: string;
  /* No default: the right value depends on how large this call site renders the drawing, so
     leaving it implicit is how the two sites silently drift to one weight again. */
  strokeUnits: number;
}): ReactElement {
  /* Written out whole rather than composed, because Tailwind finds classes by scanning source. */
  return (
    <>
      <span className="sr-only">{names}</span>
      {layout !== "line" && (
        <Lockup
          className={
            layout === "orientation"
              ? "mx-auto block h-auto w-[2.513em] text-ink-muted [@media(orientation:landscape)]:hidden"
              : "mx-auto block h-auto w-[2.513em] text-ink-muted"
          }
          layout="stacked"
          strokeUnits={strokeUnits}
        />
      )}
      {layout !== "stacked" && (
        <Lockup
          className={
            layout === "orientation"
              ? "mx-auto hidden h-auto w-[4.656em] text-ink-muted [@media(orientation:landscape)]:block [@media(64rem<=width<100rem)_and_(orientation:landscape)]:w-[5.3em] [@media(width>=100rem)_and_(orientation:landscape)]:w-[5.8em]"
              : "mx-auto block h-auto w-[4.656em] text-ink-muted [@media(64rem<=width<100rem)_and_(orientation:landscape)]:w-[5.3em] [@media(width>=100rem)_and_(orientation:landscape)]:w-[5.8em]"
          }
          layout="line"
          strokeUnits={strokeUnits}
        />
      )}
    </>
  );
}
