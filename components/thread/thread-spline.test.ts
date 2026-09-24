import assert from "node:assert/strict";
import { test } from "node:test";
import { splineDirection, splinePath } from "./thread-spline.ts";

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

/* A motif's angle is read off this, so a wrong sign or a swapped axis tilts every motif on the
   page. Three collinear points travelling right are 0 degrees; travelling down are 90. */
test("direction is the direction of travel, in degrees", () => {
  const right = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 20, y: 0 },
  ];
  const down = [
    { x: 0, y: 0 },
    { x: 0, y: 10 },
    { x: 0, y: 20 },
  ];
  assert.equal(Math.round(splineDirection(right, 1)), 0);
  assert.equal(Math.round(splineDirection(down, 1)), 90);
});

test("a spline through many points bends at every one", () => {
  const zigzag = [
    { x: 0, y: 0 },
    { x: 10, y: 5 },
    { x: 0, y: 10 },
    { x: 10, y: 15 },
    { x: 0, y: 20 },
  ];
  const angles = zigzag.map((_, i) => splineDirection(zigzag, i));
  const distinct = new Set(angles.map((a) => Math.round(a / 10)));
  assert.ok(distinct.size > 2, "a zigzag must not resolve to one direction");
});
