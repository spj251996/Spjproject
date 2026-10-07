import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

/* A `viewBox="0 0 1 1"` stretched over a real box re-scales the stroke with it, so a `px` stroke
   width is read as that many USER-SPACE units -- about 1500x too wide at this page's size, which
   paints a solid rectangle rather than a line. ONE `<svg>` in this directory lives in that
   coordinate system: `page-thread.tsx`'s no-JS fallback, fixed on its first real render.

   It had a second member until 2026-10-07 -- `not-found-thread.tsx`'s whole thread, which shipped
   WITHOUT the attribute and painted the 404 screen 99.7% red for a month. That screen's thread was
   retired rather than repaired (DESIGN.md -> Not found), so this gate is down to one member. Keep
   it: the surviving member is the one a reader with no JS sees, and it is still the arrangement
   that failed.

   The rule is asserted GENERALLY rather than on those two files, so a path written into this
   coordinate system later is covered the day it is written rather than the day someone renders it.

   THE SCAN IS PER-`<svg>`, NOT PER-FILE, and that is the whole difficulty: `page-thread.tsx` also
   renders four paths in REAL PIXEL space, which correctly omit the attribute (that file's own
   header comment says why), so a file-level scan fails on correct code. Comments are stripped
   first because this directory's prose quotes `<path>` in several places, and a quoted tag is not
   an element. The count assertion at the end is what stops the gate passing vacuously if the
   markup is reformatted or a slice stops matching -- a regex that matches nothing reads exactly
   like a regex whose every match passed (`lessons.md`, 2026-10-05). */

const EXPECTED_STRETCHED_PATHS = 1;

function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "");
}

/* The source of each `<svg>` element, opening tag through its own `</svg>`. No `<svg>` in this
   directory nests another, so the first closing tag after an opening one is that element's. */
function svgElements(source: string): string[] {
  const elements: string[] = [];
  for (const open of source.matchAll(/<svg\b[^>]*>/g)) {
    const start = open.index;
    const end = source.indexOf("</svg>", start);
    elements.push(end === -1 ? source.slice(start) : source.slice(start, end));
  }
  return elements;
}

test("every path in a stretched 1x1 viewBox carries a non-scaling stroke", () => {
  let checked = 0;

  const files = readdirSync(import.meta.dirname)
    .filter((name) => name.endsWith(".tsx"))
    .map((name) => path.join(import.meta.dirname, name));

  for (const file of files) {
    const name = path.basename(file);
    const source = withoutComments(readFileSync(file, "utf8"));

    for (const svg of svgElements(source)) {
      if (!/viewBox="0 0 1 1"/.test(svg)) continue;

      const paths = [...svg.matchAll(/<path\b[^>]*>/g)].map((m) => m[0]);
      assert.ok(
        paths.length > 0,
        `${name}: an <svg> declares a 1x1 viewBox but holds no <path> — the element scan is broken, not the markup`,
      );

      for (const element of paths) {
        assert.match(
          element,
          /vectorEffect="non-scaling-stroke"/,
          `${name}: a <path> inside a stretched 1x1 viewBox has no vectorEffect="non-scaling-stroke" — its stroke width is read as user-space units and paints a solid rectangle`,
        );
        checked += 1;
      }
    }
  }

  assert.equal(
    checked,
    EXPECTED_STRETCHED_PATHS,
    `expected ${EXPECTED_STRETCHED_PATHS} paths in a stretched 1x1 viewBox, found ${checked} — either one was added without updating this count, or the scan stopped matching`,
  );
});
