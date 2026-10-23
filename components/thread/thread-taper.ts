import { NEGLIGIBLE } from "./thread-head.ts";

/* ---------------------------------------------------------------------------------------------
   THE TAPER — the thread's two static free ends, the invite's top terminal and Wishes' close, come
   to a point instead of stopping at a round cap.

   An SVG stroke has one width along its whole length, and a stroke cannot be thinned by drawing a
   narrower one over it, so a taper is built the way the head is: a stack of butt-capped runs of the
   piece, each a little narrower than the one inside it, with the ink itself cut back over the same
   stretch so the stack is all that shows there. Like the head it is polylines through only its own
   stretch (`polylineBetween`), never dashes on a copy of the piece. The ends are fixed in the
   piece's own arc length, so all of it is worked out once, when the page is measured.

   It ships at these two ends only, and not under the live drawing head: the head already covers
   the last 96px of the line, and a taper beneath it was not visible there (DESIGN.md -> Thread ->
   The tapered ends). */

/* 16 runs: at 4 and 8 the steps and a tick at each seam show, at 16 it reads as a taper and the
   antialiased seam is visible only from about 6x zoom (measured on renders at dpr 3). */
export const TAPER_STEPS = 16;

/* A run is widest at `strokeWidth` and narrows to this at the end, so the last run is a hairline
   rather than vanishing in a zero-width stroke. */
const TAPER_FLOOR = 0.2;

/* Each run is lent this much of the stretch inside it, as the head's steps are, so the seam between
   two abutting butt ends cannot open. The narrower run lies wholly inside the wider one's body, so
   the loan never shows. */
const TAPER_OVERLAP = 1;

/* The cut is a stroke wider than the ink: it has to take the ink's round cap past a free end (half the
   stroke) and its antialiased edge. It cuts the ink BEFORE the bleed runs, so it need not reach the
   halo, and narrow is better: it takes any other ink of the same piece that passes within half
   of it. */
export const TAPER_CUT_WIDTH = 8;

export interface TaperOptions {
  readonly steps: number;
  /* px of the piece the taper spans; shortened when less than this lies on the path. */
  readonly taperLength: number;
  /* The ink's own stroke width, which the innermost run meets. */
  readonly strokeWidth: number;
}

export interface TaperSegment {
  /* 0 = the innermost run, the widest and furthest from the end. */
  readonly index: number;
  /* Arc length along the piece, `0 <= start < end <= the piece's length`. */
  readonly start: number;
  readonly end: number;
  readonly width: number;
}

/* How much of the path lies on the taper's side of `endAt`. */
function taperReach(
  endAt: number,
  pathLength: number,
  direction: -1 | 1,
  taperLength: number,
): number {
  return Math.max(
    0,
    Math.min(taperLength, direction === 1 ? endAt : pathLength - endAt),
  );
}

/* The runs of a taper at an end sitting `endAt` along a path of `pathLength`. `direction` is -1 for
   an end that points backwards along the path (the invite's top terminal, `endAt = 0`) and +1 for
   one that points forwards (Wishes' close, `endAt = pathLength`). The widths do not depend on which
   way the end points, so the two mirror each other. */
export function taperSegments(
  endAt: number,
  pathLength: number,
  direction: -1 | 1,
  { steps, taperLength, strokeWidth }: TaperOptions,
): TaperSegment[] {
  const reach = taperReach(endAt, pathLength, direction, taperLength);
  const step = reach / steps;
  const floor = Math.min(TAPER_FLOOR, strokeWidth);
  const segments: TaperSegment[] = [];
  for (let index = 0; index < steps; index += 1) {
    /* Distances from the end: run `index` lies between `near` (the narrow side) and `far`. */
    const far = reach - index * step;
    const near = reach - (index + 1) * step;
    const width = floor + (strokeWidth - floor) * (1 - (index + 0.5) / steps);
    segments.push(
      direction === 1
        ? {
            index,
            start: Math.max(0, endAt - far - TAPER_OVERLAP),
            end: endAt - near,
            width,
          }
        : {
            index,
            start: endAt + near,
            end: Math.min(pathLength, endAt + far + TAPER_OVERLAP),
            width,
          },
    );
  }
  return segments;
}

/* Whether the ink has drawn far enough for this run to show. A run the ink has reached only part of
   stays hidden: the head covers the last 96px of drawn line and is wider than any run, so nothing is
   missed, and a run never shows ahead of the ink. Ink grows from arc 0, so this holds at both ends. */
export function taperReached(segment: TaperSegment, painted: number): boolean {
  return painted >= segment.end - NEGLIGIBLE;
}

/* The stretch of the piece whose ink is cut away under a taper: the tapered stretch itself, and, past
   the free end, enough to take the ink's round cap with it. */
export function taperCut(
  endAt: number,
  pathLength: number,
  direction: -1 | 1,
  taperLength: number,
): { from: number; to: number } {
  const reach = taperReach(endAt, pathLength, direction, taperLength);
  const past = TAPER_CUT_WIDTH / 2;
  return direction === 1
    ? { from: endAt - reach, to: endAt + past }
    : { from: endAt - past, to: endAt + reach };
}
