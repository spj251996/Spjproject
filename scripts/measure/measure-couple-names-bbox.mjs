/* Exact per-group bboxes in viewBox units, read from the real file in a real engine: each group's
   `getBBox()` (its own pre-transform space) mapped through its CTM into the root viewBox's units,
   which is what a `<use>` is placed in. */

import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const src = readFileSync("assets/names/Names-svg.svg", "utf8");
const paths = [...src.matchAll(/<path d="([^"]*)"/g)].map((m) => m[1]);
if (paths.length !== 5)
  throw new Error(`expected 5 paths, found ${paths.length}`);

const GROUPS = { sebastian: [0, 1], ampersand: [2], flemy: [3, 4] };

const browser = await chromium.launch({ channel: "chromium" });
const page = await browser.newPage();
await page.setContent(`<!doctype html><svg id="s" viewBox="0 0 600 446" width="600" height="446">
<g transform="translate(0.000000,446.000000) scale(0.100000,-0.100000)" fill="#000">
${Object.entries(GROUPS)
  .map(
    ([k, ix]) =>
      `<g id="g-${k}">${ix.map((i) => `<path d="${paths[i]}"/>`).join("")}</g>`,
  )
  .join("\n")}
</g></svg>`);
console.log(
  await page.evaluate(() => {
    /** @type {Record<string, { x: number, y: number, w: number, h: number }>} */
    const out = {};
    for (const g of /** @type {NodeListOf<SVGGraphicsElement>} */ (
      document.querySelectorAll("g[id^='g-']")
    )) {
      const b = g.getBBox();
      const ctm = /** @type {DOMMatrix} */ (g.getCTM());
      /* getBBox is in the group's own (pre-transform) space; map its corners through the CTM to
         land in the root viewBox's units, which is what a <use> will be placed in. */
      const pt = (/** @type {number} */ x, /** @type {number} */ y) => {
        const p = new DOMPoint(x, y).matrixTransform(ctm);
        return [p.x, p.y];
      };
      const corners = [pt(b.x, b.y), pt(b.x + b.width, b.y + b.height)];
      const xs = corners.map((c) => c[0]),
        ys = corners.map((c) => c[1]);
      out[g.id.slice(2)] = {
        x: +Math.min(...xs).toFixed(2),
        y: +Math.min(...ys).toFixed(2),
        w: +(Math.max(...xs) - Math.min(...xs)).toFixed(2),
        h: +(Math.max(...ys) - Math.min(...ys)).toFixed(2),
      };
    }
    return out;
  }),
);
await browser.close();
