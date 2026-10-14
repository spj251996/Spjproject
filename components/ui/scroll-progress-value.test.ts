import assert from "node:assert/strict";
import test from "node:test";
import { scrollProgress } from "./scroll-progress-value.ts";

test("the fill is the share of the scrollable range already scrolled", () => {
  assert.equal(scrollProgress(0, 3000, 1000), 0);
  assert.equal(scrollProgress(1000, 3000, 1000), 0.5);
  assert.equal(scrollProgress(2000, 3000, 1000), 1);
});

test("rubber-band overscroll at either end is clamped, never outside 0-1", () => {
  assert.equal(scrollProgress(-40, 3000, 1000), 0);
  assert.equal(scrollProgress(2040, 3000, 1000), 1);
});

test("a page with nothing to scroll reads as wholly seen, never NaN", () => {
  assert.equal(scrollProgress(0, 800, 800), 1);
  assert.equal(scrollProgress(0, 600, 800), 1);
});
