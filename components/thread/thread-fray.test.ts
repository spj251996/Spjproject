import assert from "node:assert/strict";
import test from "node:test";
import {
  cordDrawn,
  END_CUT_WIDTH,
  endCut,
  FRAY,
  FRAY_FIBRES,
  frayShape,
  placeFray,
} from "./thread-fray.ts";

const WIDTH = 2.2;

test("five fibres, the same on every call", () => {
  const shape = frayShape(WIDTH);
  assert.equal(shape.fibres.length, FRAY_FIBRES);
  assert.equal(FRAY_FIBRES, 5);
  assert.deepEqual(frayShape(WIDTH), shape);
});

test("fibres scale with the cord", () => {
  const thin = frayShape(WIDTH);
  const thick = frayShape(2 * WIDTH);
  assert.ok(Math.abs(thick.length - 2 * thin.length) < 1e-9);
  thin.fibres.forEach((fibre, index) => {
    assert.ok(Math.abs(thick.fibres[index].width - 2 * fibre.width) < 1e-9);
  });
});

test("every fibre starts inside the cord at the cut and is finer than it", () => {
  for (const fibre of frayShape(WIDTH).fibres) {
    const [x, y] = fibre.from;
    assert.ok(x <= 0, `fibre starts ${x}px past the cut`);
    assert.ok(Math.abs(y) <= WIDTH / 2, `fibre starts ${y}px off the cord`);
    assert.ok(fibre.width < WIDTH);
  }
});

test("the fray's length is its farthest fibre tip", () => {
  const shape = frayShape(WIDTH);
  const tips = shape.fibres.map((fibre) => fibre.to[0]);
  assert.equal(shape.length, Math.max(...tips));
  assert.ok(
    shape.length > WIDTH,
    "the fibres are longer than the cord is wide",
  );
});

test("placeFray lays the fibres along the end's own direction", () => {
  const shape = frayShape(WIDTH);
  /* An end pointing straight down from (100, 50): local +x is page +y. */
  const placed = placeFray(shape, { x: 100, y: 50, tx: 0, ty: 1 });
  assert.equal(placed.length, FRAY_FIBRES);
  const farthest = shape.fibres.findIndex(
    (fibre) => fibre.to[0] === shape.length,
  );
  const numbers = (placed[farthest].match(/-?\d*\.?\d+/g) ?? []).map(Number);
  const [tipX, tipY] = numbers.slice(-2);
  assert.ok(Math.abs(tipY - (50 + shape.length)) < 0.01);
  assert.ok(Math.abs(tipX - 100) <= WIDTH * 2);
});

test("cordDrawn trails by the fray and lands whole", () => {
  assert.equal(cordDrawn(100, 1000, 6), 94);
  assert.equal(cordDrawn(3, 1000, 6), 0);
  assert.equal(cordDrawn(1000, 1000, 6), 1000);
  assert.equal(cordDrawn(1200, 1000, 6), 1000);
});

test("endCut takes the ink's cap past a free end", () => {
  const forwards = endCut(400, 400, 1, 6);
  assert.equal(forwards.from, 394);
  assert.equal(forwards.to, 400 + END_CUT_WIDTH / 2);
  const backwards = endCut(0, 400, -1, 6);
  assert.equal(backwards.from, -END_CUT_WIDTH / 2);
  assert.equal(backwards.to, 6);
  assert.ok(END_CUT_WIDTH / 2 > WIDTH / 2 + 1);
});

/* Set by eye on the live page (DESIGN.md -> Thread -> The frayed ends), so pinned to the value itself. */
test("the fibres are the owner's pick: reach 3.6, splay 0.9, width 0.34", () => {
  assert.deepEqual(FRAY, { reach: 3.6, spread: 0.9, width: 0.34, seed: 11 });
});
