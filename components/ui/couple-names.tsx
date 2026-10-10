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

/* THE AMPERSAND IS DRAWN AT 65% — settled by the owner on a render, 2026-10-10, after three
   reductions clustered on the width the typeset mark it replaced read at (27.0px of ink against
   this one's 40.0 at the phone tier, so 68%; 65% is one step past it).

   IT KEEPS ITS FULL SLOT IN THE LAYOUT, and that is the whole of why this lands faithfully. The
   obvious form — shrinking `AMPERSAND.w` and letting the line re-close around it — makes the LINE
   box 35.5 units narrower, and since the lockup's CSS width is a fixed `em` of its role, a
   narrower box renders everything inside it 3.2% LARGER. The owner judged this on a lever that
   scaled the mark with a `transform`, which moves no boxes: the words stayed exactly where they
   were and only the swash shrank. Reserving the slot reproduces that — the visible gaps either
   side of the mark grow from 20.2 to 37.95 units, equally, which is precisely what the transform
   produced, and `LINE.w`, `STACK` and therefore both measured fits do not move at all. */
const AMPERSAND_SCALE = 0.65;

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
   sweep them with the classes.

   THE PHONE TIER TAKES SMALLER RATIOS — 1.85em stacked and 3.65em on the line, against the 2.513
   and 4.656 every wider tier keeps (owner, 2026-10-10, choosing this over accepting the overflow
   they reported as the names reading cut off). An `em` width is FIXED per tier while the card's
   content box SHRINKS with the window, so both lockups ran off their cards at the narrow end.
   MEASURED ACROSS THE WHOLE TIER rather than at one window, because the box depends on HEIGHT as
   much as on width:

     invite, stacked at 2.513em = 236.2px     Wishes, line at 4.656em = 260.8px
       320 wide: box 176-208, over by up to 60   320 wide: box 208-240, over by up to 53
       360 wide: box 216-232, over by up to 20   360 wide: box 248-264, over by 13
       375 wide and up: fits                     393 wide and up: fits

   The narrowest box anywhere is 176px at 320x844 for the invite and 208px there for Wishes, so the
   ceilings are 1.872em and 3.714em. 1.85 and 3.65 sit just inside them, leaving 2.1px and 3.6px at
   the worst box rather than the 0.22px a value at the ceiling would leave. Nothing clips either
   lockup, so before this the ink simply painted out over the card's padding and, at 320, past the
   sheet's own edge.

   THE COST IS REAL AND IS THE OWNER'S OWN CHOICE: the names are about 26% smaller at EVERY phone,
   including the wide ones that had 50px and 73px of slack to spare. The alternatives were a
   container cap, which the fit model refuses — see the viewBox note below — or living with ink
   over the card's edge at 320 and 360. `md:` restores the settled ratio from 48rem up, so only
   this tier moves. */

/* The DRAWN size of the mark. Its SLOT stays `AMPERSAND.w` x `AMPERSAND.h` — see the scale's own
   note above — so this is only ever the `<use>` box, never a layout dimension. */
const ampersand = {
  w: AMPERSAND.w * AMPERSAND_SCALE,
  h: AMPERSAND.h * AMPERSAND_SCALE,
};

/* The line, left to right, baseline-aligned on Sebastian: the ampersand is centred on the lockup's
   own height rather than set on the baseline, because it is a swash mark between two words and not
   a letter in either. */
const LINE = {
  sebastian: { x: 0, y: 0 },
  /* Centred in its full-width slot, horizontally and vertically, so the two visible gaps stay
     equal at any scale and the words never move. */
  ampersand: {
    x: SEBASTIAN.w + GAP + (AMPERSAND.w - ampersand.w) / 2,
    y: (SEBASTIAN.h - ampersand.h) / 2,
  },
  flemy: {
    x: SEBASTIAN.w + GAP + AMPERSAND.w + GAP,
    y: SEBASTIAN.h - FLEMY.h,
  },
  w: SEBASTIAN.w + GAP + AMPERSAND.w + GAP + FLEMY.w,
  h: SEBASTIAN.h,
};

/* The stack is the source box re-origined on its ink, so the two WORDS sit exactly where the
   drawing puts them.
   THE AMPERSAND IS THE ONE EXCEPTION, AND IT IS CENTRED RATHER THAN RE-ORIGINED (owner,
   2026-10-10): the trace places it 21.905 of 599.68 units right of the lockup's centre and 20.36
   of 445.31 above it, which is the drawing's own composition and reads as an error once the mark
   is small. Centring it on the lockup both ways is what the owner approved on the render, and it
   reproduces that exactly — the preview lever got there with a translate of the same two
   figures. */
