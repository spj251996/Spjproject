import assert from "node:assert/strict";
import { test } from "node:test";
import { FRAME_SHEETS } from "../../app/frame-sheets.ts";
import {
  mountedSheetFrameCss,
  tallFrameCss,
} from "./mounted-sheet-frame-css.ts";

const SUPPORTS = "@supports (justify-content: safe center) {";

function generated(sheet: (typeof FRAME_SHEETS)[number]): string {
  return sheet.layout === "tall"
    ? tallFrameCss()
    : mountedSheetFrameCss(
        sheet.fit as NonNullable<typeof sheet.fit>,
        sheet.hero,
        sheet.layout,
      );
}

/* Split into the text outside every `@supports` block and the blocks themselves. */
function split(css: string): { outside: string; blocks: string[] } {
  const blocks: string[] = [];
  let outside = "";
  let cursor = 0;
  for (
    let start = css.indexOf(SUPPORTS);
    start !== -1;
    start = css.indexOf(SUPPORTS, cursor)
  ) {
    outside += css.slice(cursor, start);
    let depth = 0;
    let end = start;
    for (; end < css.length; end++) {
      if (css[end] === "{") depth++;
      if (css[end] === "}" && --depth === 0) break;
    }
    blocks.push(css.slice(start, end + 1));
    cursor = end + 1;
  }
  return { outside: outside + css.slice(cursor), blocks };
}

/* The CSS minifier merges `center; safe center` in one rule into `safe center` alone, which leaves an
   engine without `safe` in flex alignment with no centring. The fallback has to be a plain rule with
   the `safe` form in a separate block. */
test("every frame sheet keeps plain center and confines safe center to @supports", () => {
  for (const sheet of FRAME_SHEETS) {
    const { outside, blocks } = split(generated(sheet));
    assert.ok(blocks.length > 0, `${sheet.name}: no @supports block`);
    assert.doesNotMatch(
      outside,
      /safe center/,
      `${sheet.name}: safe center outside @supports`,
    );
    let selectorsChecked = 0;
    for (const block of blocks) {
      for (const rule of block.matchAll(
        /([^{}]+)\{([^{}]*safe center[^{}]*)\}/g,
      )) {
        for (const selector of rule[1].split(",").map((s) => s.trim())) {
          selectorsChecked++;
          const base = [...outside.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find(
            (m) =>
              m[1].split(",").some((s) => s.trim() === selector) &&
              /justify-content: center;/.test(m[2]) &&
              /align-items: center;/.test(m[2]),
          );
          assert.ok(
            base,
            `${sheet.name}: ${selector} has no plain center rule`,
          );
        }
      }
    }
    assert.ok(selectorsChecked > 0, `${sheet.name}: no selector inspected`);
  }
});
