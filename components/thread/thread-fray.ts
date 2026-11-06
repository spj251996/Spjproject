/* THE FRAYED ENDS (DESIGN.md -> Thread -> The frayed ends) — the arithmetic, with no DOM.

   The thread ends as cut cord does: full width and twist right up to a square cut, then five fibres
   leaving it. The invite's top and Wishes' close are the ends at rest; the drawing head's tip is the
   same end moving. The fibre tips sit where the line ends, so the cord stops short by the fray's
   length: at rest the ink is cut back under the fray (`endCut`), and while drawing the cord is drawn
   that far behind the drawn length (`cordDrawn`). */

export const FRAY_FIBRES = 5;

/* x the cord's width: how far the fibres reach past the cut, how far they splay, and how wide each
   is. The seed fixes which lengths and curls the five take, so the end is the same on every load. */
export const FRAY = { reach: 3.6, spread: 0.9, width: 0.34, seed: 11 } as const;

type Point = readonly [number, number];

/* One fibre as a quadratic, in the end's own frame: origin at the cut, +x the way the end points,
   +y across the cord. */
export interface Fibre {
  readonly from: Point;
  readonly control: Point;
  readonly to: Point;
  readonly width: number;
}

export interface FrayShape {
  /* The farthest fibre tip's +x: how far the cord stops short of the line's end. */
  readonly length: number;
  readonly fibres: readonly Fibre[];
}

function random(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

/* The five fibres for a cord `strokeWidth` wide, spread across its width, each of its own length,
   splay and curl. */
export function frayShape(
  strokeWidth: number,
  tuning: typeof FRAY = FRAY,
): FrayShape {
  const next = random(tuning.seed);
  const half = strokeWidth / 2;
  const inset = 0.11 * strokeWidth;
  const fibres: Fibre[] = [];
  for (let index = 0; index < FRAY_FIBRES; index += 1) {
    const across =
      -half + inset + ((strokeWidth - 2 * inset) * index) / (FRAY_FIBRES - 1);
    const length = tuning.reach * strokeWidth * (0.45 + 0.75 * next());
    const fan = (across / half) * tuning.spread * (0.6 + 0.8 * next());
    const curl = (next() - 0.5) * 0.64 * strokeWidth;
    const width = tuning.width * strokeWidth * (0.75 + 0.5 * next());
    fibres.push({
      from: [-0.18 * strokeWidth, across],
      control: [length * 0.5, across + fan * length * 0.08 + curl],
      to: [length, across + fan * length * 0.35],
      width,
    });
  }
  return {
    length: Math.max(...fibres.map((fibre) => fibre.to[0])),
    fibres,
  };
}

/* Each fibre's `d` in page space, for an end at (`x`, `y`) pointing along the unit (`tx`, `ty`). */
export function placeFray(
  shape: FrayShape,
  { x, y, tx, ty }: { x: number; y: number; tx: number; ty: number },
): string[] {
  const place = ([along, across]: Point) =>
    `${(x + tx * along - ty * across).toFixed(2)} ${(y + ty * along + tx * across).toFixed(2)}`;
  return shape.fibres.map(
    (fibre) =>
      `M${place(fibre.from)}Q${place(fibre.control)} ${place(fibre.to)}`,
  );
}

/* How far the cord — ink, twist and the head's sheen — is drawn when the line has drawn `drawn` of
   `total`: the fray's length behind, so the moving tip's fibres end at `drawn`, and whole once the
   line is, where the end at rest takes over. */
export function cordDrawn(
  drawn: number,
  total: number,
  frayLength: number,
): number {
  return drawn >= total ? total : Math.max(0, drawn - frayLength);
}

/* The cut is a stroke wider than the ink: past a free end it has to take the ink's round cap (half
   the stroke) and its antialiased edge. It cuts the ink before the shadow runs, so it need not reach
   the shadow, and narrow is better: it takes any other ink of the same piece that passes within half
   of it. */
export const END_CUT_WIDTH = 8;

/* The stretch of a piece whose ink is cut away under an end at rest: the fray's own reach back from
   the end, and past the free end enough to take the ink's round cap with it. `direction` is -1 for
   an end pointing backwards along the path (the invite's top, `endAt = 0`) and +1 for one pointing
   forwards (Wishes' close, `endAt` = the piece's length). */
export function endCut(
  endAt: number,
  pathLength: number,
  direction: -1 | 1,
  reach: number,
): { from: number; to: number } {
  const span = Math.max(
    0,
    Math.min(reach, direction === 1 ? endAt : pathLength - endAt),
  );
  const past = END_CUT_WIDTH / 2;
  return direction === 1
    ? { from: endAt - span, to: endAt + past }
    : { from: endAt - past, to: endAt + span };
}
