import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import sharp from "sharp";
import {
  emitRitualPhoto,
  expectedOutputs,
  orphansIn,
  outputBaseName,
  PRUNED_DIRS,
  planRitualPhotos,
  ritualManifestSource,
  uprightRitualImage,
  writeRitualPhotos,
} from "./generate-images.mjs";

/* `public/` is copied wholesale into `out/` by `output: "export"`, so a file the generator no longer
   writes still ships to every guest. The generator only ever wrote and copied, never deleted, so a
   renamed or removed source left its old delivery behind — which is what these guard. */

test("every directory the generator prunes is one it fully owns", async () => {
  const expected = await expectedOutputs();
  for (const dir of PRUNED_DIRS) {
    assert.ok(
      [...expected].some((path) => path.startsWith(`${dir}/`)),
      `${dir} is pruned but the generator writes nothing into it`,
    );
  }
});

/* THE GUARD THAT MATTERS. A recipe does write to `public/` root -- the OG card is a pass-through
   with `outDir: "public"` -- so the obvious "prune every outDir" would delete `robots.txt`, the
   hand-maintained crawler policy that the whole unlisted-site decision rests on. The root is
   excluded by name, and that exclusion is asserted rather than left to a reader to notice. */
test("the generator never prunes public/ root, which holds hand-maintained files", () => {
  assert.ok(
    !PRUNED_DIRS.includes("public"),
    "pruning public/ root would delete robots.txt and the OG card",
  );
  for (const dir of PRUNED_DIRS) {
    assert.match(
      dir,
      /^public\/[^/]+$/,
      `${dir} must be a named subdirectory of public/, never the root`,
    );
  }
});

test("an orphan is a file the generator no longer writes", () => {
  const expected = new Set([
    "public/family/flemy.jpg",
    "public/family/sebastian.jpg",
  ]);
  const orphans = orphansIn(
    "public/family",
    ["flemy.jpg", "sebastian.jpg", "old-name.jpg"],
    expected,
  );
  assert.deepEqual(orphans, ["old-name.jpg"]);
});

test("nothing is an orphan when every file is still written", () => {
  const expected = new Set(["public/couple/couple-1x.avif"]);
  assert.deepEqual(
    orphansIn("public/couple", ["couple-1x.avif"], expected),
    [],
  );
});

/* Dotfiles are skipped for the same reason the pass-through copy skips them: they are not deliveries
   and nothing in `RECIPES` can ever "expect" one, so a blanket comparison would delete them. */
test("a dotfile is never treated as an orphan", () => {
  assert.deepEqual(
    orphansIn("public/family", [".gitkeep", ".DS_Store"], new Set()),
    [],
  );
});

/* The real recipe set, not a fixture: the expected outputs must actually name the three families,
   or the prune would delete live deliveries on its first run. */
test("the expected set covers every delivered image family", async () => {
  const expected = await expectedOutputs();
  for (const prefix of [
    "public/botanical/",
    "public/couple/",
    "public/family/",
  ]) {
    assert.ok(
      [...expected].some((path) => path.startsWith(prefix)),
      `nothing expected under ${prefix}; a prune would empty it`,
    );
  }
  /* The OG card lands in the excluded root, so it must still be expected -- otherwise a future
     widening of PRUNED_DIRS would read it as an orphan. */
  assert.ok(
    [...expected].some((path) => path.startsWith("public/og-card")),
    "the OG card must be in the expected set even though its directory is not pruned",
  );
});

test("a delivery's base name drops the extension and nothing else", () => {
  assert.equal(outputBaseName("IMG_4821.JPG"), "IMG_4821");
  assert.equal(outputBaseName("01-hero.jpeg"), "01-hero");
  assert.equal(outputBaseName("a.b.c.png"), "a.b.c");
});

