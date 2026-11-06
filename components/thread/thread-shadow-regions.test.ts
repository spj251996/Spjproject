import assert from "node:assert/strict";
import test from "node:test";
import { fittedRegion, reachOf, recipeIdOf } from "./thread-shadow-regions.ts";
import { CONTACT_SHADOW, HEAD_HALO } from "./thread-shadows.ts";

test("a token's filter id is read in every form a computed style returns it", () => {
  assert.equal(
    recipeIdOf("url(#thread-contact-shadow)"),
    "thread-contact-shadow",
  );
  assert.equal(recipeIdOf(' url("#thread-head-halo") '), "thread-head-halo");
  assert.equal(recipeIdOf("url('#a-b')"), "a-b");
  assert.equal(recipeIdOf("none"), undefined);
  assert.equal(recipeIdOf(""), undefined);
});

/* A region short of the reach clips the soft edge of the lift, which is what the bounding-box region
   did to near-flat stretches. */
test("a fitted region reaches each filter's furthest layer by three standard deviations", () => {
  assert.equal(reachOf(CONTACT_SHADOW), 4 + 3 * 6);
  assert.equal(reachOf(HEAD_HALO), 3 * 33);
});

test("a fitted region grows the box by the margin on every side", () => {
  assert.deepEqual(
    fittedRegion({ x: 10, y: 8000, width: 300, height: 0.5 }, 30),
    {
      x: -20,
      y: 7970,
      width: 360,
      height: 60.5,
    },
  );
});
