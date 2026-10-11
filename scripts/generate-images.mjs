#!/usr/bin/env node
/* Generates `public/` image files from their sources in `assets/`, which is the source of record for
   every image on the site. `output: "export"` copies `public/` wholesale into `out/`, so an original
   left there ships to every guest unreferenced.

   NOT a `prebuild` step for the botanical, couple and OG families: the deploy must not depend on
   re-encoding 152 files that only change when someone is already at a keyboard.

   THE RITUALS FAMILY IS THE EXCEPTION, and it runs on the deploy — `prebuild` calls
   `--only=rituals`. Its inputs arrive by phone upload into `assets/rituals/`, so nobody will run a
   command afterwards. The refusal above was protecting against a generation failure silently
   dropping an image from a build; a build-time generator that throws fails the deploy loudly
   instead, which is the stronger guarantee of the two.

   Prunes as it finishes: `public/` is copied wholesale into `out/`, so a delivery this script no
   longer writes would keep shipping. Only the directories in `PRUNED_DIRS` are swept.

   Usage: npm run images  ·  npm run images -- --dry-run (lists orphans, deletes nothing)
          npm run images -- --only=rituals  (the ritual photographs and their manifest only) */

import { existsSync } from "node:fs";
import {
  copyFile,
  mkdir,
  readdir,
  rm,
  unlink,
  writeFile,
} from "node:fs/promises";
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

/* THE RITUAL PHOTOGRAPHS — the one family that generates on the DEPLOY rather than locally, and the
   reason this script's header now qualifies its own refusal to be a prebuild step. The botanical,
   couple and OG inputs change when someone is already at a keyboard; these arrive by phone upload
   into `assets/rituals/<ritual-id>/`, and nobody will run a command afterwards. The header's fear is
   answered rather than ignored: a build-time generator that throws fails the deploy loudly and cannot
   silently drop an image, which is exactly what local generation does when the command is forgotten.

   A third kind, because it is neither a single source/out pair nor a pass-through: it scans a
   directory per ritual, emits two copies per photograph, and writes the dimensions module the page
   reads. It is deliberately NOT a member of `RECIPES` — keeping it out leaves `expectedOutputs()`,
   `orphansIn()` and the prune untouched, and it needs none of them because it wipes its own output
   directory wholesale. */
const RITUAL_SOURCE_ROOT = "assets/rituals";
const RITUAL_OUT_ROOT = "public/rituals";
const RITUAL_MANIFEST = "content/ritual-photos.generated.ts";

/* The strip's tile is `aspect * rowHeight` with aspect capped at 1.5 (`photo-fit.ts` →
   DEFAULT_ASPECT_CAP) and rowHeight topping out at 150 in the `wide` band, so a tile is never wider
   than 225px — 600 covers it at 2.5x. The overlay's `columns-2 lg:columns-3` inside `p-space-md`
   gives a ~480px column at 1536 and ~170px at 393, so 1000 covers both at 2x.

   BOTH ARE UPPER BOUNDS, which is why the couple's open ritual-alignment lever cannot invalidate
   them: a narrower ritual block solves a SHORTER row height and a smaller tile. Only the recorded
   section height moves. */
const RITUAL_THUMB_WIDTH = 600;
const RITUAL_DISPLAY_WIDTH = 1000;

/* `heic`/`heif` are listed so an iPhone upload is ATTEMPTED and fails loudly naming the file, rather
   than skipped as unrecognised. This libvips build cannot encode HEVC (`heifsave: Unsupported
   compression`, measured), so decoding an iPhone HEIC may well fail too — which is the point.
   Anything outside this set throws rather than being skipped: a silently skipped photograph is a
   photograph the couple sent and nobody sees. */
const RITUAL_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".avif",
  ".heic",
  ".heif",
]);

/** The delivery's name without its extension. Pure. */
export function outputBaseName(fileName) {
  const dot = fileName.lastIndexOf(".");
  return dot <= 0 ? fileName : fileName.slice(0, dot);
}

/* Pure, so the emitted module's shape is testable without generating an image. Written to Biome's
   defaults as a courtesy only — `biome.json` sets `vcs.useIgnoreFile`, so the gitignored manifest is
   never linted or formatted. */
