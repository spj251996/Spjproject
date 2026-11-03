import assert from "node:assert/strict";
import { test } from "node:test";
import { cutPolyline, flatten } from "./thread-sway.ts";

/* The sway moves points, so a cubic it moved only at its control points could not follow the field
   between them the way the 1px re-trace laid on it does. Flattened, both are polylines. */
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
