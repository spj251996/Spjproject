import assert from "node:assert/strict";
import { test } from "node:test";
import { boundSpans, MAX_SPAN, splinePath } from "./thread-spline.ts";

test("the path starts at the first point and is all cubics", () => {
  const d = splinePath([
    { x: 0, y: 0 },
    { x: 10, y: 10 },
    { x: 20, y: 0 },
  ]);
  assert.match(d, /^M 0 0/);
  assert.equal(d.includes("NaN"), false);
  assert.equal((d.match(/C /g) ?? []).length, 2, "one cubic per span");
});

/* ---- explicit end directions ------------------------------------------------------------------

   A connector is met at a motif's own entry/exit tangent, or at a section terminal's vertical one.
   The curve has to LEAVE and ARRIVE along that direction; a Catmull-Rom end that duplicates its
   neighbour leaves toward the next waypoint instead, and the difference is the kink the owner sees
   as a motif pasted on rather than threaded through.

   The tangent of a cubic at its start is `3 * (c1 - p1)`, and at its finish `3 * (p2 - c2)`, so the
   control points ARE the assertion. */

/** Every number in the path, in order: `M x y (C c1x c1y c2x c2y x y)*`. */
function numbers(d: string): number[] {
  return [...d.matchAll(/-?\d+(?:\.\d+)?(?:e-?\d+)?/g)].map((m) =>
    Number(m[0]),
  );
}

/** `[c1, c2, end]` of span `index`, plus that span's start point. */
function span(d: string, index: number) {
  const all = numbers(d);
  const base = 2 + index * 6;
  return {
    start:
      index === 0
        ? { x: all[0], y: all[1] }
        : { x: all[base - 2], y: all[base - 1] },
    c1: { x: all[base], y: all[base + 1] },
    c2: { x: all[base + 2], y: all[base + 3] },
    end: { x: all[base + 4], y: all[base + 5] },
  };
}

const degrees = (x: number, y: number) => (Math.atan2(y, x) * 180) / Math.PI;
const size = (x: number, y: number) => Math.hypot(x, y);

/* ---- the shaping rules, probed WITHOUT the span bound -------------------------------------------

   The four tests below index a particular SPAN of the emitted path and assert the fitter's own
   shaping rules on it -- the bisector direction, the arm taken from its own span, the half arm at an
   end, and a hairpin turning rather than cusping. Their fixtures are deliberately unequal and 100-235
   px long, so the default `MAX_SPAN` subdivides them and `span(d, 1)` stops being the span the test
   means. They therefore pass `maxSpan: Infinity`: the rules they assert are about arm sizing and
   direction, which span bounding does not touch, and not one assertion's expected value changes. The
   bound's own effect is asserted by the `boundSpans` tests at the end of this file. */
const UNBOUNDED = { maxSpan: Number.POSITIVE_INFINITY } as const;

const corner = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 100 },
];

test("an end given a direction leaves along it, not toward its neighbour", () => {
  const upward = span(
    splinePath(corner, { ends: { start: { x: 0, y: -1 } } }),
    0,
  );
  assert.equal(
    Math.round(
      degrees(upward.c1.x - upward.start.x, upward.c1.y - upward.start.y),
    ),
    -90,
    "the first control point must sit straight up from the start",
  );

  const plain = span(splinePath(corner), 0);
  assert.equal(
    Math.round(degrees(plain.c1.x - plain.start.x, plain.c1.y - plain.start.y)),
    0,
    "without a direction the end still points at its neighbour",
  );
});

test("an end given a direction ARRIVES along it too", () => {
  const last = span(
    splinePath(corner, { ...UNBOUNDED, ends: { end: { x: 1, y: 0 } } }),
    1,
  );
  /* Arriving along +x means the final control point sits BEHIND the finish on that axis. */
  assert.equal(
    Math.round(degrees(last.end.x - last.c2.x, last.end.y - last.c2.y)),
    0,
  );
  const plain = span(splinePath(corner, UNBOUNDED), 1);
  assert.equal(
    Math.round(degrees(plain.end.x - plain.c2.x, plain.end.y - plain.c2.y)),
    90,
    "without a direction the finish still points back at its neighbour",
  );
});

test("a given direction keeps the arm length the duplicated neighbour took", () => {
  const given = span(
    splinePath(corner, { ends: { start: { x: 0, y: -1 } } }),
    0,
  );
  const plain = span(splinePath(corner), 0);
  assert.equal(
    Math.round(
      size(given.c1.x - given.start.x, given.c1.y - given.start.y) * 1e6,
    ),
    Math.round(
      size(plain.c1.x - plain.start.x, plain.c1.y - plain.start.y) * 1e6,
    ),
    "only the direction is replaced, never the tension",
  );
});

/* ---- corners ----------------------------------------------------------------------------------

   Catmull-Rom's interior tangent is `p[i+1] - p[i-1]`, the sum of the two leg VECTORS — so it is
   length-weighted, and both of its failures show at a corner: the long leg drags the direction off
   the corner's own bisector, and the arm can reach further than the short leg is long, which puts
   a bulge or a loop inside it. At a near-reversal the same sum nearly cancels, the arm collapses to
   almost nothing, and the corner renders as a cusp however smooth the rest of the curve is. */

