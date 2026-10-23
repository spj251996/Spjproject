import assert from "node:assert/strict";
import test from "node:test";
import {
  containedRect,
  insideRect,
  isDeliberateTap,
} from "./gallery-pointer.ts";

test("a portrait in a landscape box draws centred, with bars at the sides", () => {
  const drawn = containedRect(
    { left: 0, top: 100, width: 1000, height: 500 },
    { width: 600, height: 1200 },
  );
  assert.deepEqual(drawn, { left: 375, top: 100, width: 250, height: 500 });
});

test("a landscape in a portrait box draws centred, with bars above and below", () => {
  const drawn = containedRect(
    { left: 10, top: 0, width: 400, height: 800 },
    { width: 2000, height: 1000 },
  );
  assert.deepEqual(drawn, { left: 10, top: 300, width: 400, height: 200 });
});

test("an image with no natural size yet draws nowhere", () => {
  const drawn = containedRect(
    { left: 0, top: 0, width: 400, height: 800 },
    { width: 0, height: 0 },
  );
  assert.equal(drawn.width, 0);
  assert.equal(drawn.height, 0);
});

test("a move under 10px is a tap; 10px is not", () => {
  assert.equal(isDeliberateTap({ x: 0, y: 0 }, { x: 9, y: 0 }), true);
  assert.equal(isDeliberateTap({ x: 0, y: 0 }, { x: 10, y: 0 }), false);
  assert.equal(isDeliberateTap({ x: 0, y: 0 }, { x: 6, y: 8 }), false);
});

test("a letterbox point is outside the drawn photograph and its centre is inside", () => {
  const drawn = containedRect(
    { left: 0, top: 0, width: 1000, height: 500 },
    { width: 600, height: 1200 },
  );
  assert.equal(insideRect({ x: 100, y: 250 }, drawn), false);
  assert.equal(insideRect({ x: 500, y: 250 }, drawn), true);
});
