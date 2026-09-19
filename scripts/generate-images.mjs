#!/usr/bin/env node
/* Generates `public/` image files from their sources in `assets/`, which is the source of record for
   every image on the site. `output: "export"` copies `public/` wholesale into `out/`, so an original
   left there ships to every guest unreferenced.

   Deliberately not a `prebuild` step: the deploy must not depend on this script succeeding, and a
   generation failure must fail loudly here rather than silently drop an image from a build.

   Usage: npm run images */

import { existsSync, readFileSync } from "node:fs";
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

/* Botanical background layer — DESIGN.md → Botanical Edge. Multiply-blended straight onto the ivory
   ground, so a near-white pixel that isn't quite 255 paints a faint rectangle; measured pure white
   today, kept as a no-op safety net so a regenerated piece can't silently reintroduce one. */
const WHITE_FLOOR = 249;

function clampWhite(data, channels) {
  const out = Buffer.from(data);
  for (let i = 0; i < out.length; i += channels) {
    if (
      out[i] >= WHITE_FLOOR &&
      out[i + 1] >= WHITE_FLOOR &&
      out[i + 2] >= WHITE_FLOOR
    ) {
      out[i] = 255;
      out[i + 1] = 255;
      out[i + 2] = 255;
    }
  }
  return out;
}

/* `tall-column-a`/`-b` carry real ink on their own final row, and `side-spread-right` /
   `side-spread-right` ends within a few px of its own — a hard crop would only move the cut, not remove
   it. This dissolves the bottom 38% into the paper instead, eased rather than linear (a 16% linear
   version read as an abrupt edge). Composited as a white gradient over the image (sharp's default
   "over" blend), so it must be re-clamped afterward — the blend reintroduces 250-254 values at the
   soft end. */
const FADE_STOPS = [
  [0, 0],
  [0.3, 0.04],
  [0.55, 0.16],
  [0.75, 0.42],
  [0.9, 0.74],
  [1, 1],
];
const FADE_FRACTION = 0.38;