const unequal = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 110 },
];

test("an interior tangent bisects its two legs rather than following the longer one", () => {
  const { start, c1 } = span(splinePath(unequal), 1);
  assert.equal(
    Math.round(degrees(c1.x - start.x, c1.y - start.y)),
    45,
    "a right-angle corner is left at 45 degrees whatever the legs measure",
  );
});

test("a control arm is one third of the span it belongs to, not of its neighbour", () => {
  /* Both arms below sit on the SAME interior point, one per side. The 10-long leg must not starve
     the 110-long one: a connector runs `JOIN_OVERLAP` past each of its ends and its spans are wildly
     unequal, and feeding every arm from the shorter adjacent span put a cusp at the corner. */
  const short = span(splinePath(unequal, UNBOUNDED), 0);
  const long = span(splinePath(unequal, UNBOUNDED), 1);
  const round6 = (value: number) => Math.round(value * 1e6) / 1e6;
  assert.equal(
    round6(size(short.end.x - short.c2.x, short.end.y - short.c2.y)),
    round6(10 / 3),
  );
  assert.equal(
    round6(size(long.c1.x - long.start.x, long.c1.y - long.start.y)),
    round6(110 / 3),
  );
  /* And an arm still cannot reach past its own span, so a corner cannot loop inside one. */
  for (const { start, c1, c2, end } of [short, long]) {
    const length = size(end.x - start.x, end.y - start.y);
    assert.ok(size(c1.x - start.x, c1.y - start.y) <= length + 1e-9);
    assert.ok(size(end.x - c2.x, end.y - c2.y) <= length + 1e-9);
  }
});

/* The tension AT A CONNECTOR'S OWN ENDS is the one that shipped — half the interior's, which is what
   duplicating the neighbour gave — so replacing the direction there changes the direction and
   nothing else. Giving an end the interior arm doubles how far the curve bulges sideways while it
   swings onto a motif's tangent, and that bulge is what the reveal mask stops being able to follow. */
test("a first or last point keeps the half arm the duplicated neighbour gave", () => {
  const first = span(splinePath(unequal, UNBOUNDED), 0);
  const last = span(splinePath(unequal, UNBOUNDED), 1);
  const round6 = (value: number) => Math.round(value * 1e6) / 1e6;
  assert.equal(
    round6(size(first.c1.x - first.start.x, first.c1.y - first.start.y)),
    round6(10 / 6),
  );
  assert.equal(
    round6(size(last.end.x - last.c2.x, last.end.y - last.c2.y)),
    round6(110 / 6),
  );
});

test("a hairpin turns through its corner instead of cusping at it", () => {
  const leg = 235;
  const turn = 166;
  const radians = (turn * Math.PI) / 180;
  const hairpin = [
    { x: 0, y: 0 },
    { x: leg, y: 0 },
    { x: leg + leg * Math.cos(radians), y: leg * Math.sin(radians) },
  ];
  const { start, c1 } = span(splinePath(hairpin, UNBOUNDED), 1);
  const arm = size(c1.x - start.x, c1.y - start.y);

  /* The length-weighted sum nearly cancels across a 166-degree reversal: `|p2 - p0| / 6`. */
  const cusped =
    size(hairpin[2].x - hairpin[0].x, hairpin[2].y - hairpin[0].y) / 6;
  assert.ok(
    arm > cusped * 5,
    `arm ${arm.toFixed(1)} against the cusp's ${cusped.toFixed(1)}`,
  );
  assert.equal(
    Math.round(degrees(c1.x - start.x, c1.y - start.y)),
    83,
    "a 166 degree turn is left square to both legs, which is what makes it a U",
  );
});

test("an exact reversal is finite", () => {
  const d = splinePath([
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 0, y: 0 },
  ]);
  assert.equal(d.includes("NaN"), false);
});

/* CONTROL_DIVISOR is the curve's tension and is not exported, so it is pinned through the geometry
   it produces: on a straight, equally spaced run each control point sits one third of the way along
   its span. Raising or lowering the divisor moves both of these. */
test("the tension puts a straight run's controls at the span's thirds", () => {
  const straight = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 20, y: 0 },
    { x: 30, y: 0 },
  ];
  const { c1, c2 } = span(splinePath(straight), 1);
  assert.equal(Math.round(c1.x * 1e6) / 1e6, 13.333333);
  assert.equal(Math.round(c2.x * 1e6) / 1e6, 16.666667);
});

/* The shaping happens in the space the points are given in; `project` only writes the result
   somewhere else. A connector measures in the band's pixels and emits into its own stretched box,
   and normalising a direction in the stretched space instead renders the same arm a hundred times
   longer pointing one way than the other. */
