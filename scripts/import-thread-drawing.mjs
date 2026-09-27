#!/usr/bin/env node
/* Imports a hand-drawn thread overlay into authored connector paths.
 *
 * The owner draws magenta over a generated sheet — the real page, the motifs and their tangent
 * ticks — in whatever app they like, and sends the image back. Nothing about that round trip can
 * be trusted: the app may rescale, crop, or re-encode as JPEG. So the transform back into page
 * pixels is MEASURED from four registration crosses printed on the sheet, rather than assumed from
 * the returned file's own dimensions.
 *
 * Thinning, spur pruning and the ordered walk are this repo's own tracer (`trace-motif.mjs`) — the
 * same code that traced the motifs — so this file adds a colour mask and a coordinate transform,
 * not a second geometry implementation.
 *
 * usage: node scripts/import-thread-drawing.mjs <wide|tall|upright> <drawing.png> --dir=<sheet dir>
 *
 * <sheet dir> already holds `geometry.json` (the page's width and section bands) and
 * `attachments.json` (every motif's entry/exit tick, in page pixels, in the order the thread
 * runs). The tool writes `connectors.json` and `joins.json` back into it.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright-core";
import sharp from "sharp";
import { pruneSpurs, thin, walk } from "./trace-motif.mjs";

/* The inset the registration crosses were drawn at is a property of the SHEET, not a constant —
 * the first sheet (`wide`) inset them only 20px with 40-unit arms, so a cross sat half-clipped by
 * the canvas edge; every later sheet (`tall`, `upright`) inset them 64px, clear of it. A clipped
 * cross biases its own centroid inward, which reads as a scale error rather than as damage — the
 * first sheet measured a phantom 0.7%. */
const CROSS_INSET = { wide: 20, tall: 64, upright: 64 };
const VIEWPORT = {
  wide: { width: 1536, height: 695 },
  tall: { width: 393, height: 700 },
  upright: { width: 820, height: 1180 },
};
const SECTION_ORDER = [
  "invite",
  "event-info",
  "contact",
  "family",
  "celebrations",
  "wishes",
];
const TYPE_SAMPLE_STEP = 2; // px between samples along the drawn line, for the type-clearance walk

/* A small window centred on each cross's KNOWN position, not a blind corner search. The sheet is
 * one we generated, so every cross's position is known in advance; that turns detection into
 * verification. Blind corner search kept losing to page content — a 19px botanical speck sitting
 * closer to the page edge than the mark, which neither a size floor nor a squareness test excluded
 * reliably on its own. The window still allows for the image having been rescaled, which is the
 * only case registration is needed for at all. A window sized as a FRACTION of the image is not
 * safe either: 12% of the 393-wide `tall` sheet is 47px, and its crosses sit at a 64px inset. */
const SEARCH_RADIUS = 2.5; // multiples of the cross's own arm

/* The page's darkest ink is `--color-ink` #2d1100 = rgb(45,17,0), so a fixed "dark" threshold of
 * 70 swallows body type. The cut is instead taken RELATIVE to the darkest pixel already found in
 * the search window — the cross wherever the cross is present at all, even once a heavy downscale
 * has lifted its antialiased core (measured 11-20 at 0.417x scale; a fixed cut at 30 found nothing
 * there). */
const BLACK_MARGIN = 70;
const BLACK_CEILING = 120;

/* A registration cross is two crossed arms, so its bounding box is near-SQUARE and about 2x its
 * own arm on a side — a speck is tiny, a glyph is taller than it is wide. Shape-filtering the dark
 * clusters in the window first is what tells the cross apart from page content nearest the corner. */
const CROSS_RATIO = [0.55, 1.8];
const CROSS_MIN_SIDE = 8;

