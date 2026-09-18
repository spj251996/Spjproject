#!/usr/bin/env node
/* Generates `public/` image files from their sources in `assets/`, which is the source of record for
   every image on the site. `output: "export"` copies `public/` wholesale into `out/`, so an original
   left there ships to every guest unreferenced.

   Deliberately not a `prebuild` step: the deploy must not depend on this script succeeding, and a
   generation failure must fail loudly here rather than silently drop an image from a build.

   Usage: npm run images */

import { copyFile, mkdir, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/* The couple drawing is trimmed of its own transparent border before resizing: the border is
   lopsided (81px left against 12 right on the source), which pushes the couple off-centre in their
   box. The two widths cover the largest rendered size (550px) at 1x and 2x.

   One entry per image family. `pass-through` is a real recipe, not a stub: the ten portraits are
   already web-sized files with no larger original, so re-encoding today's placeholders would change
   `content/family.ts`'s paths for no visual gain. When the full-resolution portraits arrive, this
   entry becomes a resize-and-encode like the couple's. */
/* The couple drawing is held back so it sits behind the closing text rather than competing with
   it — desaturated and slightly transparent. Baked into the file rather than applied as a CSS
   filter: the values are settled, and a filter on a layer this large is paint work on every frame
   for a result that never changes. `dest-in` multiplies the alpha channel; the drawing already
   carries transparency, so this scales what is there rather than adding a matte. */
const HELD_BACK_SATURATION = 0.7;
const HELD_BACK_ALPHA = Math.round(0.9 * 255);

const holdBack = (image) =>
  image.modulate({ saturation: HELD_BACK_SATURATION }).composite([
    {
      input: Buffer.from([255, 255, 255, HELD_BACK_ALPHA]),
      raw: { width: 1, height: 1, channels: 4 },
      tile: true,
      blend: "dest-in",
    },
  ]);

const RECIPES = [
  /* Wishes' illustration renders at a fixed 320px CSS box (`--wishes-illustration`), never larger, so
     these two widths are its 1x and 2x delivery rather than one oversized file for every screen. */
  {
    source: "assets/couple/couple.png",
    out: "public/couple/couple-1x.avif",
    recipe: (image) =>
      holdBack(image.trim({ threshold: 0 }).resize({ width: 560 })).avif({
        quality: 60,
      }),
  },
  {
    source: "assets/couple/couple.png",
    out: "public/couple/couple-1x.webp",
    recipe: (image) =>
      holdBack(image.trim({ threshold: 0 }).resize({ width: 560 })).webp({
        quality: 82,
      }),
  },
  {
    source: "assets/couple/couple.png",
    out: "public/couple/couple-2x.avif",
    /* AVIF at 1.5x rather than WebP at 2x: for a soft pencil drawing with no fine text 840px is
       indistinguishable from 1120 on a retina screen, and AVIF is less than a third of WebP's size
       here — 126 KB against 409. The WebP below stays as the fallback for engines without AVIF. */
    recipe: (image) =>
      holdBack(image.trim({ threshold: 0 }).resize({ width: 840 })).avif({
        quality: 50,
      }),
  },
  {
    source: "assets/couple/couple.png",
    out: "public/couple/couple-2x.webp",
    recipe: (image) =>
      holdBack(image.trim({ threshold: 0 }).resize({ width: 840 })).webp({
        quality: 72,
      }),
  },
  {
    sourceDir: "assets/family",
    outDir: "public/family",
    recipe: "pass-through",
  },
  /* The link-preview card, already baked at its delivery size by the card generator, so this is a
     pass-through like the family portraits rather than a resize. It is 1200x630 because that is what
     the OpenGraph consumers expect; re-encoding here would only cost a second generation of JPEG loss. */
  {
    sourceDir: "assets/og",
    outDir: "public",
    recipe: "pass-through",
  },
];

async function run() {
  for (const entry of RECIPES) {
    if (entry.recipe === "pass-through") {
      const dir = join(ROOT, entry.sourceDir);
      const outDir = join(ROOT, entry.outDir);
      await mkdir(outDir, { recursive: true });
      const names = (await readdir(dir)).filter((n) => !n.startsWith("."));
      for (const name of names) {
        await copyFile(join(dir, name), join(outDir, name));
        console.log(`copied  ${entry.outDir}/${name}`);
      }
      continue;
    }
    const out = join(ROOT, entry.out);
    await mkdir(dirname(out), { recursive: true });
    const info = await entry
      .recipe(sharp(join(ROOT, entry.source)))
      .toFile(out);
    console.log(
      `wrote   ${entry.out}  ${(info.size / 1024).toFixed(0)} KB  ${info.width}x${info.height}`,
    );
  }
}

await run();
