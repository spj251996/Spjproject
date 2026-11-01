import assert from "node:assert/strict";
import test from "node:test";
import {
  back,
  createGalleryHistory,
  type GalleryState,
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

test("stepping stops at both ends, and a single photograph cannot step", () => {
  assert.deepEqual(stepViewer(openGallery(0), -1, 4), openGallery(0));
  assert.deepEqual(stepViewer(openGallery(3), 1, 4), openGallery(3));
  assert.deepEqual(stepViewer(openGallery(1), 1, 4), openGallery(2));
  assert.deepEqual(stepViewer(openGallery(0), 1, 1), openGallery(0));
  assert.deepEqual(stepViewer({ layer: "grid" }, 1, 4), { layer: "grid" });
});

test("the grid button shows the grid without growing the history", () => {
  assert.deepEqual(showGrid(openGallery(2)), { layer: "grid" });
  /* Shown in place, so one back still closes: no grid entry was pushed to pop. */
  assert.equal(back(showGrid(openGallery(2))), null);
});

/* A browser history whose `back()` lands only when the test says so, as a real one lands
   asynchronously; `forward()` is the browser's own Forward button. */
function fakeBrowser() {
  const entries: unknown[] = [{ page: true }];
  let at = 0;
  let pending = 0;
  const history = {
    get state() {
      return entries[at];
    },
    pushState(data: unknown, _unused: string) {
      entries.splice(at + 1, entries.length, data);
      at += 1;
    },
    back() {
      pending += 1;
    },
  };
  return {
    history,
    get at() {
      return at;
    },
    get entries() {
      return entries.length;
    },
    get pending() {
      return pending;
    },
    landBack() {
      assert.ok(pending > 0, "no back was asked for");
      pending -= 1;
      at -= 1;
    },
    forward() {
      at += 1;
    },
  };
}

const grid: GalleryState = { layer: "grid" };

test("opening pushes one gallery entry, however often the mount runs", () => {
  const browser = fakeBrowser();
  const gallery = createGalleryHistory(browser.history);
  gallery.open();
  gallery.open();
  assert.equal(browser.entries, 2);
  assert.deepEqual(browser.history.state, { gallery: 1 });
});

test("a second Close before the first back has landed steps the history once, not twice", () => {
  const browser = fakeBrowser();
  const gallery = createGalleryHistory(browser.history);
  gallery.open();
  gallery.goBack();
  gallery.goBack();
  assert.equal(browser.pending, 1);
  browser.landBack();
  assert.equal(gallery.pop(grid), "close");
  assert.equal(browser.at, 0);
});

test("once a back has landed, the next Close steps again", () => {
  const browser = fakeBrowser();
  const gallery = createGalleryHistory(browser.history);
  gallery.open();
  assert.equal(gallery.openPhoto(), true);
  gallery.goBack();
  browser.landBack();
  assert.deepEqual(gallery.pop(tapTile(2)), grid);
  assert.equal(gallery.closing, false);
  gallery.goBack();
  assert.equal(browser.pending, 1);
});

test("ordinary back pops: grid-opened viewer → grid → closed; strip-opened viewer → closed", () => {
  const fromGrid = fakeBrowser();
  const gallery = createGalleryHistory(fromGrid.history);
  gallery.open();
  gallery.openPhoto();
  gallery.goBack();
  fromGrid.landBack();
  assert.deepEqual(gallery.pop(tapTile(0)), grid);
  gallery.goBack();
  fromGrid.landBack();
  assert.equal(gallery.pop(grid), "close");
  assert.equal(gallery.closing, true);

  const fromStrip = fakeBrowser();
  const strip = createGalleryHistory(fromStrip.history);
  strip.open();
  strip.goBack();
  fromStrip.landBack();
  assert.equal(strip.pop(openGallery(1)), "close");
  assert.equal(fromStrip.at, 0);
});

test("once closing, nothing more is asked of the history and a further pop is not ours", () => {
  const browser = fakeBrowser();
  const gallery = createGalleryHistory(browser.history);
  gallery.open();
  gallery.goBack();
  browser.landBack();
  assert.equal(gallery.pop(grid), "close");
  gallery.goBack();
  assert.equal(browser.pending, 0);
  assert.equal(gallery.openPhoto(), false);
  assert.equal(browser.entries, 2);
  assert.equal(gallery.pop(grid), "ignore");
  assert.equal(gallery.closing, true);
});

test("Forward onto the photograph's entry while the grid is shown leaves the gallery open and strands no entry", () => {
  const browser = fakeBrowser();
  const gallery = createGalleryHistory(browser.history);
  gallery.open();
  gallery.openPhoto();
  gallery.goBack();
  browser.landBack();
  assert.deepEqual(gallery.pop(tapTile(0)), grid);

  browser.forward();
  assert.deepEqual(browser.history.state, { gallery: 2 });
  assert.equal(gallery.pop(grid), "ignore");
  assert.equal(gallery.closing, false);
  /* Stepped straight back past it, and that step's own pop changes nothing either. */
  assert.equal(browser.pending, 1);
  browser.landBack();
  assert.equal(gallery.pop(grid), "ignore");
  assert.equal(gallery.closing, false);

  /* So the grid's Close still lands on the page's own entry. */
  gallery.goBack();
  assert.equal(browser.pending, 1);
  browser.landBack();
  assert.equal(gallery.pop(grid), "close");
  assert.equal(browser.at, 0);
});
