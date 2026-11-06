import assert from "node:assert/strict";
import { test } from "node:test";
import {
  cutPolyline,
  flatten,
  restoredShape,
  writesInBatch,
} from "./thread-sway.ts";

/* The sway moves points, so a cubic it moved only at its control points could not follow the field
   between them the way a polyline laid on it does. Flattened, both are polylines. */
test("a cubic flattens into short chords that start and end where the curve does", () => {
  const flat = flatten("M0 0C0 10 10 10 10 0L20 0");
  assert.ok(flat.startsWith("M0.00 0.00L"), flat);
  assert.ok(flat.endsWith("L10.00 0.00L20.00 0.00"), flat);
  assert.doesNotMatch(flat, /C/);
  const points = flat.match(/-?\d+\.\d+ -?\d+\.\d+/g) ?? [];
  assert.ok(
    points.length >= 10,
    `a 30px curve took only ${points.length} points`,
  );
  assert.equal(flatten("M1 2L3 4 5 6"), "M1.00 2.00L3.00 4.00L5.00 6.00");
});

/* The twist's gaps are quadratics, laid in the same swayed `<svg>`: read as straight lines through their control
   point, each gap bent into a chevron bowing twice as far as its curve. Flattened, a quadratic passes through
   its own midpoint, halfway to the control point. */
test("a quadratic flattens into chords that start and end where the curve does", () => {
  const flat = flatten("M0 0Q10 10 20 0");
  assert.ok(flat.startsWith("M0.00 0.00L"), flat);
  assert.ok(flat.endsWith("L20.00 0.00"), flat);
  assert.doesNotMatch(flat, /Q/);
  assert.doesNotMatch(
    flat,
    /10\.00 10\.00/,
    "the control point is not a vertex",
  );
  assert.match(flat, /L10\.00 5\.00/, "the curve's midpoint is");
});

/* While the line sways, the piece being drawn is cut at its tip rather than dashed, so nothing past the tip
   exists to paint. The parts are the path's text between its numbers, as the sway splits it. */
const LINE = {
  numbers: [0, 0, 10, 0, 20, 0],
  parts: ["M", " ", "L", " ", "L", " ", ""],
};

test("a path cut at half its length ends on the point there", () => {
  assert.equal(
    cutPolyline(LINE.numbers, LINE.parts, 0.5),
    "M0.00 0.00L10.00 0.00",
  );
});

test("a path cut between its points ends on an interpolated point", () => {
  assert.equal(
    cutPolyline(LINE.numbers, LINE.parts, 0.25),
    "M0.00 0.00L5.00 0.00",
  );
  assert.equal(
    cutPolyline(LINE.numbers, LINE.parts, 0.75),
    "M0.00 0.00L10.00 0.00L15.00 0.00",
  );
});

test("a path cut at its whole length is whole, and at nothing is empty", () => {
  assert.equal(
    cutPolyline(LINE.numbers, LINE.parts, 1),
    "M0.00 0.00L10.00 0.00L20.00 0.00",
  );
  assert.equal(cutPolyline(LINE.numbers, LINE.parts, 0), "");
});

/* The tip is where the draw has reached along the UNSWAYED line, which is where the twist and the head
   put it too: so the cut is found on the line's own lengths and laid on its moved points, never measured
   along the swayed line, which the sway stretches unevenly. */
test("a cut is placed by the unswayed line's lengths and laid on the moved points", () => {
  const moved = [0, 0, 15, 0, 20, 0];
  assert.equal(
    cutPolyline(moved, LINE.parts, 0.5, LINE.numbers),
    "M0.00 0.00L15.00 0.00",
  );
  assert.equal(
    cutPolyline(moved, LINE.parts, 0.75, LINE.numbers),
    "M0.00 0.00L15.00 0.00L17.50 0.00",
  );
});

/* Stopping puts each piece back to its unswayed shape, but a painter can have written a new one since the sway last
   wrote it, unseen because the stop disconnects the observer first: that newer path is the base, and stays. */
test("stopping keeps a path a painter rewrote since the sway last wrote it", () => {
  assert.equal(restoredShape("M5 5L6 6", "M1 1L2 2", "M0 0L2 2"), "M5 5L6 6");
  assert.equal(restoredShape("M1 1L2 2", "M1 1L2 2", "M0 0L2 2"), "M0 0L2 2");
});

/* The end painter removes a cut's `d` when the fray has no length; the stop must not paint the base back. */
test("stopping leaves a path a painter emptied without a shape", () => {
  assert.equal(restoredShape(null, "M1 1L2 2", "M0 0L2 2"), null);
});

/* A painter's write arrives as two or three records, and the observer shaped the path once for each. A batch shapes
   each path once, and a style change in it decides how. */
test("a batch of records shapes each path once, a style change taking precedence", () => {
  const a = { name: "a" };
  const b = { name: "b" };
  const writes = writesInBatch([
    { target: a, attributeName: "style" },
    { target: b, attributeName: "d" },
    { target: a, attributeName: "d" },
    { target: a, attributeName: "style" },
    { target: b, attributeName: "d" },
  ]);
  assert.deepEqual(
    [...writes],
    [
      [a, true],
      [b, false],
    ],
  );
});
