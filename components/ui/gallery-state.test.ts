import assert from "node:assert/strict";
import test from "node:test";
import {
  back,
  historyDepth,
  openGallery,
  showGrid,
  stepViewer,
  tapTile,
} from "./gallery-state.ts";

test("a strip frame opens the viewer, the +N frame and the action open the grid", () => {
  assert.deepEqual(openGallery(2), {
    layer: "viewer",
    index: 2,
    fromGrid: false,
  });
  assert.deepEqual(openGallery(null), { layer: "grid" });
});

test("back pops one layer: viewer from the grid → grid → closed; viewer from the strip → closed", () => {
  const fromGrid = tapTile(3);
  assert.deepEqual(back(fromGrid), { layer: "grid" });
  assert.equal(back({ layer: "grid" }), null);
  assert.equal(back(openGallery(1)), null);
});

test("history depth matches the layers back can pop", () => {
  assert.equal(historyDepth({ layer: "grid" }), 1);
  assert.equal(historyDepth(openGallery(0)), 1);
  assert.equal(historyDepth(tapTile(0)), 2);
});

test("stepping stops at both ends, and a single photograph cannot step", () => {
  assert.deepEqual(stepViewer(openGallery(0), -1, 4), openGallery(0));
  assert.deepEqual(stepViewer(openGallery(3), 1, 4), openGallery(3));
  assert.deepEqual(stepViewer(openGallery(1), 1, 4), openGallery(2));
  assert.deepEqual(stepViewer(openGallery(0), 1, 1), openGallery(0));
  assert.deepEqual(stepViewer({ layer: "grid" }, 1, 4), { layer: "grid" });
});

test("the grid button shows the grid without growing the history", () => {
  assert.deepEqual(showGrid(openGallery(2)), { layer: "grid" });
  assert.equal(
    historyDepth(showGrid(openGallery(2))),
    historyDepth(openGallery(2)),
  );
});