function crossIn(px, w, ch, x0, y0, x1, y1, corner) {
  let darkest = 255;
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const i = (y * w + x) * ch;
      darkest = Math.min(darkest, Math.max(px[i], px[i + 1], px[i + 2]));
    }
  }
  const BLACK = Math.min(BLACK_CEILING, darkest + BLACK_MARGIN);
  const seen = new Set();
  const clusters = [];

  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const key = y * w + x;
      if (seen.has(key)) continue;
      const i = key * ch;
      if (Math.max(px[i], px[i + 1], px[i + 2]) >= BLACK) continue;

      const stack = [[x, y]];
      seen.add(key);
      let sx = 0;
      let sy = 0;
      let n = 0;
      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;
      while (stack.length > 0) {
        const [cx, cy] = stack.pop();
        sx += cx;
        sy += cy;
        n += 1;
        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            const nx = cx + dx;
            const ny = cy + dy;
            if (nx < x0 || ny < y0 || nx >= x1 || ny >= y1) continue;
            const nk = ny * w + nx;
            if (seen.has(nk)) continue;
            const j = nk * ch;
            if (Math.max(px[j], px[j + 1], px[j + 2]) < BLACK) {
              seen.add(nk);
              stack.push([nx, ny]);
            }
          }
        }
      }
      const bw = maxX - minX + 1;
      const bh = maxY - minY + 1;
      clusters.push({ x: sx / n, y: sy / n, n, bw, bh });
    }
  }

  const shaped = clusters.filter(
    (c) =>
      Math.min(c.bw, c.bh) >= CROSS_MIN_SIDE &&
      c.bw / c.bh >= CROSS_RATIO[0] &&
      c.bw / c.bh <= CROSS_RATIO[1],
  );
  const pool = shaped.length > 0 ? shaped : clusters;
  if (pool.length === 0)
    throw new Error(`no registration cross near ${corner.x},${corner.y}`);
  return pool.reduce((best, c) =>
    Math.hypot(c.x - corner.x, c.y - corner.y) <
    Math.hypot(best.x - corner.x, best.y - corner.y)
      ? c
      : best,
  );
}

export async function transformOf(px, w, h, ch, page) {
  const inset = page.crossInset ?? 20;
  const arm = page.crossArm ?? 40;
  /* A first guess at the scale, only to size the search window — the transform itself comes from
     the marks once they are found. */
  const guess = Math.min(w / page.width, h / page.height);
  const reach = Math.max(12, Math.round(arm * SEARCH_RADIUS * guess));

  const find = (px_, py_) => {
    const cx = px_ * (w / page.width);
    const cy = py_ * (h / page.height);
    return crossIn(
      px,
      w,
      ch,
      Math.max(0, Math.round(cx - reach)),
      Math.max(0, Math.round(cy - reach)),
      Math.min(w, Math.round(cx + reach)),
      Math.min(h, Math.round(cy + reach)),
      { x: cx, y: cy },
    );
  };
  const marks = [
    find(inset, inset),
    find(page.width - inset, inset),
    find(inset, page.height - inset),
    find(page.width - inset, page.height - inset),
  ];

  /* An image that comes back at the sheet's own pixel box, with the four marks symmetric about
     its centre, has not been rescaled or cropped — so the transform is the identity, EXACTLY, and
     measuring it can only add error. The marks still prove the image is untouched, which is what
     they are used for here. */
  const centredX =
    Math.abs(marks[0].x + marks[1].x - w) +
    Math.abs(marks[2].x + marks[3].x - w);
  const centredY =
    Math.abs(marks[0].y + marks[2].y - h) +
    Math.abs(marks[1].y + marks[3].y - h);
  if (w === page.width && h === page.height && centredX < 4 && centredY < 4) {
    return {
      marks,
      scaleX: 1,
      scaleY: 1,
      identity: true,
      toPage: (x, y) => ({ x, y }),
    };
  }
  /* Scale and offset per axis, averaged over both pairs that measure it. */
  const spanX = (marks[1].x - marks[0].x + (marks[3].x - marks[2].x)) / 2;
  const spanY = (marks[2].y - marks[0].y + (marks[3].y - marks[1].y)) / 2;
  const pageSpanX = page.width - 2 * inset;
  const pageSpanY = page.height - 2 * inset;
  const kx = pageSpanX / spanX;
  const ky = pageSpanY / spanY;
  const ox = (marks[0].x + marks[2].x) / 2;
  const oy = (marks[0].y + marks[1].y) / 2;
  return {
    marks,
    scaleX: kx,
    scaleY: ky,
    toPage: (x, y) => ({
      x: inset + (x - ox) * kx,
      y: inset + (y - oy) * ky,
    }),
  };
}

