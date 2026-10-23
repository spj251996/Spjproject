import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { freshExport } from "../../scripts/built-export.ts";
import { linkedStylesheets } from "../../scripts/linked-stylesheets.mjs";

/* The focus ring is thread-vermilion on every surface (DESIGN.md → Interaction Rules → Focus), so no
   subtree rebinds it; on the clipped photo frames, whose photo paints over the button's own outline,
   the ring is drawn on the save cover as an inset band in the same colour. */

const tokens = readFileSync("app/styles/tokens.css", "utf8");
/* Joined at run time: Tailwind scans this file too, and a whole class string here would generate the
   utility and keep the built-CSS check below green with the covers stripped. */
const INSET_RING = [
  "group-focus-visible",
  "shadow-[inset_0_0_0_var(--focus-ring-width)_var(--focus-ring-color)]",
].join(":");
const CLIPPED_FRAMES = [
  "components/ui/photo-row.tsx",
  "components/ui/gallery-modal-panel.tsx",
];

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sources(path);
    return /\.(tsx?|css)$/.test(entry.name) && !/\.test\./.test(entry.name)
      ? [path]
      : [];
  });
}

test("the ring takes thread-vermilion, and no inverse ring colour exists", () => {
  assert.match(tokens, /--focus-ring-color: var\(--color-thread-vermilion\);/);
  assert.doesNotMatch(tokens, /--focus-ring-color-inverse/);
});

test("no surface rebinds the ring colour", () => {
  const files = [...sources("app"), ...sources("components")];
  assert.ok(files.length > 50, `read only ${files.length} source files`);
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    assert.doesNotMatch(
      source,
      /\[--focus-ring-color:|--focus-ring-color-inverse/,
      `${file} rebinds the focus ring`,
    );
  }
});

test("each clipped frame draws the ring on its save cover, inside a group button", () => {
  for (const file of CLIPPED_FRAMES) {
    const source = readFileSync(file, "utf8");
    const cover = source.indexOf(INSET_RING);
    assert.notEqual(cover, -1, `${file}: no inset ring on the save cover`);
    const button = source.lastIndexOf("<button", cover);
    assert.notEqual(button, -1, `${file}: the cover is not inside a button`);
    assert.match(
      source.slice(button, cover),
      /className=\{?["`]group[\s"`]/,
      `${file}: the cover's button is not a \`group\``,
    );
    assert.equal(
      source.slice(button, cover).includes("</button>"),
      false,
      `${file}: the cover sits outside its button`,
    );
  }
});

test("the built CSS ships the ring rule and the inset band", (t) => {
  if (!freshExport(t)) return;
  const css = linkedStylesheets(readFileSync("out/index.html", "utf8"), "out")
    .map((sheet) => sheet.css ?? "")
    .join("\n");
  assert.match(
    css,
    /:focus-visible\{outline:var\(--focus-ring-width\) solid var\(--focus-ring-color\)/,
  );
  assert.match(
    css,
    /:where\(\.group\):focus-visible \*\)\{--tw-shadow:inset 0 0 0 var\(--focus-ring-width\) var\(--focus-ring-color\);box-shadow:/,
    "the inset ring utility compiled to nothing",
  );
});