export function ritualManifestSource(photosByRitual) {
  const header = `/* GENERATED by scripts/generate-images.mjs — do not edit, and do not commit.
 *
 * One entry per ritual folder in \`assets/rituals/\`, an empty list where it holds none, keyed by the
 * ritual's id in \`content/rituals.ts\`, in the order the files sort by name. Regenerate with \`npm run images -- --only=rituals\`, which
 * \`prebuild\` runs on every build.
 *
 * NOT exported from \`content/index.ts\`, and that is load-bearing: \`content/verify.ts\` imports the
 * barrel and runs BEFORE the generator in \`prebuild\`, so a barrel export would make the check
 * depend on the file the check runs before. */
import type { RitualPhoto } from "./types.ts";
`;
  const ids = Object.keys(photosByRitual);
  if (ids.length === 0) {
    return `${header}
export const ritualPhotos: Record<string, RitualPhoto[]> = {};
`;
  }
  const body = ids
    .map((id) => {
      const rows = photosByRitual[id]
        .map(
          (photo) =>
            `    {\n      thumb: ${JSON.stringify(photo.thumb)},\n      display: ${JSON.stringify(photo.display)},\n      width: ${photo.width},\n      height: ${photo.height},\n    },`,
        )
        .join("\n");
      return `  ${JSON.stringify(id)}: [\n${rows}\n  ],`;
    })
    .join("\n");
  return `${header}
export const ritualPhotos: Record<string, RitualPhoto[]> = {
${body}
};
`;
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

/* `.rotate()` with NO argument applies the file's own EXIF orientation, and it is not optional
   decoration. Measured on this sharp build: a 200x100 image tagged orientation 6 reports
   `metadata()` as 200x100 — its STORED size — and `resize({ width: 50 })` yields 50x25 without
   `.rotate()` against 50x100 with it. So an un-rotated phone portrait is both emitted sideways AND
   recorded with its width and height swapped; a swapped aspect feeds `photoFit`, which solves ONE
   row height across every ritual, so a single sideways portrait moves the whole section's height —
   and the thread's measured constants derive from that height.

   Exported so the rotation is tested on a tagged fixture: the stand-in photographs carry no
   orientation tag, so removing `.rotate()` changes nothing they produce. */
export function uprightRitualImage(input) {
  return sharp(input).rotate();
}

/* `outRoot` is injectable so the test can assert on the ROW the manifest records, written to a temp
   directory. The web path is URL-encoded because a filename renamed by hand can carry a `#` or `?`,
   which a browser would otherwise read as a fragment or query and 404 on; the disk path is not. */
/* Decode and encode into MEMORY. A failure here is about the PHOTOGRAPH; a failure in
   `writeRitualDeliveries` is about the DISK. One catch around both once blamed a full disk on HEIC. */
async function encodeRitualPhoto(sourcePath, ritualId, fileName) {
  const label = `${RITUAL_SOURCE_ROOT}/${ritualId}/${fileName}`;
  try {
    const thumb = await uprightRitualImage(sourcePath)
      .resize({ width: RITUAL_THUMB_WIDTH, withoutEnlargement: true })
      .avif({ quality: 55 })
      .toBuffer({ resolveWithObject: true });
    const display = await uprightRitualImage(sourcePath)
      .resize({ width: RITUAL_DISPLAY_WIDTH, withoutEnlargement: true })
      .avif({ quality: 50 })
      .toBuffer({ resolveWithObject: true });
    return { ritualId, fileName, thumb, display };
  } catch (cause) {
    throw new Error(
      `${label}: could not be read as an image. An iPhone HEIC is the likeliest cause — this libvips build has no HEVC support. Set the camera to Settings > Camera > Formats > Most Compatible and re-upload, or convert the file.`,
      { cause },
    );
  }
}

/* Writes one encoded photograph's two deliveries and returns its manifest row. The web path is
   URL-encoded because a filename renamed by hand can carry a `#` or `?`, which a browser would
   otherwise read as a fragment or query and 404 on; the disk path is not. */
async function writeRitualDeliveries(encoded, outRoot) {
  const { ritualId, fileName, thumb, display } = encoded;
  const label = `${RITUAL_SOURCE_ROOT}/${ritualId}/${fileName}`;
  const base = outputBaseName(fileName);
  const webPath = (width) =>
    `/rituals/${encodeURIComponent(ritualId)}/${encodeURIComponent(`${base}-${width}.avif`)}`;
  const diskPath = (width) => join(outRoot, ritualId, `${base}-${width}.avif`);
  try {
    await mkdir(join(outRoot, ritualId), { recursive: true });
    await writeFile(diskPath(RITUAL_THUMB_WIDTH), thumb.data);
    await writeFile(diskPath(RITUAL_DISPLAY_WIDTH), display.data);
  } catch (cause) {
    throw new Error(
      `${label}: its deliveries could not be written. The photograph is fine — this is a disk or permissions failure on the machine running the build.`,
      { cause },
    );
  }
  return {
    thumb: webPath(RITUAL_THUMB_WIDTH),
    display: webPath(RITUAL_DISPLAY_WIDTH),
    width: display.info.width,
    height: display.info.height,
  };
}

/* One photograph, encoded then written — the unit the tests drive. `outRoot` is injectable so they
   assert on the ROW the manifest records, written to a temp directory. */
export async function emitRitualPhoto(
  sourcePath,
  ritualId,
  fileName,
  outRoot = join(ROOT, RITUAL_OUT_ROOT),
) {
  return writeRitualDeliveries(
    await encodeRitualPhoto(sourcePath, ritualId, fileName),
    outRoot,
  );
}

/* READS ONLY. Every refusal a folder listing can find happens here — a nested folder, a missing or
   unknown extension, a base-name collision — before anything is encoded or wiped. What a listing
   cannot find (a file that will not decode) is caught by encoding everything before the wipe, in
   `writeRitualPhotos`. Together: a bad upload leaves the previous deliveries and manifest as they
   were, and `next dev` keeps the last good state. */
export async function planRitualPhotos(
  sourceRoot = join(ROOT, RITUAL_SOURCE_ROOT),
) {
  if (!existsSync(sourceRoot)) return {};
  const ids = (await readdir(sourceRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => entry.name)
    .sort();
  const plan = {};
  for (const id of ids) {
    /* Plain lexicographic, which is the whole ordering mechanism. Phone filenames (`IMG_4821.JPG`)
       sort as capture order; `0` sorts before `I` in ASCII, so renaming one file to `01-...`
       promotes it to the lead frame with nothing else touched. That matters because the strip
       shows only 2-3 of 6-12. */
    const entries = (
      await readdir(join(sourceRoot, id), { withFileTypes: true })
    )
      .filter((entry) => !entry.name.startsWith("."))
      .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    const bases = new Set();
    plan[id] = [];
    for (const entry of entries) {
      const label = `${RITUAL_SOURCE_ROOT}/${id}/${entry.name}`;
      if (entry.isDirectory()) {
        throw new Error(
          `${label}: is a folder. A ritual's photographs sit directly in its folder — move them up a level.`,
        );
      }
      const dot = entry.name.lastIndexOf(".");
      if (dot <= 0) {
        throw new Error(
          `${label}: has no extension. Expected one of ${[...RITUAL_EXTENSIONS].join(", ")}.`,
        );
      }
      const extension = entry.name.slice(dot).toLowerCase();
      if (!RITUAL_EXTENSIONS.has(extension)) {
        throw new Error(
          `${label}: unrecognised extension "${extension}". Expected one of ${[...RITUAL_EXTENSIONS].join(", ")}. Nothing is skipped here — a photograph the couple sent and nobody sees is the failure this refuses.`,
        );
      }
      /* Two files whose names differ only by extension would emit the same two AVIFs and one
         would silently overwrite the other, costing a photograph with every check green. */
      const base = outputBaseName(entry.name);
      if (bases.has(base)) {
        throw new Error(
          `${label}: two photographs share the base name "${base}", so they would write the same delivery and one would be lost. Rename one.`,
        );
      }
      bases.add(base);
      plan[id].push(entry.name);
    }
  }
  return plan;
}

/* Wipes the output directory WHOLESALE — even when the source directory is gone, so deliveries can
   never outlive their sources — and only AFTER the plan has passed. Safe only because the entire
   directory is generated; never safe for `public/` root, which holds the hand-maintained
   `robots.txt` the unlisted-site decision rests on. The roots are injectable so the behaviour is
   tested against a temp tree. */
export async function writeRitualPhotos({
  dryRun,
  sourceRoot = join(ROOT, RITUAL_SOURCE_ROOT),
  outRoot = join(ROOT, RITUAL_OUT_ROOT),
  manifestPath = join(ROOT, RITUAL_MANIFEST),
}) {
  const plan = await planRitualPhotos(sourceRoot);
  if (dryRun) {
    for (const [id, names] of Object.entries(plan)) {
      console.log(
        `would write  ${RITUAL_OUT_ROOT}/${id}/  ${names.length} photograph(s)`,
      );
    }
    console.log("dry run: no ritual delivery written and no manifest emitted");
    return;
  }
  /* EVERY photograph is encoded into memory before the wipe, because the plan cannot see the likeliest
     failure: an iPhone HEIC carries an accepted extension and fails only when decoded. So a bad
     upload of any kind leaves the previous deliveries and manifest as they were. Memory is two small
     AVIFs per photograph — about a few MB for a whole gallery. */
  const encoded = {};
  for (const [id, names] of Object.entries(plan)) {
    encoded[id] = [];
    for (const name of names) {
      encoded[id].push(
        await encodeRitualPhoto(join(sourceRoot, id, name), id, name),
      );
    }
  }
  await rm(outRoot, { recursive: true, force: true });
  const photosByRitual = {};
  for (const [id, photos] of Object.entries(encoded)) {
    /* A folder holding no photographs gets an EMPTY list rather than no key: the section's trigger
       is the list's length, so an empty list is the honest answer and renders nothing. */
    photosByRitual[id] = [];
    for (const photo of photos) {
      photosByRitual[id].push(await writeRitualDeliveries(photo, outRoot));
    }
    console.log(
      `wrote   ${RITUAL_OUT_ROOT}/${id}/  ${photos.length * 2} file(s)`,
    );
  }
  await mkdir(dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, ritualManifestSource(photosByRitual));
  console.log(
    `wrote   ${RITUAL_MANIFEST}  ${Object.keys(photosByRitual).length} ritual(s)`,
  );
}

/* `--only=<family>` runs one family. `prebuild` uses `--only=rituals`, so a deploy regenerates the
   photographs and nothing else — the alternative, running the whole script, would re-encode 152
   botanical files on every build. A filtered run SKIPS the global prune: it has not written the
   other families, and the rituals family wipes its own directory instead. */
const ONLY_FAMILIES = new Set(["rituals"]);

/* A typo here must FAIL rather than fall through: `--only rituals` (a space) or `--dryrun` used to
   run every recipe — 152 botanical files re-encoded, or a "dry" run that wrote. */
export function parseGeneratorArgs(argv) {
  let dryRun = false;
  let only = null;
  for (const argument of argv) {
    if (argument === "--dry-run") dryRun = true;
    else if (argument.startsWith("--only="))
      only = argument.slice("--only=".length);
    else if (argument === "--only") {
      throw new Error(
        `--only takes its family after "=": --only=${[...ONLY_FAMILIES][0]}`,
      );
    } else {
      throw new Error(
        `unrecognised argument "${argument}". Known: --dry-run, --only=<family>.`,
      );
    }
  }
  if (only !== null && !ONLY_FAMILIES.has(only)) {
    throw new Error(
      `--only=${only} selects nothing. Known families: ${[...ONLY_FAMILIES].join(", ")}. Omit --only to run every recipe.`,
    );
  }
  return { dryRun, only };
}

async function run({ dryRun, only }) {
  await writeRitualPhotos({ dryRun });
  if (only !== null) return;
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
  /* `npm run images -- <flags>` passes exactly the flags after `--`, so `argv.slice(2)` is all of
     them. */
  await run(parseGeneratorArgs(process.argv.slice(2)));
}