const STACK_W = SEBASTIAN.w;
const STACK_H = FLEMY.y + FLEMY.h - SEBASTIAN.y;
const STACK = {
  sebastian: { x: 0, y: 0 },
  ampersand: {
    x: (STACK_W - ampersand.w) / 2,
    y: (STACK_H - ampersand.h) / 2,
  },
  flemy: { x: FLEMY.x - SEBASTIAN.x, y: FLEMY.y - SEBASTIAN.y },
  w: STACK_W,
  h: STACK_H,
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
  /* THE SCALED MARK IN BOTH LAYOUTS. This read `layout === "line" ? ampersand : AMPERSAND` while
     the scale was the line's alone and the stack was "left exactly as drawn" — and when the scale
     became both lockups' the stacked `<use>` kept rendering at FULL size while `STACK.ampersand`
     had already been computed for the scaled one, so the mark was both the wrong size and off
     centre. Caught by measuring the rendered mark against its as-drawn width — 98.9% where 65%
     was asked for — and by nothing else: the constant, the types and every source assertion were
     all satisfied. */
  const amp = ampersand;
  return (
    <svg
      aria-hidden
      className={className}
      /* WHICH LOCKUP THIS IS, as markup rather than as a class spelling. `orientation` renders
         BOTH and hides one by media query, so neither a stylesheet nor a measuring harness can
         tell them apart without re-deriving the orientation rule — and the two differ in a way
         that matters: the ampersand is centred between the words on the LINE, and sits 3.6% right
         and 4.6% above the lockup's centre in the STACK, which is the drawing's own composition.
         A rule that wants to re-centre it has to know which it is looking at. */
      data-names-layout={layout}
      role="presentation"
      /* `round` on both, not the default miter: a trace of handwriting is full of shallow cusps,
         and a mitered join turns each one into a spike that reads as a burr on the letterform. */
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={strokeUnits * 10}
      /* PADDED BY THREE STROKE WIDTHS ON EVERY SIDE, and the FACTOR is what was wrong before.
         The group boxes are tight to the drawing's ink and the outermost <svg> clips at its
         viewBox, so a stroke falling outside the contour has its swash tips shaved flat instead of
         tapering to a point. ONE stroke width was measured to clear at dpr 2 and 3 — and at dpr 1
         it does not, which is where the owner saw it (2026-10-10, "slightly cutoff in phone
         tier"): one stroke width is **0.63 CSS px** at the invite's phone lockup and **0.50px** at
         Wishes', so the outermost antialiased ink lands in the boundary pixel itself. Measured per
         edge in device px, at all three densities:
           dpr 3  every site and tier clear, 1-5px of pad
           dpr 2  every site and tier clear, 1-5px of pad
           dpr 1  invite phone CLIPPED top and left; Wishes CLIPPED left at phone and bottom-left
                  at tablet and laptop — four of eight cases with ink in the boundary pixel
         Three strokes puts the narrowest pad at about 1.5 CSS px, which leaves a whole boundary
         pixel at dpr 1 with room for the antialiasing either side.
         THE COST, and it is why the factor is 3 rather than larger: the pad grows the viewBox, so
         the ink renders slightly smaller for a given CSS width — about 1.0% at the invite and 0.4%
         at Wishes. Both fits are regenerated on it, and the `em` figures above are ratios of the
         ROLE rather than of the ink, so they are untouched.
         NOT FIXED BY A CONTAINER CAP, which was tried first and is not available: `min(2.513em,
         100%)` makes the lockup's height GROW with the window over the capped range, and
         `measure:fit` throws on exactly that — "regime 1 stands taller than regime 0 at a wider
         width" — because the frame's model requires content height to fall as width rises. */
      viewBox={`${-3 * strokeUnits} ${-3 * strokeUnits} ${box.w + 6 * strokeUnits} ${box.h + 6 * strokeUnits}`}
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
              ? "mx-auto block h-auto w-[1.85em] md:w-[2.513em] text-ink-muted [@media(orientation:landscape)]:hidden"
              : "mx-auto block h-auto w-[1.85em] md:w-[2.513em] text-ink-muted"
          }
          layout="stacked"
          strokeUnits={strokeUnits}
        />
      )}
      {layout !== "stacked" && (
        <Lockup
          className={
            layout === "orientation"
              ? "mx-auto hidden h-auto w-[3.65em] md:w-[4.656em] text-ink-muted [@media(orientation:landscape)]:block [@media(64rem<=width<100rem)_and_(orientation:landscape)]:w-[5.3em] [@media(width>=100rem)_and_(orientation:landscape)]:w-[5.8em]"
              : "mx-auto block h-auto w-[3.65em] md:w-[4.656em] text-ink-muted [@media(64rem<=width<100rem)_and_(orientation:landscape)]:w-[5.3em] [@media(width>=100rem)_and_(orientation:landscape)]:w-[5.8em]"
          }
          layout="line"
          strokeUnits={strokeUnits}
        />
      )}
    </>
  );
}
