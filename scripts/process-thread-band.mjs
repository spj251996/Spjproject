/* Extract one band's drawing, assign the strokes to the connector chain, and measure every join.
 * usage: node scripts/process-thread-band.mjs <band> <drawing.png>
 */

import { readFileSync, writeFileSync } from "node:fs";
import { extract } from "./extract-thread-drawing.mjs";

const DIRS = {
  wide: "assets/thread/wide",
  tall: "assets/thread/tall",
  upright: "assets/thread/upright",
};
const band = process.argv[2];
const file = process.argv[3];
const dir = DIRS[band];
if (!dir || !file)
  throw new Error("usage: process-band.mjs <wide|tall|upright> <drawing.png>");

const geometry = JSON.parse(readFileSync(`${dir}/geometry.json`, "utf8"));
const points = JSON.parse(readFileSync(`${dir}/attachments.json`, "utf8"));
/* The first `wide` sheet drew its crosses inset 20 with 40-unit arms, so each one is clipped by the
   canvas edge; every later sheet insets them 64, clear of it. The inset is a property of the SHEET,
   so it travels with the band rather than being assumed. */
const CROSS_INSET = { wide: 20, tall: 64, upright: 64 };
const page = {
  width: geometry.width,
  height: Math.round(
    geometry.sections.at(-1).top + geometry.sections.at(-1).height,
  ),
  crossInset: CROSS_INSET[band],
};

const deg = (r) => (r * 180) / Math.PI;
const wrap = (a) => ((((a + 180) % 360) + 360) % 360) - 180;
const gap = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

const { map, strokes } = await extract(file, { page });

const links = [{ from: null, to: points[0] }];
for (let i = 1; i < points.length; i += 2)
  links.push({ from: points[i], to: points[i + 1] ?? null });

/* Direction over a short RUN, not the last segment: one simplified segment can be a few pixels long
   and its angle is then skeleton noise rather than the line's heading. */
function headingAt(stroke, which) {
  const REACH = Math.max(20, Math.round(page.width / 34));
  const anchor = which === "from" ? stroke[0] : stroke.at(-1);
  const order = which === "from" ? stroke : [...stroke].reverse();
  const away = order.find((p) => gap(p, anchor) >= REACH) ?? order.at(-1);
  return which === "from"
    ? deg(Math.atan2(away.y - anchor.y, away.x - anchor.x))
    : deg(Math.atan2(anchor.y - away.y, anchor.x - away.x));
}

const free = new Set(strokes.keys());
const assigned = [];
for (const link of links) {
  let best = null;
  for (const i of free) {
    for (const flip of [false, true]) {
      const s = flip ? [...strokes[i]].reverse() : strokes[i];
      const cost =
        (link.from ? gap(s[0], link.from) : 0) +
        (link.to ? gap(s.at(-1), link.to) : 0);
      if (best === null || cost < best.cost)
        best = { i, flip, cost, stroke: s };
    }
  }
  if (best === null) {
    assigned.push({ ...link, stroke: null });
    continue;
  }
  free.delete(best.i);
  assigned.push({ ...link, ...best });
}

let worstAngle = 0;
const joins = [];
console.log(
  `\n=== ${band} ===  ${page.width} x ${page.height}  identity:${map.identity ?? false}  strokes ${strokes.length} / links ${links.length}`,
);
assigned.forEach((a, k) => {
  if (!a.stroke) {
    console.log(`  connector ${k}: NO STROKE`);
    return;
  }
  const parts = [];
  for (const which of ["from", "to"]) {
    const t = a[which];
    const at = which === "from" ? a.stroke[0] : a.stroke.at(-1);
    if (!t) {
      parts.push(`${which} FREE`);
      continue;
    }
    const drew = headingAt(a.stroke, which);
    const off = Math.abs(wrap(drew - t.heading));
    worstAngle = Math.max(worstAngle, off);
    joins.push({ connector: k, which, ...t, drew, off, dist: gap(at, t) });
    parts.push(
      `${which} ${t.section}/${t.motif}/${t.which} ${gap(at, t).toFixed(0)}px ${off.toFixed(1)}deg`,
    );
  }
  console.log(
    `  connector ${k} (stroke ${a.i}${a.flip ? " rev" : ""}, ${a.stroke.length} pts)  ${parts.join("   ")}`,
  );
});
console.log(
  `  worst angle ${worstAngle.toFixed(1)}deg   unassigned ${free.size}`,
);

writeFileSync(
  `${dir}/connectors.json`,
  `${JSON.stringify(
    assigned.map((a, k) => ({ connector: k, points: a.stroke })),
    null,
    2,
  )}\n`,
);
writeFileSync(`${dir}/joins.json`, `${JSON.stringify(joins, null, 2)}\n`);
