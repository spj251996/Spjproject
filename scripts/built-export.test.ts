import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { freshExport } from "./built-export.ts";

/* A source tree and an export page, each file stamped with its own time (seconds since the epoch). */
function tree(files: Record<string, number>): string {
  const root = mkdtempSync(join(tmpdir(), "built-export-"));
  for (const [rel, time] of Object.entries(files)) {
    const path = join(root, rel);
    mkdirSync(join(path, ".."), { recursive: true });
    writeFileSync(path, "");
    utimesSync(path, time, time);
  }
  return root;
}

function fakeContext() {
  const skips: string[] = [];
  return { skips, skip: (message?: string) => void skips.push(message ?? "") };
}

test("with no page, it skips and returns false", () => {
  const root = tree({ "app/page.tsx": 1000 });
  const t = fakeContext();
  assert.equal(
    freshExport(t, join(root, "out/index.html"), [join(root, "app")], []),
    false,
  );
  assert.equal(t.skips.length, 1);
  assert.match(t.skips[0], /npm run build/);
});

test("with a page newer than every source file, it returns true", () => {
  const root = tree({
    "app/page.tsx": 1000,
    "components/a.tsx": 1500,
    "out/index.html": 2000,
  });
  const t = fakeContext();
  const roots = [join(root, "app"), join(root, "components")];
  assert.equal(freshExport(t, join(root, "out/index.html"), roots, []), true);
  assert.equal(t.skips.length, 0);
});

test("with a source file newer than the page, it throws naming the file and the rebuild", () => {
  const root = tree({
    "app/page.tsx": 1000,
    "components/late.tsx": 3000,
    "out/index.html": 2000,
  });
  const roots = [join(root, "app"), join(root, "components")];
  assert.throws(
    () => freshExport(fakeContext(), join(root, "out/index.html"), roots, []),
    (error: Error) =>
      error.message.includes("late.tsx") &&
      error.message.includes("npm run build"),
  );
});

test("a test file newer than the page is ignored", () => {
  const root = tree({
    "app/page.tsx": 1000,
    "app/page.test.ts": 3000,
    "out/index.html": 2000,
  });
  assert.equal(
    freshExport(
      fakeContext(),
      join(root, "out/index.html"),
      [join(root, "app")],
      [],
    ),
    true,
  );
});

test("a file under an excluded root is ignored", () => {
  const root = tree({
    "app/page.tsx": 1000,
    "app/design-system/page.dev.tsx": 3000,
    "out/index.html": 2000,
  });
  const excluded = [join(root, "app/design-system")];
  assert.equal(
    freshExport(
      fakeContext(),
      join(root, "out/index.html"),
      [join(root, "app")],
      excluded,
    ),
    true,
  );
});
