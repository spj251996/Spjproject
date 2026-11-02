import assert from "node:assert/strict";
import test from "node:test";
import { tokenValue } from "../../scripts/lib/built-tokens.ts";
import { CONTACT_SHADOW, HEAD_HALO } from "./thread-shadows.ts";

/* Chosen on a render (DESIGN.md -> Thread -> The contact shadow): pinned so a stray edit cannot move
   the thread off the paper unseen. */
test("the thread's contact shadow falls straight down in the paper's own shadow tint", () => {
  assert.deepEqual(CONTACT_SHADOW.layers, [
    { offsetY: 1, blur: 1.25, colour: "--color-shadow-warm", alpha: 0.65 },
    { offsetY: 4, blur: 6, colour: "--color-shadow-warm", alpha: 0.3 },
  ]);
});

/* Any failure here is also a prompt to re-fit `FITTED_GLOW` (`thread-retrace.ts`): the re-trace's eight
   glow alphas were fitted to the falloff of exactly these radii and alphas, so retuning the halo
   leaves them describing a halo that no longer exists. */
test("the head's halo keeps the radii and strengths FITTED_GLOW was fitted to", () => {
  assert.deepEqual(
    HEAD_HALO.layers.map(({ blur, alpha, offsetY, colour }) => [
      blur,
      alpha,
      offsetY,
      colour,
    ]),
    [
      [3.5, 0.34, 0, "--color-thread-vermilion"],
      [12, 0.22, 0, "--color-thread-vermilion"],
      [33, 0.15, 0, "--color-thread-vermilion"],
    ],
    "the halo changed: FITTED_GLOW's eight alphas were fitted to the falloff of THESE radii " +
      "and alphas, so re-fit them and re-measure MEASURED_HALO before updating this expectation",
  );
});

/* The CSS drop-shadow never paints on an iPhone; a token that went back to one would pass every
   Chromium render. */
test("the shadow and halo tokens name the SVG filters rather than carrying a CSS drop-shadow", () => {
  assert.equal(tokenValue("bleed-thread"), `url(#${CONTACT_SHADOW.id})`);
  assert.equal(tokenValue("halo-thread-head"), `url(#${HEAD_HALO.id})`);
});
