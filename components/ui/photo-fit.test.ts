import assert from "node:assert/strict";
import { test } from "node:test";
import { cappedAspect, photoFit } from "./photo-fit.ts";

const A = { wide: 2.64, land: 1.6, sq: 1.0, tall: 0.67 };
const aspects = {
  "/w.jpg": A.wide,
  "/l.jpg": A.land,
  "/s.jpg": A.sq,
  "/t.jpg": A.tall,
};

test("a frame wider than the cap is laid out as the cap", () => {
  assert.equal(cappedAspect("/w.jpg", aspects, 1.5), 1.5);
  assert.equal(cappedAspect("/t.jpg", aspects, 1.5), 0.67);
});

test("one panorama does not shorten the row for every other ritual", () => {
  const sets = { a: ["/s.jpg", "/s.jpg"], b: ["/w.jpg", "/w.jpg"] };
  const capped = photoFit(sets, 150, 600, aspects, 1.5);
  const uncapped = photoFit(sets, 150, 600, aspects, Number.POSITIVE_INFINITY);
  assert.equal(capped.rowHeight, 150);
  assert.ok(
    uncapped.rowHeight < 150,
    "uncapped must collapse — otherwise this test proves nothing",
  );
});

test("the row height is solved across every ritual, not just the first", () => {
  /* `b` binds and `a` does not, so a solve that stops at the first ritual returns the nominal 150
     and `b`'s row then overflows its block. Asserting only that the height is a finite number
     passes that mutation — the property is that EVERY ritual's row fits at the one height. */
  const sets = { a: ["/t.jpg", "/t.jpg"], b: ["/l.jpg", "/l.jpg"] };
  const available = 400;
  const fit = photoFit(sets, 150, available, aspects, 1.5);
  assert.ok(fit.rowHeight > 0 && Number.isFinite(fit.rowHeight));
  assert.ok(
    fit.rowHeight < 150,
    "the binding ritual must pull the shared height down",
  );
  for (const [id, photos] of Object.entries(sets)) {
    const width =
      photos.reduce(
        (total, src) => total + cappedAspect(src, aspects, 1.5) * fit.rowHeight,
        0,
      ) + 8;
    assert.ok(
      width <= available,
      `${id} overflows its block at the shared height: ${width} > ${available}`,
    );
  }
});

test("three frames when three fit, two when they do not", () => {
  const sets = { a: ["/s.jpg", "/s.jpg", "/s.jpg"] };
  assert.equal(photoFit(sets, 100, 400, aspects, 1.5).shown.a, 3);
  assert.equal(photoFit(sets, 100, 220, aspects, 1.5).shown.a, 2);
});

// Review Focus 1
test("a single-photograph ritual yields one frame and a finite height", () => {
  const fit = photoFit({ a: ["/s.jpg"] }, 150, 400, aspects, 1.5);
  assert.equal(fit.shown.a, 1);
  assert.ok(Number.isFinite(fit.rowHeight) && fit.rowHeight > 0);
});

// Review Focus 2
test("an unresolved aspect does not stall or zero the row", () => {
  const fit = photoFit({ a: ["/missing.jpg", "/s.jpg"] }, 150, 400, {}, 1.5);
  assert.equal(fit.ready, false);
  assert.ok(Number.isFinite(fit.rowHeight) && fit.rowHeight > 0);
});

// Review Focus 3 — this exact class killed a renderer in this project
test("zero available width never divides by zero", () => {
  const fit = photoFit({ a: ["/s.jpg", "/s.jpg"] }, 150, 0, aspects, 1.5);
  assert.ok(Number.isFinite(fit.rowHeight) && fit.rowHeight > 0);
  assert.equal(fit.ready, false);
});

test("no rituals at all is not an error", () => {
  const fit = photoFit({}, 150, 400, aspects, 1.5);
  assert.deepEqual(fit.shown, {});
  assert.ok(Number.isFinite(fit.rowHeight));
});
