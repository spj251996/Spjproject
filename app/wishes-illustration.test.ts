import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const wishes = readFileSync("app/_sections/wishes.tsx", "utf8");
const css = readFileSync("app/wishes.module.css", "utf8");

/* Owner, 2026-10-14: the illustration downloads only as Wishes nears the screen. A CSS background
   is fetched at first paint wherever it sits on the page; a lazy <img> is not. */
test("the illustration is a lazy, decorative <img> with AVIF and WebP sources", () => {
  assert.match(wishes, /<picture>/);
  assert.match(
    wishes,
    /srcSet="\/couple\/couple-1x\.avif 1x, \/couple\/couple-2x\.avif 2x"\s*type="image\/avif"/,
  );
  assert.match(
    wishes,
    /srcSet="\/couple\/couple-1x\.webp 1x, \/couple\/couple-2x\.webp 2x"\s*type="image\/webp"/,
  );
  assert.match(wishes, /loading="lazy"/);
  assert.match(wishes, /decoding="async"/);
  assert.match(wishes, /alt=""/);
  assert.doesNotMatch(css, /background-image/);
});

/* The portraits' save cover. `.figure` is `pointer-events: none`, which the cover would inherit and
   so never take a hit — so it takes its pointer events back, and the image beneath it is what a
   right-click or long-press can no longer reach. */
test("a save cover that takes the hit sits over the illustration", () => {
  assert.match(
    wishes,
    /<span\s+aria-hidden="true"\s+className="pointer-events-auto absolute inset-0"\s*\/>/,
  );
});
