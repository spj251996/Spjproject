import assert from "node:assert/strict";
import test from "node:test";
import { expectedOutputs, orphansIn, PRUNED_DIRS } from "./generate-images.mjs";

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