test("project moves the emitted curve without reshaping it", () => {
  const plain = splinePath(unequal);
  const halved = splinePath(unequal, {
    project: (point) => ({ x: point.x / 2, y: point.y / 4 }),
  });
  const a = numbers(plain);
  const b = numbers(halved);
  assert.equal(a.length, b.length);
  for (let i = 0; i < a.length; i += 2) {
    assert.ok(Math.abs(a[i] / 2 - b[i]) < 1e-9, `x at ${i}`);
    assert.ok(Math.abs(a[i + 1] / 4 - b[i + 1]) < 1e-9, `y at ${i}`);
  }
});

/* ---- bounding the span-length ratio the fitter sees ---------------------------------------------

   The owner reported the thread reading as chicken scratch rather than a flowing line. `splinePath`
   sizes both of a span's control arms from THAT SPAN'S OWN length, which is correct and must not
   change; what is wrong is the input. The authored routes carry a 20x span spread, because
   Ramer-Douglas-Peucker drops points on smooth runs and piles them at corners — so the spread is a
   property of the EXTRACTION, not of the owner's drawing. Adjacent arms differing 20x is a curvature
   discontinuity: a tight wiggle and then a long glide. */

const spansOf = (points: readonly { x: number; y: number }[]) =>
  points
    .slice(1)
    .map((p, i) => Math.hypot(p.x - points[i].x, p.y - points[i].y));

test("boundSpans leaves an already-even point list alone", () => {
  /* A no-op on even spacing, or every authored route shifts for nothing. */
  const even = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 20, y: 0 },
    { x: 30, y: 0 },
  ];
  assert.deepEqual(boundSpans(even, 10), even);
});

test("boundSpans keeps every authored vertex at its exact coordinates", () => {
  const drawn = [
    { x: 0, y: 0 },
    { x: 8, y: 0 },
    { x: 8, y: 169 },
  ];
  const out = boundSpans(drawn, 40);
  for (const vertex of drawn) {
    assert.ok(
      out.some((p) => p.x === vertex.x && p.y === vertex.y),
      `authored vertex ${JSON.stringify(vertex)} was moved or dropped`,
    );
  }
  assert.deepEqual(out[0], drawn[0]);
  assert.deepEqual(out[out.length - 1], drawn[drawn.length - 1]);
});

test("boundSpans caps the longest span at the threshold", () => {
  const out = boundSpans(
    [
      { x: 0, y: 0 },
      { x: 161, y: 0 },
    ],
    40,
  );
  const widest = Math.max(...spansOf(out));
  assert.ok(widest <= 40 + 1e-9, `widest span is ${widest}`);
});

test("boundSpans cuts tall's connector 0 span ratio from 20x to under 6x", () => {
  // The measured authored route, read from tmp/thread-draw/tall/connectors.json.
  const connector0 = [
    { x: 12, y: 189 },
    { x: 32, y: 159 },
    { x: 40, y: 159 },
    { x: 48, y: 173 },
    { x: 48, y: 213 },
    { x: 19, y: 371 },
    { x: 22, y: 403 },
    { x: 45, y: 430 },
  ];
  const beforeSpans = spansOf(connector0);
  const beforeRatio = Math.max(...beforeSpans) / Math.min(...beforeSpans);
  assert.ok(
    beforeRatio > 19,
    `fixture ratio is ${beforeRatio.toFixed(1)}, expected >19`,
  );
  const afterSpans = spansOf(boundSpans(connector0, 40));
  const afterRatio = Math.max(...afterSpans) / Math.min(...afterSpans);
  assert.ok(afterRatio < 6, `ratio after bounding is ${afterRatio.toFixed(1)}`);
});

test("boundSpans handles a span exactly at the threshold without splitting it", () => {
  /* Off-by-one at the boundary: `ceil(40/40)` is 1, so a span AT the threshold is left whole. */
  const out = boundSpans(
    [
      { x: 0, y: 0 },
      { x: 40, y: 0 },
    ],
    40,
  );
  assert.equal(out.length, 2);
});

test("boundSpans handles degenerate lists", () => {
  /* Fewer than two points, and a zero-length span — every connector's degenerate cases. */
  assert.deepEqual(boundSpans([], 40), []);
  assert.deepEqual(boundSpans([{ x: 1, y: 2 }], 40), [{ x: 1, y: 2 }]);
  const coincident = [
    { x: 5, y: 5 },
    { x: 5, y: 5 },
  ];
  assert.deepEqual(boundSpans(coincident, 40), coincident);
});

test("splinePath applies the span bound by default", () => {
  const long = [
    { x: 0, y: 0 },
    { x: 400, y: 0 },
    { x: 400, y: 8 },
  ];
  const bounded = splinePath(long);
  const unbounded = splinePath(long, { maxSpan: Number.POSITIVE_INFINITY });
  assert.notEqual(
    bounded,
    unbounded,
    "the default must bound spans, or the coming redraw inherits nothing",
  );
});

test("the default threshold is the one the fitter documents", () => {
  /* `MAX_SPAN` is owner-tuned on a render, and a fitting step has silently overwritten an eye-tuned
     constant in this project before, so the authored value is asserted rather than trusted. */
  assert.equal(MAX_SPAN, 40);
});
