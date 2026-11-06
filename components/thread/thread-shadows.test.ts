import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { tokenValue } from "../../scripts/lib/built-tokens.ts";
import { CONTACT_SHADOW, CROSSING_LIFT, HEAD_HALO } from "./thread-shadows.ts";

/* Chosen on a render (DESIGN.md -> Thread -> The contact shadow): pinned so a stray edit cannot move
   the thread off the paper unseen. */
test("the thread's contact shadow falls straight down in the paper's own shadow tint", () => {
  assert.deepEqual(CONTACT_SHADOW.layers, [
    { offsetY: 1, blur: 1.25, colour: "--color-shadow-warm", alpha: 0.65 },
    { offsetY: 4, blur: 6, colour: "--color-shadow-warm", alpha: 0.3 },
  ]);
});

/* Set by eye on the live page (DESIGN.md -> Thread -> Crossings), so pinned to the value itself. */
test("the crossing's lift is the owner's pick: strength 0.7, drop 0.9, softness 0.9", () => {
  assert.deepEqual(CROSSING_LIFT.layers, [
    { offsetY: 0.9, blur: 0.9, colour: "--color-shadow-warm", alpha: 0.7 },
  ]);
});

/* The owner's pick off an iPhone render (2026-11-03, DESIGN.md -> Thread -> The drawing head): three-quarter
   strength, the radii unchanged. Wide radii cost a cliff on every piece's ink but are cheap over the head's own
   tight silhouette, which is all this filter covers; its cost was re-measured at this strength. */
test("the head's halo is thread-vermilion at three-quarter strength", () => {
  assert.deepEqual(
    HEAD_HALO.layers.map(({ blur, alpha, offsetY, colour }) => [
      blur,
      alpha,
      offsetY,
      colour,
    ]),
    [
      [3.5, 0.51, 0, "--color-thread-vermilion"],
      [12, 0.33, 0, "--color-thread-vermilion"],
      [33, 0.225, 0, "--color-thread-vermilion"],
    ],
  );
});

/* Both heads take the one halo: the trunk's and the Wishes card thread's head groups carry the class whose filter
   is the halo token, so the three-quarter strength reaches both. */
test("both heads name the one halo filter", () => {
  const css = readFileSync("components/thread/thread.module.css", "utf8");
  assert.match(css, /\.pageHead\s*\{[^}]*filter:\s*var\(--halo-thread-head\)/);
  for (const file of [
    "components/thread/page-thread.tsx",
    "components/thread/card-thread.tsx",
  ]) {
    assert.match(
      readFileSync(file, "utf8"),
      /className=\{styles\.pageHead\}/,
      `${file} renders its head group with .pageHead`,
    );
  }
});

/* The CSS drop-shadow never paints on an iPhone; a token that went back to one would pass every
   Chromium render. */
test("the shadow and halo tokens name the SVG filters rather than carrying a CSS drop-shadow", () => {
  assert.equal(tokenValue("bleed-thread"), `url(#${CONTACT_SHADOW.id})`);
  assert.equal(tokenValue("halo-thread-head"), `url(#${HEAD_HALO.id})`);
});