test("the manifest emits one typed entry per ritual, in the order given", () => {
  const source = ritualManifestSource({
    "wedding-eve": [
      {
        thumb: "/rituals/wedding-eve/og-1-600.avif",
        display: "/rituals/wedding-eve/og-1-1000.avif",
        width: 1000,
        height: 563,
      },
    ],
  });
  assert.match(source, /import type \{ RitualPhoto \} from "\.\/types\.ts";/);
  assert.match(
    source,
    /export const ritualPhotos: Record<string, RitualPhoto\[\]> = \{/,
  );
  assert.match(source, /"wedding-eve": \[/);
  assert.match(source, /display: "\/rituals\/wedding-eve\/og-1-1000\.avif",/);
  assert.match(source, /width: 1000,/);
  assert.match(source, /height: 563,/);
});

test("an empty manifest is still a valid module", () => {
  const source = ritualManifestSource({});
  assert.match(
    source,
    /export const ritualPhotos: Record<string, RitualPhoto\[\]> = \{\};/,
  );
});

test("an unknown --only family throws rather than silently selecting nothing", () => {
  const source = readFileSync(
    new URL("./generate-images.mjs", import.meta.url),
    "utf8",
  );
  /* Asserted on the source rather than by invoking `run`, which is module-local and would generate
     files. The claim is that the guard exists and builds its message from the single known set, not
     that one particular string fails. */
  assert.match(source, /selects nothing\. Known families/);
  assert.match(source, /const ONLY_FAMILIES = new Set\(\["rituals"\]\)/);
});

test("public/rituals is never pruned, because the expected set does not describe it", () => {
  /* The rituals family is deliberately outside RECIPES, so `expectedOutputs()` knows nothing about
     its deliveries. Adding `public/rituals` to PRUNED_DIRS would therefore make the next FULL run
     read every ritual delivery as an orphan and delete all of them — after writing them. The
     directory is wiped wholesale by its own recipe instead. */
  assert.ok(
    !PRUNED_DIRS.includes("public/rituals"),
    "public/rituals must not be pruned: expectedOutputs() does not cover it, so a prune would empty it",
  );
});

test("an EXIF-rotated photograph is emitted and measured upright", async () => {
  /* The one fact that moves the section's height: a phone portrait is STORED landscape and tagged
     orientation 6. Without the rotation it is emitted sideways AND its manifest dimensions come out
     swapped, and `photoFit` solves one row height across every ritual from them. The stand-in
     photographs carry no orientation tag, so nothing else on the branch can see this. */
  const stored = await sharp({
    create: { width: 200, height: 100, channels: 3, background: "#808080" },
  })
    .jpeg()
    .withMetadata({ orientation: 6 })
    .toBuffer();
  const { info } = await uprightRitualImage(stored)
    .resize({ width: 50 })
    .toBuffer({ resolveWithObject: true });
  assert.deepEqual([info.width, info.height], [50, 100]);
});

test("the manifest row a page reads records an EXIF-rotated portrait upright", async () => {
  /* Spec gate 2 asks for the assertion on the MANIFEST's numbers, not on a helper: a resize that
     bypassed `uprightRitualImage` would pass the test above and still record the portrait sideways,
     moving the whole section's height. Written to a temp directory, never into `public/`. */
  const dir = mkdtempSync(join(tmpdir(), "ritual-emit-"));
  const source = join(dir, "portrait.jpg");
  writeFileSync(
    source,
    await sharp({
      create: { width: 200, height: 100, channels: 3, background: "#808080" },
    })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer(),
  );
  const row = await emitRitualPhoto(source, "wedding", "portrait.jpg", dir);
  assert.deepEqual([row.width, row.height], [100, 200]);
});

test("a filename's awkward characters survive into the manifest and the URL", async () => {
  /* A name renamed by hand on a phone can carry a quote, a backslash or a `#`. Interpolated raw, a
     quote breaks the module, a backslash is read as an escape, and a `#` turns the rest of the URL
     into a fragment — the last two a 404'd tile with every gate green. */
  const awkward = '/rituals/wedding/a"b\\c-600.avif';
  const source = ritualManifestSource({
    wedding: [{ thumb: awkward, display: awkward, width: 1, height: 1 }],
  });
  assert.ok(
    source.includes(`thumb: ${JSON.stringify(awkward)},`),
    "string values must be emitted as escaped literals",
  );
  const dir = mkdtempSync(join(tmpdir(), "ritual-emit-"));
  const file = join(dir, "p#1.jpg");
  writeFileSync(
    file,
    await sharp({
      create: { width: 20, height: 10, channels: 3, background: "#808080" },
    })
      .jpeg()
      .toBuffer(),
  );
  const row = await emitRitualPhoto(file, "wedding", "p#1.jpg", dir);
  assert.equal(row.thumb, "/rituals/wedding/p%231-600.avif");
});

/* A throwaway source tree under the OS temp directory: each key a ritual folder, each entry a
   `[name, kind]` — a real JPEG, bytes that are not an image, a sub-folder, or an empty dotfile.
   Nothing here touches `public/`, `assets/` or `content/`. */
async function tree(folders) {
  const root = mkdtempSync(join(tmpdir(), "ritual-run-"));
  const source = join(root, "assets");
  const out = join(root, "public");
  const manifest = join(root, "manifest.ts");
  const jpg = await sharp({
    create: { width: 20, height: 10, channels: 3, background: "#808080" },
  })
    .jpeg()
    .toBuffer();
  for (const [folder, entries] of Object.entries(folders)) {
    mkdirSync(join(source, folder), { recursive: true });
    for (const [name, kind] of entries) {
      const path = join(source, folder, name);
      if (kind === "dir") mkdirSync(path);
      else
        writeFileSync(
          path,
          kind === "jpg" ? jpg : kind === "text" ? "not an image" : "",
        );
    }
  }
  return { root, source, out, manifest };
}

const run = (t) =>
  writeRitualPhotos({
    dryRun: false,
    sourceRoot: t.source,
    outRoot: t.out,
    manifestPath: t.manifest,
  });

test("a folder holding only dotfiles yields an empty list and no error", async () => {
  const t = await tree({
    wedding: [
      [".gitkeep", "empty"],
      [".DS_Store", "empty"],
    ],
  });
  assert.deepEqual(await planRitualPhotos(t.source), { wedding: [] });
});

test("an uppercase or multi-dot photograph name is accepted", async () => {
  const t = await tree({
    wedding: [
      ["IMG_1.JPG", "jpg"],
      ["a.b.jpg", "jpg"],
    ],
  });
  assert.deepEqual(await planRitualPhotos(t.source), {
    wedding: ["IMG_1.JPG", "a.b.jpg"],
  });
});

test("a file with no extension is named as having none", async () => {
  const t = await tree({ wedding: [["IMG_1", "jpg"]] });
  await assert.rejects(
    planRitualPhotos(t.source),
    /wedding\/IMG_1: has no extension/,
  );
});

test("a folder inside a ritual folder is named as a folder", async () => {
  const t = await tree({ wedding: [["more", "dir"]] });
  await assert.rejects(
    planRitualPhotos(t.source),
    /wedding\/more: is a folder/,
  );
});

test("an unrecognised extension is refused, naming it", async () => {
  const t = await tree({ wedding: [["clip.gif", "jpg"]] });
  await assert.rejects(
    planRitualPhotos(t.source),
    /wedding\/clip\.gif: unrecognised extension "\.gif"/,
  );
});

test("two photographs sharing a base name are refused, not silently overwritten", async () => {
  const t = await tree({
    wedding: [
      ["a.jpg", "jpg"],
      ["a.JPG", "jpg"],
    ],
  });
  await assert.rejects(
    planRitualPhotos(t.source),
    /two photographs share the base name "a"/,
  );
});

test("an unreadable photograph fails naming the file and the HEIC case", async () => {
  const t = await tree({ wedding: [["zbad.jpg", "text"]] });
  await assert.rejects(
    run(t),
    /wedding\/zbad\.jpg: could not be read as an image.*Most Compatible/s,
  );
});

test("a write failure is reported as one, not blamed on the photograph", async () => {
  const t = await tree({ wedding: [["a.jpg", "jpg"]] });
  const blocker = join(t.root, "blocker");
  writeFileSync(blocker, "a file, so nothing can be made beneath it");
  await assert.rejects(
    emitRitualPhoto(
      join(t.source, "wedding", "a.jpg"),
      "wedding",
      "a.jpg",
      join(blocker, "out"),
    ),
    (error) => {
      assert.match(
        error.message,
        /wedding\/a\.jpg: its deliveries could not be written/,
      );
      assert.doesNotMatch(error.message, /HEIC/);
      return true;
    },
  );
});

test("the generator validates every folder before it wipes anything", async () => {
  const t = await tree({
    betrothal: [["ok.jpg", "jpg"]],
    wedding: [["IMG_1", "jpg"]],
  });
  mkdirSync(join(t.out, "betrothal"), { recursive: true });
  writeFileSync(join(t.out, "betrothal", "previous-600.avif"), "previous");
  writeFileSync(t.manifest, "// previous manifest");
  await assert.rejects(run(t), /has no extension/);
  assert.equal(
    readFileSync(join(t.out, "betrothal", "previous-600.avif"), "utf8"),
    "previous",
  );
  assert.equal(readFileSync(t.manifest, "utf8"), "// previous manifest");
});

test("with no source folder at all, every previous delivery is wiped", async () => {
  const t = await tree({});
  mkdirSync(join(t.out, "betrothal"), { recursive: true });
  writeFileSync(join(t.out, "betrothal", "stale-600.avif"), "stale");
  await run(t);
  assert.ok(!existsSync(t.out), "public/rituals must not survive its sources");
  assert.match(readFileSync(t.manifest, "utf8"), /= \{\};/);
});
