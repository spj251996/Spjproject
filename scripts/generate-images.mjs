#!/usr/bin/env node
/* Generates `public/` image files from their sources in `assets/`, which is the source of record for
   every image on the site. `output: "export"` copies `public/` wholesale into `out/`, so an original
   left there ships to every guest unreferenced.

   Deliberately not a `prebuild` step: the deploy must not depend on this script succeeding, and a
   generation failure must fail loudly here rather than silently drop an image from a build.

   Prunes as it finishes: `public/` is copied wholesale into `out/`, so a delivery this script no
   longer writes would keep shipping. Only the directories in `PRUNED_DIRS` are swept.

   Usage: npm run images  ·  npm run images -- --dry-run (lists orphans, deletes nothing) */

import { existsSync } from "node:fs";
import { copyFile, mkdir, readdir, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import sharp from "sharp";
import { TUNING } from "../components/background/botanical-tuning.ts";
/* Extension-qualified and a plain `.ts`: node's type stripping runs it directly, so the tuned
   widths are imported from the one table that paints them instead of parsed out of a component —
   and a regex that silently matches nothing can no longer look exactly like success. */
import { BREAKPOINT_REM } from "../components/layout/mounted-sheet-frame.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/* The couple drawing is trimmed of its own transparent border before resizing: the border is
   lopsided (81px left against 12 right on the source), which pushes the couple off-centre in their
   box. The two widths cover the largest rendered size (470px) at 1x and 2x.

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

/* Delivery density. 2x is the target so a piece is sharp on a retina screen at the size it
   actually renders; where a source cannot reach it, the resize clamps to the source and the piece
   ships at whatever it has. */
const BOTANICAL_DENSITY = 2;

/* The tuned widths are IMPORTED from the table that paints them, never parsed or copied. A copy
   here silently drifted once already: the owner re-tuned a piece in the component and the
   delivered rasters kept their original seeded widths, so three pieces shipped below 1x of the
   size they were drawn at — soft on screen, with nothing failing.

   A piece's width is a fraction of the VIEWPORT, per width tier, so a raster's width is that
   fraction of the widest viewport its tier has to cover. One file per tuning tier: a phone and a
   laptop can tune the same piece to very different fractions, and a file shared between them is
   sized for whichever asked for more.

   `desktop` is unbounded above, so its raster is sized for an assumed 1920 — wider monitors exist
   and would render it softer, but sizing for them costs bytes on every desktop visitor. */
/* The band edges are DERIVED from the layout's own breakpoints, never restated: a raster sized
   against a threshold the CSS no longer gates on is soft at a window nothing would report. One
   pixel below the next breakpoint is the widest window the band still covers. */
const ROOT_FONT_SIZE = 16;
const bandEdge = (rem) => rem * ROOT_FONT_SIZE - 1;

const FILE_TIER = {
  phone: { widest: bandEdge(BREAKPOINT_REM.md), tuning: "phone" },
  /* 1366, not the 1023 that tops the tablet BAND: a portrait window keeps the tablet record at any
     width (`botanical-css.ts`), and the widest portrait screen this has to serve is a 13" tablet
     held upright. Sized for 1023 it would render a third large there, at 1.5x rather than 2x. */
  tablet: { widest: 1366, tuning: "tablet" },
  laptop: { widest: bandEdge(BREAKPOINT_REM.xl), tuning: "laptop" },
  desktop: { widest: 1920, tuning: "desktop" },
};

const BOTANICAL_PIECES = Object.entries(TUNING).map(([name, tiers]) => ({
  name,
  tiers,
}));

/* One piece is still baked upside down: `tied-bouquet` hangs from a top edge rather than standing
   on a bottom one, and the tuned record has no vertical mirror to express that with. The
   HORIZONTAL mirror is never baked — it is a tuned value on the element
   (`botanical-tuning.ts` → `flip`), since an element's own transform isolates its children and not
   its own blending with the ground behind it. Two mechanisms for one mirror is one too many: a
   baked flop and a tuned flip compose, and the file then disagrees with the value that appears to
   set its facing. */
const FLIP_V_PIECES = new Set(["tied-bouquet"]);

/* Resizes (never upscaling past the source), applies the one baked mirror, and clamps near-white to
   pure white so the multiply blend has no halo. Returns a sharp pipeline ready for
   `.avif()`/`.webp()`. */
async function prepareBotanicalPiece(image, name, width) {
  const sized = image.resize({ width, withoutEnlargement: true });
  const resized = FLIP_V_PIECES.has(name) ? sized.flip() : sized;
  const { data, info } = await resized
    .raw()
    .toBuffer({ resolveWithObject: true });
  const pixels = clampWhite(data, info.channels);
  return sharp(pixels, {
    raw: { width: info.width, height: info.height, channels: info.channels },
  });
}

/* Sources are high-quality WebP, not PNG: at the sizes these pieces are delivered the difference
   the container makes is about 1/255 mean against a PNG master — below perception, and the
   delivery step is itself lossy — while the sources go from 19.5MB of committed weight to 2.5MB.
   A PNG is still preferred where one exists, so a piece that arrives lossless stays lossless. */
function botanicalSource(name) {
  const png = join(ROOT, `assets/botanical/${name}.png`);
  return existsSync(png)
    ? `assets/botanical/${name}.png`
    : `assets/botanical/${name}.webp`;
}

function botanicalRecipes() {
  const entries = [];
  /* A piece dropped at a tier gets no file for it: nothing would ever load it, and a file that
     nothing loads is the kind of weight that survives every review. */
  const pieces = BOTANICAL_PIECES.map((p) => ({
    name: p.name,
    widths: Object.fromEntries(
      Object.entries(FILE_TIER)
        .filter(([, { tuning }]) => p.tiers[tuning].drop !== true)
        .map(([tier, { widest, tuning }]) => [
          tier,
          Math.round((p.tiers[tuning].size / 100) * widest * BOTANICAL_DENSITY),
        ]),
    ),
  }));
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

/* Only directories the generator FULLY owns. `public/` root is deliberately absent even though the
   OG card is a pass-through with `outDir: "public"`: the root also holds `robots.txt`, the
   hand-maintained crawler policy the whole unlisted-site decision rests on, so pruning it would
   delete a file no recipe can ever claim. A test asserts this list never contains the root. */
export const PRUNED_DIRS = [
  "public/botanical",
  "public/couple",
  "public/family",
];

/* Every path a run of this script is expected to leave behind, as `public/...` strings. Read from
   `RECIPES` rather than from the filesystem, so it describes what the generator WRITES and not what
   happens to be there -- which is the whole point of comparing the two. */
export async function expectedOutputs() {
  const expected = new Set();
  for (const entry of RECIPES) {
    if (entry.recipe === "pass-through") {
      const names = (await readdir(join(ROOT, entry.sourceDir))).filter(
        (name) => !name.startsWith("."),
      );
      for (const name of names) expected.add(`${entry.outDir}/${name}`);
      continue;
    }
    expected.add(entry.out);
  }
  return expected;
}

/* Pure: the caller supplies the directory's entries, so this is testable without a filesystem and
   without running a generation. Dotfiles are skipped for the same reason the pass-through copy skips
   them -- they are not deliveries, so no recipe can ever expect one. */
export function orphansIn(dir, names, expected) {
  return names
    .filter((name) => !name.startsWith("."))
    .filter((name) => !expected.has(`${dir}/${name}`));
}

/* `public/` is copied wholesale into `out/`, so a delivery the generator no longer writes still
   ships. Pruning runs AFTER every recipe, never before: a failed generation must not take the
   current deliveries with it. */
async function prune({ dryRun }) {
  const expected = await expectedOutputs();
  let removed = 0;
  for (const dir of PRUNED_DIRS) {
    const absolute = join(ROOT, dir);
    if (!existsSync(absolute)) continue;
    for (const name of orphansIn(dir, await readdir(absolute), expected)) {
      if (dryRun) {
        console.log(`would remove  ${dir}/${name}`);
      } else {
        await unlink(join(absolute, name));
        console.log(`removed  ${dir}/${name}`);
      }
      removed += 1;
    }
  }
  console.log(
    removed === 0
      ? "pruned  nothing orphaned"
      : `pruned  ${removed} orphaned file(s)${dryRun ? " (dry run, nothing deleted)" : ""}`,
  );
}

async function run({ dryRun }) {
  /* A dry run reports orphans and generates nothing. The expected set is read from `RECIPES`, never
     from the filesystem, so it needs no generation to be computed -- and rewriting 150 deliveries to
     answer "what would you delete?" would be a surprising thing for the flag's name to mean,
     especially while someone is rendering against the dev server. */
  if (dryRun) {
    await prune({ dryRun });
    return;
  }
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
       resolves the botanical recipes' async pixel processing (clampWhite) alike. */
    const pipeline = await entry.recipe(sharp(join(ROOT, entry.source)));
    const info = await pipeline.toFile(out);
    console.log(
      `wrote   ${entry.out}  ${(info.size / 1024).toFixed(0)} KB  ${info.width}x${info.height}`,
    );
  }
  await prune({ dryRun });
}

/* Guarded so the module can be imported by its test without generating anything. */
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await run({ dryRun: process.argv.includes("--dry-run") });
}
