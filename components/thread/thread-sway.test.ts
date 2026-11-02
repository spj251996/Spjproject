import assert from "node:assert/strict";
import { test } from "node:test";
import { flatten } from "./thread-sway.ts";

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
