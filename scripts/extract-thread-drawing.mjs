/* Freehand drawing in, ordered waypoints out.
 *
 * The owner draws magenta over DRAW-HERE.png in whatever app they like and sends the image back.
 * Nothing about that round trip can be trusted: the app may rescale, crop, or re-encode as JPEG.
 * So the transform back into page pixels is MEASURED from the four black registration crosses
 * rather than assumed from the file's dimensions.
 *
 * Thinning, spur pruning and the ordered walk are the repo's own tracer - the same code that traced
 * the motifs - so this adds a mask and a transform, not a second geometry implementation.
 */

import { readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import { pruneSpurs, thin, walk } from "./trace-motif.mjs";

const OUT = "assets/thread/wide";
const CROSS_INSET = 20;
/* The sheet is one we generated, so the crosses' positions are KNOWN and the search is a small
   window centred on each one rather than a hunt through a corner region. Blind corner search kept
   picking page content: a 19px botanical speck sitting closer to the page edge than the mark, which
   no amount of shape filtering reliably excluded. Searching where the mark IS turns an open-ended
   detection problem into a bounded verification. The window still allows for the image having been
   rescaled, which is the only case registration is needed for at all. */
const SEARCH_RADIUS = 2.5; // multiples of the cross's own arm
/* The page's darkest ink is `--color-ink` #2d1100 = rgb(45,17,0), so a loose "dark" test reads body
   type as part of a cross. The crosses are drawn PURE black - but a returned image may be scaled
   down far enough that antialiasing lifts even their cores (at 0.417x the darkest cross pixel
   measured 11-20, and a fixed cut at 30 found nothing). So the cut is taken RELATIVE to the darkest
   pixel in the corner window, which is the cross wherever the cross is present at all. */
const BLACK_MARGIN = 70;
const BLACK_CEILING = 120;

/* The registration cross nearest the corner: the dark clusters in the window are shape-filtered
   first, because "nearest the corner" alone picks a 19px botanical speck sitting closer to the
   page edge than the mark. A cross is two crossed arms, so its bounding box is near-SQUARE and
   about 2 x ARM on a side, where a speck is tiny and a glyph is taller than it is wide. */
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
  const inset = page.crossInset ?? CROSS_INSET;
  const arm = page.crossArm ?? 40;
  /* A first guess at the scale, only to size the search window - the transform itself comes from
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

  /* An image that comes back at the sheet's own pixel box, with four marks symmetric about its
     centre, has not been rescaled or cropped - so the transform is the identity, EXACTLY, and
     measuring it can only add error. The first sheets drew their crosses inset 20 with 40-unit
     arms, so each one is clipped by the canvas edge and its centroid is biased about 4.5px inward;
     that bias reads as a 0.7% scale. The marks still prove the image is untouched, which is what
     they are used for here. Later sheets inset the crosses clear of the edge. */
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
   demanding a high blue channel loses about half the stroke to antialiasing and can fragment it.
   What separates it from everything else on the sheet is that blue sits ABOVE green:
     motif red   #C42A22 rgb(196, 42, 34)  b-g = -8   excluded
     blue tick   #2F6FED rgb( 47,111,237)  r  = 47    excluded
     dusty pinks of the botanical          b-g ~ 0    excluded
     gold, mahogany, cream                 r-g small  excluded */
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

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const file = process.argv[2];
  const geometry = JSON.parse(readFileSync(`${OUT}/geometry.json`, "utf8"));
  const page = {
    width: geometry.width,
    height: Math.round(
      geometry.sections.at(-1).top + geometry.sections.at(-1).height,
    ),
  };
  const { map, strokes } = await extract(file, { page });
  console.log(
    `scale x${map.scaleX.toFixed(4)} y${map.scaleY.toFixed(4)}  strokes ${strokes.length}`,
  );
  for (const [i, s] of strokes.entries()) {
    console.log(
      `  stroke ${i}: ${s.length} pts  ${s.map((p) => `${p.x.toFixed(0)},${p.y.toFixed(0)}`).join(" ")}`,
    );
  }
  writeFileSync(
    `${OUT}/extracted.json`,
    `${JSON.stringify({ page, strokes }, null, 2)}\n`,
  );
}