/* The drawn ink is a magenta-PINK, measured rgb(~200,70,135) rather than a pure #FF00FF, so a test
 * demanding a high blue channel loses about half the stroke to antialiasing and can fragment it.
 * What separates it from everything else on the sheet is that blue sits ABOVE green:
 *   motif red   #C42A22 rgb(196, 42, 34)  b-g = -8   excluded
 *   blue tick   #2F6FED rgb( 47,111,237)  r  = 47    excluded
 *   dusty pinks of the botanical          b-g ~ 0    excluded
 *   gold, mahogany, cream                 r-g small  excluded */
export function magentaField(px, w, h, ch) {
  const ink = new Uint8Array(w * h);
  for (let i = 0; i < ink.length; i += 1) {
    const r = px[i * ch];
    const g = px[i * ch + 1];
    const b = px[i * ch + 2];
    ink[i] = r > 100 && r - g > 45 && b - g > 20 ? 1 : 0;
  }
  return { ink, width: w, height: h };
}

/** One field per connected component: each lift of the pen is its own stroke. */
export function components(field) {
  const { ink, width, height } = field;
  const seen = new Uint8Array(ink.length);
  const out = [];
  for (let start = 0; start < ink.length; start += 1) {
    if (ink[start] === 0 || seen[start] === 1) continue;
    const stack = [start];
    const pixels = [];
    seen[start] = 1;
    while (stack.length > 0) {
      const at = stack.pop();
      pixels.push(at);
      const x = at % width;
      const y = Math.floor(at / width);
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const n = ny * width + nx;
          if (ink[n] === 1 && seen[n] === 0) {
            seen[n] = 1;
            stack.push(n);
          }
        }
      }
    }
    if (pixels.length < 40) continue; // a speck, not a stroke
    const own = new Uint8Array(ink.length);
    for (const at of pixels) own[at] = 1;
    out.push({ ink: own, width, height, size: pixels.length });
  }
  return out;
}

/** Ramer-Douglas-Peucker: the fewest points whose polyline stays within `tolerance` of the trail. */
export function simplify(points, tolerance) {
  if (points.length < 3) return points;
  const first = points[0];
  const last = points.at(-1);
  let worst = 0;
  let at = 0;
  const dx = last.x - first.x;
  const dy = last.y - first.y;
  const span = Math.hypot(dx, dy) || 1;
  for (let i = 1; i < points.length - 1; i += 1) {
    const d =
      Math.abs(
        dy * points[i].x -
          dx * points[i].y +
          last.x * first.y -
          last.y * first.x,
      ) / span;
    if (d > worst) {
      worst = d;
      at = i;
    }
  }
  if (worst <= tolerance) return [first, last];
  return [
    ...simplify(points.slice(0, at + 1), tolerance),
    ...simplify(points.slice(at), tolerance).slice(1),
  ];
}

