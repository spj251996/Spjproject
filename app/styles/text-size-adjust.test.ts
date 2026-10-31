import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { freshExport } from "../../scripts/lib/built-export.ts";

/* TEXT-ONLY SCALING IS SWITCHED OFF; ZOOM IS THE ONE WAY TO ENLARGE THE PAGE (owner, 2026-10-31) —
   DESIGN.md → Accessibility Rules. A phone browser's own text-only scaling (Firefox Android's system
   font size, Samsung Internet's and Chrome's sliders) grows type inside the fixed compositions.

   Comments are stripped once, up front, as in `selection.test.ts`: the rule's own comment quotes the
   values these assertions search for. */
const globals = readFileSync("app/globals.css", "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  "",
);
const CSS_DIR = "out/_next/static/chunks";
const PUBLISHED = "out/index.html";

const SPELLINGS = [
  /(^|[^-])text-size-adjust:\s*100%/,
  /-webkit-text-size-adjust:\s*100%/,
  /-moz-text-size-adjust:\s*100%/,
];

function htmlRule() {
  const from = globals.indexOf("html {");
  assert.notStrictEqual(from, -1, "no `html {` rule found");
  const open = globals.indexOf("{", from);
  return globals.slice(open + 1, globals.indexOf("}", open));
}

function publishedCss(): string {
  const html = readFileSync(PUBLISHED, "utf8");
  const sheets = [
    ...new Set(
      [...html.matchAll(/\/_next\/static\/chunks\/([A-Za-z0-9_-]+\.css)/g)].map(
        (match) => match[1],
      ),
    ),
  ];
  assert.ok(sheets.length > 0, `no stylesheet links in ${PUBLISHED}`);
  return sheets
    .map((name) => readFileSync(join(CSS_DIR, name), "utf8"))
    .join("\n");
}

/* Each browser reads only its own spelling: WebKit the prefixed one, Firefox Android `-moz-`. */
test("phones never enlarge the page's text on their own", () => {
  const html = htmlRule();
  for (const spelling of SPELLINGS) assert.match(html, spelling);
});

/* `none` has blocked zoom in Safari, which would remove the one enlargement left. */
test("no rule sets text-size-adjust to none or auto", () => {
  assert.doesNotMatch(globals, /text-size-adjust:\s*(none|auto)/);
});

/* The minifier may drop a prefix it considers unneeded, so the shipped stylesheet is asserted. */
test("the built stylesheet keeps all three spellings", (t) => {
  if (!freshExport(t)) return;
  const css = publishedCss();
  for (const spelling of SPELLINGS) assert.match(css, spelling);
});
