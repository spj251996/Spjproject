export type Point = { x: number; y: number };

const CONTROL_DIVISOR = 6;

/* The widest span the fitter may see. `splinePath` sizes both of a span's control arms from that
   span's own length, so a point sitting between an 8px span and a 161px one gets a 2.7px arm on one
   side and a 53.7px arm on the other -- a curvature discontinuity, which is what the owner reported
   as the thread looking like chicken scratch rather than a flowing line. The authored routes carry a
   20x span spread because Ramer-Douglas-Peucker drops points on smooth runs and piles them at
   corners, so the spread is a property of the EXTRACTION, not of the drawing.
   Owner-tuned on a render. Do not change it without another render. */
export const MAX_SPAN = 40;

/* A direction the curve must leave its first point along, or arrive at its last point along, as a
   vector in the SAME SPACE as the points — not an angle, because a connector's box is stretched and
   an angle would have to say which of the two spaces it was measured in. The caller converts: a
   motif's tangent is stated in the section's pixels, and `thread-css.ts` divides each component by
   that axis's span so the RENDERED curve leaves along the rendered angle.

   Magnitude is ignored; only the direction is read. */
export type EndTangents = { start?: Point; end?: Point };

export type SplineOptions = {
  ends?: EndTangents;
  /* Where the curve is MEASURED and where it is EMITTED are not the same space, and separating them
     is what makes the shaping rules below mean anything. A connector's box is stretched — often past
     100:1 on a run that barely moves on one axis — so a direction normalised in box units and an arm
     measured in them describe no distance a reader sees: the same arm renders a hundred times longer
     pointing one way than the other, and the curve leaves the route entirely.

     So the caller passes its points in the band's own PIXELS, where a bisector bisects and a third of
     a span is a third of a span, and `project` carries each emitted control point into the box. Both
     spaces are related per-axis and affinely, so projecting the control points is exact — the drawn
     curve is the same one, written in the other space. */
  project?: (point: Point) => Point;

  /* The widest span the fitter may see, defaulting to `MAX_SPAN`. Applied inside `splinePath` rather
     than by the generator on purpose: the generator (`tmp/thread-draw/build-thread-paths.mjs`) is
     gitignored, so a rule applied there would not survive to the coming full redraw — and the redraw
     is exactly what this rule has to govern. Pass `Infinity` to opt out. */
  maxSpan?: number;
};

function unitVector(x: number, y: number): Point | null {
  const size = Math.hypot(x, y);
  return size < 1e-9 ? null : { x: x / size, y: y / size };
}

/* The UNIT direction the curve travels at `points[i]`.

   An end given a direction in `ends` takes it. Otherwise an interior point takes the bisector of its
   two legs — the sum of the UNIT legs, not of the leg vectors, which is where plain Catmull-Rom goes
   wrong at a corner twice over: a long leg drags the direction off the corner's own bisector, and
   across a near-reversal the two vectors nearly cancel, so the arm collapses and the corner renders
   as a cusp however smooth the rest of the curve is. An end with no direction given keeps its one
   leg, which is what duplicating the neighbour gave. */
function directionAt(
  points: readonly Point[],
  i: number,
  ends: EndTangents,
): Point | null {
  const last = points.length - 1;
  const into =
    i > 0
      ? unitVector(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y)
      : null;
  const outOf =
    i < last
      ? unitVector(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y)
      : null;
  const given = i === 0 ? ends.start : i === last ? ends.end : undefined;
  const chosen = given === undefined ? null : unitVector(given.x, given.y);
  if (chosen !== null) return chosen;
  if (into === null || outOf === null) return into ?? outOf;
  /* An exact reversal cancels; there is no bisector to take, so the incoming leg carries on and the
     corner is the cusp it geometrically is. No authored route reaches it. */
  return unitVector(into.x + outOf.x, into.y + outOf.y) ?? into;
}

