import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  expectedOutputs,
  orphansIn,
  outputBaseName,
  PRUNED_DIRS,
  ritualManifestSource,
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

test("two photographs sharing a base name are refused, not silently overwritten", () => {
  const source = readFileSync(
    new URL("./generate-images.mjs", import.meta.url),
    "utf8",
  );
  assert.match(source, /two photographs share the base name/);
  assert.match(source, /bases\.has\(base\)/);
});

test("an unreadable photograph fails the build naming the file and the HEIC case", () => {
  const source = readFileSync(
    new URL("./generate-images.mjs", import.meta.url),
    "utf8",
  );
  assert.match(source, /could not be read as an image/);
  assert.match(source, /Most Compatible/);
  assert.match(source, /unrecognised extension/);
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
