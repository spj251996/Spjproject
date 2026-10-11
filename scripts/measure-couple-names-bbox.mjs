/* Exact per-path and per-group bboxes in viewBox units, read from the real file in a real engine.
   getBBox() on a <path> returns its own user space, so each is multiplied through the group's
   `translate(0,446) scale(0.1,-0.1)` by taking the bbox of the path AS LAID OUT — which is what
   getBoundingClientRect on a known-size viewport gives, scaled back. Simpler: read getBBox of a
   <g> wrapper per group, inside the same transform, which is already in viewBox units. */

import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const src = readFileSync("tmp/aaa/source/Names-svg.svg", "utf8");
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
    const out = {};
    for (const g of document.querySelectorAll("g[id^='g-']")) {
      const b = g.getBBox();
      const ctm = g.getCTM();
      /* getBBox is in the group's own (pre-transform) space; map its corners through the CTM to
         land in the root viewBox's units, which is what a <use> will be placed in. */
      const pt = (x, y) => {
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