export async function extract(file, { page, tolerance = 4, spur = 0.04 } = {}) {
  const { data, info } = await sharp(file)
    .flatten({ background: "#ffffff" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: ch } = info;

  const map = await transformOf(data, w, h, ch, page);
  const field = magentaField(data, w, h, ch);
  const strokes = [];

  for (const piece of components(field)) {
    const skeleton = pruneSpurs(thin(piece), { fraction: spur });
    const trail = walk(skeleton).map(({ x, y }) => map.toPage(x, y));
    strokes.push(simplify(trail, tolerance));
  }
  /* Down the page, so the strokes come back in the order the thread runs. */
  strokes.sort((a, b) => a[0].y + a.at(-1).y - (b[0].y + b.at(-1).y));
  return { map, strokes };
}

const deg = (r) => (r * 180) / Math.PI;
const wrap = (a) => ((((a + 180) % 360) + 360) % 360) - 180;
const gap = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/* Direction over a short RUN, not the last segment: one simplified segment can be a few pixels
 * long, and its angle is then skeleton noise rather than the line's heading. */
function headingAt(stroke, which, page) {
  const REACH = Math.max(20, Math.round(page.width / 34));
  const anchor = which === "from" ? stroke[0] : stroke.at(-1);
  const order = which === "from" ? stroke : [...stroke].reverse();
  const away = order.find((p) => gap(p, anchor) >= REACH) ?? order.at(-1);
  return which === "from"
    ? deg(Math.atan2(away.y - anchor.y, away.x - anchor.x))
    : deg(Math.atan2(anchor.y - away.y, anchor.x - away.x));
}

/* `walk` starts from whichever loose end of a stroke's skeleton it meets first (the leftmost, see
 * `trace-motif.mjs`), so a recovered stroke's ORIENTATION carries no meaning on its own. Strokes
 * are assigned to the connector chain by STRUCTURE instead: N motifs in page order give N+1
 * connectors — a free end before the first motif, a connector between each consecutive pair, a
 * free end after the last — and each candidate stroke is tried in BOTH directions against a
 * connector's required from/to points, keeping whichever orientation costs least. Proximity alone,
 * with no flip, would silently accept a backwards match whenever a stroke's natural walk order
 * happens to run opposite to the connector it serves. */
export function assignConnectors(strokes, points, page) {
  const links = [{ from: null, to: points[0] }];
  for (let i = 1; i < points.length; i += 2)
    links.push({ from: points[i], to: points[i + 1] ?? null });

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
  const lines = [];
  assigned.forEach((a, k) => {
    if (!a.stroke) {
      lines.push(`  connector ${k}: NO STROKE`);
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
      const drew = headingAt(a.stroke, which, page);
      const off = Math.abs(wrap(drew - t.heading));
      worstAngle = Math.max(worstAngle, off);
      /* `end` names which end of the CONNECTOR this join is ("from"/"to"); `t.which` survives the
         spread as the MOTIF's own "entry"/"exit" tag — a bug in the original scratch script
         spread `t` over a field also named `which`, so the connector-role value was silently
         overwritten by the motif's tag on every join. The console line above was unaffected (it
         reads the closure variable directly), but `joins.json` lost the distinction. */
      joins.push({
        connector: k,
        ...t,
        end: which,
        drew,
        off,
        dist: gap(at, t),
      });
      parts.push(
        `${which} ${t.section}/${t.motif}/${t.which} ${gap(at, t).toFixed(0)}px ${off.toFixed(1)}deg`,
      );
    }
    lines.push(
      `  connector ${k} (stroke ${a.i}${a.flip ? " rev" : ""}, ${a.stroke.length} pts)  ${parts.join("   ")}`,
    );
  });

  return { links, assigned, joins, worstAngle, unassigned: free.size, lines };
}

/** Every glyph rect on the page, in `main`-relative coordinates — the same frame the drawing uses.
 * `Range.getClientRects()`, never an element's bounding box: a wrapper span is as wide as its
 * column plus any overrun allowance, so a bounding-box check reports collisions that are not there. */
export async function fetchGlyphRects(browser, viewport) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  await page.goto("http://localhost:3000/", { waitUntil: "load" });
  const count = await page.locator("main > section").count();
  for (let i = 0; i < count; i += 1) {
    await page.locator("main > section").nth(i).scrollIntoViewIfNeeded();
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  const glyphs = await page.evaluate(() => {
    const main = document.querySelector("main");
    const origin = main.getBoundingClientRect().top + window.scrollY;
    const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
    const out = [];
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.nodeValue.trim()) continue;
      const parent = node.parentElement;
      if (!parent || parent.closest("[aria-hidden='true']")) continue;
      const style = getComputedStyle(parent);
      if (style.visibility === "hidden" || style.display === "none") continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const r of range.getClientRects()) {
        if (r.width < 0.5 || r.height < 0.5) continue;
        out.push({
          left: r.left + window.scrollX,
          right: r.right + window.scrollX,
          top: r.top + window.scrollY - origin,
          bottom: r.bottom + window.scrollY - origin,
        });
      }
    }
    return out;
  });
  await page.close();
  return glyphs;
}

/* The placement law is "may cross anything, may never cross type" — a freehand drawing can break
 * it in a way an authored grid never could. This walks the drawn centreline in small steps and
 * measures the nearest glyph rect to every sample, per section, so a real crossing (distance 0) can
 * be told apart from a close pass. */