async function fadeBase(data, width, height, channels) {
  const y1 = (1 - FADE_FRACTION).toFixed(4);
  const stops = FADE_STOPS.map(
    ([offset, opacity]) =>
      `<stop offset="${offset}" stop-color="#ffffff" stop-opacity="${opacity}"/>`,
  ).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs><linearGradient id="g" x1="0" y1="${y1}" x2="0" y2="1">${stops}</linearGradient></defs><rect width="${width}" height="${height}" fill="url(#g)"/></svg>`;
  const gradient = await sharp(Buffer.from(svg))
    .resize({ width, height, fit: "fill" })
    .png()
    .toBuffer();
  /* `composite()` promotes its output to 4 channels (an alpha band), even though the result is
     already fully opaque — the base carries no alpha, so "over" compositing an alpha-carrying
     overlay onto it always yields outA = 1. Reading the result back declaring the base's original
     channel count would misalign every byte; `removeAlpha` drops the redundant band rather than
     re-flattening a colour that is already correct. */
  const { data: faded } = await sharp(data, {
    raw: { width, height, channels },
  })
    .composite([{ input: gradient }])
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return faded;
}

const FADE_PIECES = new Set(["side-spread-right"]);

/* A piece's on-page width is `k × the ring band it lives in`
   (`components/layout/mounted-sheet-frame.ts` GROUND_TIERS), never a fixed pixel value, so it
   scales with the frame at every tier — `DESIGN.md` → Botanical Edge. `k ≈ g × 0.6` is seeded from
   the placement mock (`tmp/botanical-preview/index.html`'s MADE table) and is PROVISIONAL: Wave 3
   re-measures every piece against real cards with the owner and re-tunes it. Kept as a small,
   re-runnable derivation rather than baked widths so that re-tuning is a constant change, not a
   re-derivation.

   The ring has two bands and a piece lives in one of them, so the band is a property of the PIECE,
   not of the tier: a piece entering from a section's top or bottom edge is sized against
   `--ring-block`, one entering from a side edge against `--ring-side`. Each tier's side figure is
   its LANDSCAPE value, which is the wider of the two orientations and so the worst case the one
   shared file has to cover. */
const RING_BAND = {
  phoneTablet: { block: 48, side: 96 },
  compact: { block: 64, side: 128 },
  laptop: { block: 96, side: 192 },
};

/* Delivery density. 2x is the target so a piece is sharp on a retina screen at the size it actually
   renders; where a source cannot reach it, the resize clamps to the source and the piece ships at
   whatever it has. */
const BOTANICAL_DENSITY = 2;

/* The tuned sizes live in `components/background/botanical.tsx` and are READ from it, never copied.
   A copy here silently drifted once already: the owner re-tuned `k` in the component and the
   delivered rasters kept their original seeded widths, so three pieces shipped below 1x of the size
   they were being drawn at — soft on screen, with nothing failing. Parsed rather than imported
   because this is a plain node script and that file is TSX; the count assertion below is what makes
   the parse trustworthy, since a regex that silently matches nothing looks exactly like success. */
function readTunedTable(name) {
  const source = readFileSync(
    join(ROOT, "components/background/botanical.tsx"),
    "utf8",
  );
  const block = new RegExp(`export const ${name}[^{]*\\{([^}]*)\\}`).exec(
    source,
  );
  if (!block)
    throw new Error(`generate-images: could not find ${name} in botanical.tsx`);
  const table = {};
  for (const [, key, value] of block[1].matchAll(
    /"([a-z-]+)":\s*"?([\w.-]+)"?,/g,
  )) {
    table[key] = Number.isNaN(Number(value)) ? value : Number(value);
  }
  return table;
}

const RING_FRACTION = readTunedTable("RING_FRACTION");
const PIECE_BAND = readTunedTable("RING_BAND");

const BOTANICAL_PIECES = Object.keys(RING_FRACTION).map((name) => ({
  name,
  k: RING_FRACTION[name],
  band: PIECE_BAND[name],
}));

if (BOTANICAL_PIECES.length !== 12) {
  throw new Error(
    `generate-images: parsed ${BOTANICAL_PIECES.length} botanical pieces, expected 12`,
  );
}
for (const piece of BOTANICAL_PIECES) {
  if (!piece.band || !piece.k) {
    throw new Error(
      `generate-images: incomplete tuned values for ${piece.name}`,
    );
  }
}

/* `meadow-band` is the exception: it renders at full window width, not `k × ring`, so its width
   steps are representative window widths rather than a ring multiple — `{breakpoints.md}` for the
   phone+tablet bucket's upper edge, `{breakpoints.xl}` for the compact tier's, and a representative
   wide desktop for laptop (the tier itself is unbounded above). */
const MEADOW_BAND_WIDTH = { phoneTablet: 768, compact: 1600, laptop: 1920 };

/* A piece whose composition roots in one side edge points the wrong way once it is anchored to the
   opposite one, so it is mirrored. The flip is BAKED IN here rather than applied as CSS, because
   `transform: scaleX(-1)` and the standalone `scale` property both create a stacking context, and a
   stacking context isolates the botanical layer's `mix-blend-mode: multiply` — the drawing would
   then paint its white background as a visible rectangle on the ivory. */
const FLIP_H_PIECES = new Set(["corner-spray"]);
const FLIP_V_PIECES = new Set(["tied-bouquet"]);

/* Resizes (never upscaling past the source), mirrors the flipped pieces, clamps to white, and — for
   the four bad-base pieces — fades the bottom edge, re-clamping after. Returns a sharp pipeline
   ready for `.avif()`/`.webp()`. */
async function prepareBotanicalPiece(image, name, width) {
  const sized = image.resize({ width, withoutEnlargement: true });
  let oriented = sized;
  if (FLIP_H_PIECES.has(name)) oriented = oriented.flop();
  if (FLIP_V_PIECES.has(name)) oriented = oriented.flip();
  const resized = oriented;
  const { data, info } = await resized
    .raw()
    .toBuffer({ resolveWithObject: true });
  let pixels = clampWhite(data, info.channels);
  if (FADE_PIECES.has(name)) {
    pixels = await fadeBase(pixels, info.width, info.height, info.channels);
    pixels = clampWhite(pixels, info.channels);
  }
  return sharp(pixels, {
    raw: { width: info.width, height: info.height, channels: info.channels },
  });
}

/* Most pieces survive only as the cropped `.webp` — their lossless originals cannot reproduce them
   (the crop step is lost). Where a true lossless original DOES exist it is the source of record and
   is used directly, so that piece never pays a second generation of encoding loss. */
function botanicalSource(name) {
  const png = join(ROOT, `assets/botanical/${name}.png`);
  return existsSync(png)
    ? `assets/botanical/${name}.png`
    : `assets/botanical/${name}.webp`;
}

function botanicalRecipes() {
  const entries = [];
  const pieces = [
    ...BOTANICAL_PIECES.map((p) => ({
      name: p.name,
      widths: Object.fromEntries(
        Object.entries(RING_BAND).map(([tier, bands]) => [
          tier,
          Math.round(p.k * bands[p.band] * BOTANICAL_DENSITY),
        ]),
      ),
    })),
    {
      name: "meadow-band",
      widths: Object.fromEntries(
        Object.entries(MEADOW_BAND_WIDTH).map(([tier, cssWidth]) => [
          tier,
          Math.round(cssWidth * BOTANICAL_DENSITY),
        ]),
      ),
    },
  ];
  for (const piece of pieces) {
    for (const [tier, width] of Object.entries(piece.widths)) {
      for (const [format, options] of [
        ["avif", { quality: 60 }],
        ["webp", { quality: 82 }],
      ]) {
        entries.push({
          source: botanicalSource(piece.name),
          out: `public/botanical/${piece.name}-${tier}.${format}`,
          recipe: async (image) => {
            const prepared = await prepareBotanicalPiece(
              image,
              piece.name,
              width,
            );
            return format === "avif"
              ? prepared.avif(options)
              : prepared.webp(options);
          },
        });
      }
    }
  }
  return entries;
}

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
  ...botanicalRecipes(),
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
    /* `await` on a recipe's return value is a no-op for the couple's synchronous chains and
       resolves the botanical recipes' async pixel processing (clampWhite/fadeBase) alike. */
    const pipeline = await entry.recipe(sharp(join(ROOT, entry.source)));
    const info = await pipeline.toFile(out);
    console.log(
      `wrote   ${entry.out}  ${(info.size / 1024).toFixed(0)} KB  ${info.width}x${info.height}`,
    );
  }
}

await run();