/* Subdivides any span longer than `maxSpan`, inserting evenly spaced points along it. ADDITIVE ONLY:
   every authored vertex and both endpoints survive at their exact coordinates. That is the reason this
   is not a uniform resample -- a resample moves points off the drawn polyline, rounding corners the
   owner drew, and swallows the ~2px spans a connector carries past each of its ends, which is how the
   route meets its motif.

   It changes only the span RATIO the fitter sees. `splinePath`'s own shaping rules are untouched: the
   bisector direction and the arm-from-its-own-span length both still hold, and both are measured
   rules whose comments record the cusp the alternatives produced. */
export function boundSpans(points: readonly Point[], maxSpan: number): Point[] {
  if (points.length < 2 || !(maxSpan > 0)) return [...points];
  const out: Point[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const from = points[i - 1];
    const to = points[i];
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    /* `ceil` of the ratio is the fewest equal pieces no wider than `maxSpan`; a span at exactly the
       threshold gives 1 and is left whole. */
    const pieces = length > maxSpan ? Math.ceil(length / maxSpan) : 1;
    for (let step = 1; step < pieces; step++) {
      const at = step / pieces;
      out.push({
        x: from.x + (to.x - from.x) * at,
        y: from.y + (to.y - from.y) * at,
      });
    }
    out.push(to);
  }
  return out;
}

/**
 * Catmull-Rom, converted to one cubic Bézier per span — with the two halves of a tangent separated.
 *
 * DIRECTION is `directionAt` and is shared by the span before and the span after, so the curve turns
 * through every point without a kink. LENGTH is one third of the span the arm BELONGS to — exactly
 * what plain Catmull-Rom gives on a straight, equally spaced run (`|p[i+1] - p[i-1]| / 6` with both
 * legs equal), which is the behaviour every other value in the thread was tuned against.
 *
 * A FIRST OR LAST point keeps HALF that, which is what duplicating the neighbour already gave it
 * (`|p2 - p1| / 6`) — so the tension at a connector's two ends is exactly the tension that shipped,
 * and only the direction is replaced. Measured, not preferred: giving an end the interior's arm
 * doubles how far the curve bulges sideways while it swings onto a motif's own tangent, and at a
 * connector whose box collapses toward one axis — `event-info`'s seeded knot, whose exit is met at
 * 56 degrees on a run that travels straight down — that bulge is what the reveal mask stops being
 * able to follow, and the section renders in pieces.
 *
 * Taking the length from the arm's OWN span rather than from the point's two legs is what keeps a
 * short span from starving its neighbour: a connector runs `JOIN_OVERLAP` past each of its ends, so
 * its first and last spans are about two pixels long, and a rule that fed every arm from the shorter
 * adjacent span put a 0.3 px arm on the corner beside each of them — measured on the owner's `wide`
 * routes as a radius of curvature of 0.2 px, which is a cusp. An arm can still never reach past its
 * own span, so a corner between an unequal pair neither bulges nor loops inside the short one.
 */
export function splinePath(
  points: readonly Point[],
  {
    ends = {},
    project = (point) => point,
    maxSpan = MAX_SPAN,
  }: SplineOptions = {},
): string {
  /* Every rule below reads `spaced`, not `points`. Subdivision never moves the first or last point,
     so `ends.start`/`ends.end` still land on exactly the points they were measured for. */
  const spaced = boundSpans(points, maxSpan);
  if (spaced.length === 0) return "";
  const first = project(spaced[0]);
  const segments = [`M ${first.x} ${first.y}`];
  const spanCount = spaced.length - 1;
  for (let i = 0; i < spanCount; i++) {
    const p1 = spaced[i];
    const p2 = spaced[i + 1];
    const length = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const t1 = directionAt(spaced, i, ends) ?? { x: 0, y: 0 };
    const t2 = directionAt(spaced, i + 1, ends) ?? { x: 0, y: 0 };
    const reach = (at: number) =>
      (length * (at === 0 || at === spanCount ? 1 : 2)) / CONTROL_DIVISOR;
    const near = reach(i);
    const far = reach(i + 1);
    const c1 = project({ x: p1.x + t1.x * near, y: p1.y + t1.y * near });
    const c2 = project({ x: p2.x - t2.x * far, y: p2.y - t2.y * far });
    const to = project(p2);
    segments.push(`C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${to.x} ${to.y}`);
  }
  return segments.join(" ");
}
