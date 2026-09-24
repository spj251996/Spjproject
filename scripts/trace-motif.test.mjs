// scripts/trace-motif.test.mjs — a straight stroke's centreline is a straight line
import assert from "node:assert/strict";
import { test } from "node:test";
import { centreline } from "./trace-motif.mjs";

test("a rectangle's centreline is its long axis", async () => {
  // A 200x20 filled rectangle is a straight stroke 20 wide; its skeleton is the horizontal midline.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 60"><path fill="#000" d="M 20 20 H 220 V 40 H 20 Z"/></svg>`;
  const { points } = await centreline(svg, { width: 240 });
  const ys = points.map((p) => p.y);
  const spread = Math.max(...ys) - Math.min(...ys);
  assert.ok(
    spread < 2,
    `centreline wanders ${spread.toFixed(2)}px off the midline`,
  );
  assert.ok(points.length > 20, "too few points to fit a curve");
});

/* The junction rule is the whole reason a self-crossing motif comes out as one rope: at a crossing
   the walk must carry on rather than turn into the other stroke. Falsified in Task 3 by swapping
   `chooseContinuation` for a nearest-branch rule, which turns this X's corner and fails the 30deg
   assertion — see .superpowers/sdd/task-3-report.md for the measured angles. */
test("the walk passes straight through a crossing rather than turning", async () => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240"><path fill="none" stroke="#000" stroke-width="14" d="M 20 20 L 220 220 M 220 20 L 20 220"/></svg>`;
  const { points } = await centreline(svg, { width: 240 });

  const crossing = points.reduce(
    (best, p, i) => {
      const distance = Math.hypot(p.x - 120, p.y - 120);
      return distance < best.distance ? { index: i, distance } : best;
    },
    { index: -1, distance: Infinity },
  );
  assert.ok(crossing.distance < 6, "the walk never reached the crossing");
  assert.ok(
    crossing.index > 30 && crossing.index < points.length - 30,
    `the walk stopped at the crossing instead of passing through it (${crossing.index} of ${points.length})`,
  );

  const heading = (a, b) =>
    Math.atan2(points[b].y - points[a].y, points[b].x - points[a].x);
  const before = heading(crossing.index - 30, crossing.index - 10);
  const after = heading(crossing.index + 10, crossing.index + 30);
  const turn =
    Math.abs(((before - after + Math.PI) % (2 * Math.PI)) - Math.PI) *
    (180 / Math.PI);
  assert.ok(
    turn < 30,
    `the walk turned ${turn.toFixed(1)} degrees at the crossing`,
  );
});