export function typeClearanceReport(connectors, geometry, glyphs) {
  const sections = geometry.sections;
  const inSection = (y) =>
    sections.findIndex((s) => y >= s.top && y < s.top + s.height);
  const worst = SECTION_ORDER.map(() => ({
    min: Infinity,
    crossings: 0,
    samples: 0,
  }));

  for (const { points } of connectors) {
    if (!points) continue;
    for (let i = 1; i < points.length; i += 1) {
      const a = points[i - 1];
      const b = points[i];
      const span = Math.hypot(b.x - a.x, b.y - a.y);
      const steps = Math.max(1, Math.ceil(span / TYPE_SAMPLE_STEP));
      for (let s = 0; s <= steps; s += 1) {
        const t = s / steps;
        const x = a.x + (b.x - a.x) * t;
        const y = a.y + (b.y - a.y) * t;
        const idx = inSection(y);
        if (idx < 0) continue;
        const cell = worst[idx];
        cell.samples += 1;
        for (const g of glyphs) {
          const dx = Math.max(g.left - x, 0, x - g.right);
          const dy = Math.max(g.top - y, 0, y - g.bottom);
          const d = Math.hypot(dx, dy);
          if (d < cell.min) cell.min = d;
          if (d === 0) cell.crossings += 1;
        }
      }
    }
  }
  return worst;
}

async function main() {
  const args = process.argv.slice(2);
  const positional = args.filter((a) => !a.startsWith("--"));
  const [band, file] = positional;
  const dirArg = args.find((a) => a.startsWith("--dir="));
  const dir = dirArg?.slice("--dir=".length);

  if (!band || !file || !dir || !(band in CROSS_INSET)) {
    console.error(
      "usage: node scripts/import-thread-drawing.mjs <wide|tall|upright> <drawing.png> --dir=<sheet dir>",
    );
    process.exitCode = 1;
    return;
  }

  const geometry = JSON.parse(readFileSync(`${dir}/geometry.json`, "utf8"));
  const attachments = JSON.parse(
    readFileSync(`${dir}/attachments.json`, "utf8"),
  );
  const page = {
    width: geometry.width,
    height: Math.round(
      geometry.sections.at(-1).top + geometry.sections.at(-1).height,
    ),
    crossInset: CROSS_INSET[band],
  };

  const { map, strokes } = await extract(file, { page });
  const { assigned, joins, worstAngle, unassigned, lines } = assignConnectors(
    strokes,
    attachments,
    page,
  );

  console.log(
    `\n=== ${band} ===  ${page.width} x ${page.height}  identity:${map.identity ?? false}  strokes ${strokes.length} / links ${assigned.length}`,
  );
  for (const line of lines) console.log(line);
  console.log(
    `  worst angle ${worstAngle.toFixed(1)}deg   unassigned ${unassigned}`,
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

  const browser = await chromium.launch({ channel: "chromium" });
  let glyphs;
  try {
    glyphs = await fetchGlyphRects(browser, VIEWPORT[band]);
  } finally {
    await browser.close();
  }

  const connectors = assigned.map((a, k) => ({
    connector: k,
    points: a.stroke,
  }));
  const worst = typeClearanceReport(connectors, geometry, glyphs);

  console.log(`\n=== type clearance ===  ${glyphs.length} glyph rects`);
  let crossed = false;
  worst.forEach((w, i) => {
    if (w.crossings > 0) crossed = true;
    console.log(
      `  ${SECTION_ORDER[i].padEnd(13)} samples ${String(w.samples).padStart(5)}  nearest type ${
        w.min === Infinity ? "n/a" : `${w.min.toFixed(1)}px`
      }${w.crossings > 0 ? `   *** ${w.crossings} SAMPLES ON TYPE ***` : ""}`,
    );
  });

  if (crossed) {
    console.error(
      "\nREFUSED: the drawn thread crosses type. The placement law is 'may cross anything, may never cross type' — nudge the drawing clear of it and re-import.",
    );
    process.exitCode = 1;
    return;
  }
  console.log("\nOK: clear of type on every section.");
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
