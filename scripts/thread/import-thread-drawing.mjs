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
 * usage: node scripts/thread/import-thread-drawing.mjs <wide|tall|upright> <drawing.png> --dir=<sheet dir>
 *
 * <sheet dir> already holds `geometry.json` (the page's width and section bands) and
 * `attachments.json` (every motif's entry/exit tick, in page pixels, in the order the thread
 * runs). The tool writes `connectors.json` and `joins.json` back into it only once every check
 * passes; a refused import leaves both as they were.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import sharp from "sharp";
import { pruneSpurs, thin, walkThrough } from "./trace-motif.mjs";

/**
 * @typedef {{ x: number, y: number }} Point
 * @typedef {{ ink: Uint8Array, width: number, height: number }} Field
 * @typedef {{ width: number, height: number, crossInset?: number, crossArm?: number }} Page
 * @typedef {{ x: number, y: number, n: number, bw: number, bh: number }} Mark
 * @typedef {{ marks: Mark[], scaleX: number, scaleY: number, identity?: boolean, toPage: (x: number, y: number) => Point }} Transform
 * @typedef {{ section: string, motif: string, which: string, x: number, y: number, heading: number }} Attachment
 * @typedef {{ left: number, right: number, top: number, bottom: number, text?: string }} Glyph
 * @typedef {{ top: number, height: number }} Band
 * @typedef {{ width: number, sections: Band[] }} Geometry
 * @typedef {{ connector: number, points: Point[] | null, freeStart?: boolean, freeEnd?: boolean }} Connector
 * @typedef {Attachment & { connector: number, end: "from" | "to", drew: number, off: number, dist: number }} Join
 * @typedef {{ width: number, height: number }} Viewport
 * @typedef {{ glyphs: Glyph[], sections: number, portraits: Point[] }} LivePage
 */

/* The inset the registration crosses are drawn at is a property of the SHEET. The final motif sheets
 * (2026-11-01) inset them 64px on every band; an earlier `wide` sheet inset them only 20px, where a
 * cross sat half-clipped by the canvas edge, and a clipped cross biases its own centroid inward, which
 * reads as a scale error rather than as damage. */
export const CROSS_INSET = { wide: 64, tall: 64, upright: 64 };
const VIEWPORT = {
  wide: { width: 1536, height: 695 },
  tall: { width: 393, height: 700 },
  upright: { width: 820, height: 1180 },
};
/* The SHEETS' section order, which indexes their own `geometry.json`. The final motif sheets
 * (2026-11-01) are drawn against the five-section page, with Contact retired (2026-10-14); the
 * sheets already in `assets/thread/` predate that and still carry it, which `build-thread-paths.mjs`
 * removes in code, and they are not imported again. */
export const SECTION_ORDER = [
  "invite",
  "event-info",
  "family",
  "celebrations",
  "wishes",
];
const TYPE_SAMPLE_STEP = 2; // px between samples along the drawn line, for the type-clearance walk

/* A small window centred on each cross's KNOWN position, not a blind corner search, which loses to
 * page content. The window is a multiple of the cross's own arm, not a fraction of the image: a
 * fraction of a narrow sheet is smaller than its crosses' inset. It still allows for a rescaled
 * image, the only case registration is needed for. */
const SEARCH_RADIUS = 2.5; // multiples of the cross's own arm

/* The page's darkest ink is `--color-ink` #2d1100, so a fixed "dark" threshold swallows body type.
 * The cut is taken RELATIVE to the darkest pixel in the search window, which finds the cross even
 * once a heavy downscale has lifted its antialiased core. */
const BLACK_MARGIN = 70;
const BLACK_CEILING = 120;

/* A registration cross is two crossed arms, so its bounding box is near-SQUARE and about 2x its
 * own arm on a side — a speck is tiny, a glyph is taller than it is wide. Shape-filtering the dark
 * clusters in the window first is what tells the cross apart from page content nearest the corner. */
const CROSS_RATIO = [0.55, 1.8];
const CROSS_MIN_SIDE = 8;

/**
 * @param {Uint8Array} px
 * @param {number} w
 * @param {number} ch
 * @param {number} x0
 * @param {number} y0
 * @param {number} x1
 * @param {number} y1
 * @param {Point} corner
 * @returns {Mark}
 */
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
  /** @type {Mark[]} */
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
        const [cx, cy] = /** @type {number[]} */ (stack.pop());
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

/**
 * @param {Uint8Array} px
 * @param {number} w
 * @param {number} h
 * @param {number} ch
 * @param {Page} page
 * @returns {Promise<Transform>}
 */
export async function transformOf(px, w, h, ch, page) {
  const inset = page.crossInset ?? 20;
  const arm = page.crossArm ?? 40;
  /* A first guess at the scale, only to size the search window — the transform itself comes from
     the marks once they are found. */
  const guess = Math.min(w / page.width, h / page.height);
  const reach = Math.max(12, Math.round(arm * SEARCH_RADIUS * guess));

  /** @param {number} px_ @param {number} py_ */
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

/**
 * @param {Uint8Array} px
 * @param {number} w
 * @param {number} h
 * @param {number} ch
 * @returns {Field}
 */
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

/**
 * One field per connected component: each lift of the pen is its own stroke.
 * @param {Field} field
 * @returns {(Field & { size: number })[]}
 */
export function components(field) {
  const { ink, width, height } = field;
  const seen = new Uint8Array(ink.length);
  /** @type {(Field & { size: number })[]} */
  const out = [];
  for (let start = 0; start < ink.length; start += 1) {
    if (ink[start] === 0 || seen[start] === 1) continue;
    const stack = [start];
    /** @type {number[]} */
    const pixels = [];
    seen[start] = 1;
    while (stack.length > 0) {
      const at = /** @type {number} */ (stack.pop());
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

/**
 * Ramer-Douglas-Peucker: the fewest points whose polyline stays within `tolerance` of the trail.
 * @param {Point[]} points
 * @param {number} tolerance
 * @returns {Point[]}
 */
export function simplify(points, tolerance) {
  if (points.length < 3) return points;
  const first = points[0];
  const last = /** @type {Point} */ (points.at(-1));
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

/**
 * @param {string} file
 * @param {{ page?: Page, tolerance?: number, spur?: number, patches?: { file: string, sheetY: number }[] }} [options]
 *   `patches` are crops of the same sheet, redrawn, laid over it from their sheet row down.
 */
export async function extract(
  file,
  { page, tolerance = 4, spur = 0.04, patches = [] } = {},
) {
  const { data, info } = await sharp(file)
    .flatten({ background: "#ffffff" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: ch } = info;

  const map = await transformOf(data, w, h, ch, /** @type {Page} */ (page));
  const field = magentaField(data, w, h, ch);
  /** @type {number[]} page rows where a patch meets the sheet */
  const seams = [];
  for (const patch of patches) {
    const raw = await sharp(patch.file)
      .flatten({ background: "#ffffff" })
      .raw()
      .toBuffer({ resolveWithObject: true });
    overlayPatch(
      field,
      magentaField(
        raw.data,
        raw.info.width,
        raw.info.height,
        raw.info.channels,
      ),
      patch.sheetY,
    );
    seams.push(
      map.toPage(0, patch.sheetY).y,
      map.toPage(0, patch.sheetY + raw.info.height).y,
    );
  }
  /** @type {Point[][]} */
  const strokes = [];
  for (const piece of components(field)) {
    let ink = 0;
    for (const pixel of piece.ink) ink += pixel;
    if (ink < SPECK) {
      console.log(`  skipped a speck of ${ink} magenta pixels`);
      continue;
    }
    const skeleton = pruneSpurs(thin(piece), { fraction: spur });
    const trail = walkThrough(skeleton).map(({ x, y }) => map.toPage(x, y));
    strokes.push(simplify(trail, tolerance));
  }
  return { map, strokes, seams };
}

/* ---- the continuous redraw ----------------------------------------------------------------
 * The owner draws ONE line down the sheet, straight through the motifs printed on it, lifting the
 * pen where they like. The strokes are chained back into that line, and the line is cut out where
 * each motif sits: from the point nearest its entry tick to the point nearest its exit tick. */

/* A connected patch of magenta smaller than this many sheet pixels is a speck, not a stroke: a
   stroke a few pixels long is already hundreds of pixels of ink. */
const SPECK = 200;
/* A drawn line passing a motif further off than this has not been drawn to it. */
const MOTIF_MISS = 40;
/* A pen lift inside a connector wider than this is not a lift: it is a stroke the line was never
   drawn through, and chaining it in would draw a straight bridge across the page. */
const CONNECTOR_GAP = 60;
/* How near a ring's own radius the line must pass for the ring to be turned to meet it. */
const RING_TOLERANCE = 20;
/* A pen lift with both ends this near a patch's edge row is where the patch meets the sheet. */
const SEAM_REACH = 12;

/**
 * Chain strokes into one line: start from the stroke reaching highest up the page, then take each
 * next stroke by whichever end lies nearest the line's current end, reversing it if needed. Where
 * the line stops at a motif's entry tick, the pen resumes at that motif's exit, so the next stroke
 * is measured from the exit instead.
 * Across a patch seam the next stroke is entered at its point nearest the line's end: what lies
 * before that is the old drawing the patch replaced.
 * @param {Point[][]} strokes
 * @param {Attachment[]} [attachments]
 * @param {number[]} [seams] page rows where a patch meets the sheet
 * @returns {{ line: Point[], joints: number[] }} `joints` index the first point of every stroke
 *   after the first, where the pen was lifted.
 */
export function chainStrokes(strokes, attachments = [], seams = []) {
  const left = strokes.map((s) => s.slice());
  const topmost = (/** @type {Point[]} */ s) =>
    Math.min(s[0].y, /** @type {Point} */ (s.at(-1)).y);
  left.sort((a, b) => topmost(a) - topmost(b));
  const first = /** @type {Point[]} */ (left.shift());
  if (/** @type {Point} */ (first.at(-1)).y < first[0].y) first.reverse();
  const line = first;
  /** @type {number[]} */
  const joints = [];
  while (left.length > 0) {
    const end = /** @type {Point} */ (line.at(-1));
    /** @type {Point} */
    let resume = end;
    let reach = MOTIF_MISS;
    for (let i = 0; i + 1 < attachments.length; i += 2)
      if (gap(end, attachments[i]) <= reach) {
        reach = gap(end, attachments[i]);
        resume = attachments[i + 1];
      }
    let best = { index: 0, flip: false, distance: Infinity };
    left.forEach((stroke, index) => {
      for (const flip of [false, true]) {
        const start = flip ? /** @type {Point} */ (stroke.at(-1)) : stroke[0];
        const distance = gap(resume, start);
        if (distance < best.distance) best = { index, flip, distance };
      }
    });
    const [picked] = left.splice(best.index, 1);
    if (best.flip) picked.reverse();
    let next = picked;
    const onSeam = (/** @type {Point} */ p) =>
      seams.some((y) => Math.abs(p.y - y) <= SEAM_REACH);
    if (onSeam(end) && onSeam(next[0])) {
      let entry = 0;
      for (let i = 1; i < next.length; i += 1)
        if (gap(end, next[i]) < gap(end, next[entry])) entry = i;
      next = blendAcross(line, next.slice(entry));
    }
    joints.push(line.length);
    line.push(...next);
  }
  return { line, joints };
}

/* A patch seam is eased over this much line either side, so the patch's line flows into the
   sheet's rather than stepping across. */
const SEAM_BLEND = 60;

/**
 * Ease `line` into `next` across a seam: the last SEAM_BLEND px of the line and the first of `next`
 * give way to one curve leaving the line and arriving on `next` along their own headings. `line` is
 * shortened in place; the rest of `next`, curve first, is returned.
 * @param {Point[]} line
 * @param {Point[]} next
 * @returns {Point[]}
 */
function blendAcross(line, next) {
  let a = line.length - 1;
  for (let run = 0; a > 1 && run < SEAM_BLEND; a -= 1)
    run += gap(line[a], line[a - 1]);
  let b = 0;
  for (let run = 0; b < next.length - 2 && run < SEAM_BLEND; b += 1)
    run += gap(next[b], next[b + 1]);
  const from = line[a];
  const to = next[b];
  const span = gap(from, to);
  const unit = (/** @type {Point} */ p, /** @type {Point} */ q) => {
    const d = gap(p, q) || 1;
    return { x: ((q.x - p.x) / d) * span, y: ((q.y - p.y) / d) * span };
  };
  const leave = unit(line[a - 1], from);
  const arrive = unit(to, next[b + 1]);
  const steps = Math.max(2, Math.ceil(span / 4));
  /** @type {Point[]} */
  const curve = [];
  for (let k = 1; k < steps; k += 1) {
    const t = k / steps;
    const h00 = 2 * t ** 3 - 3 * t ** 2 + 1;
    const h10 = t ** 3 - 2 * t ** 2 + t;
    const h01 = -2 * t ** 3 + 3 * t ** 2;
    const h11 = t ** 3 - t ** 2;
    curve.push({
      x: h00 * from.x + h10 * leave.x + h01 * to.x + h11 * arrive.x,
      y: h00 * from.y + h10 * leave.y + h01 * to.y + h11 * arrive.y,
    });
  }
  line.length = a + 1;
  return [...curve, ...next.slice(b)];
}

/**
 * @param {Point[]} line
 * @param {number} from
 * @param {Point} target
 */
function nearestFrom(line, from, target) {
  let index = from;
  for (let i = from; i < line.length; i += 1)
    if (gap(line[i], target) < gap(line[index], target)) index = i;
  return { index, distance: gap(line[index], target) };
}

/**
 * Where the line, from `from` on, first runs along a ring: the first stretch it passes within
 * RING_TOLERANCE of the ring's radius, and in that stretch the point nearest the ring itself.
 * @param {Point[]} line
 * @param {number} from
 * @param {Point} centre
 * @param {number} radius
 */
function meetsRing(line, from, centre, radius) {
  const off = (/** @type {Point} */ p) => Math.abs(gap(p, centre) - radius);
  let start = -1;
  for (let i = from; i < line.length; i += 1)
    if (off(line[i]) <= RING_TOLERANCE) {
      start = i;
      break;
    }
  if (start === -1) return null;
  let best = start;
  for (let i = start; i < line.length && off(line[i]) <= RING_TOLERANCE; i += 1)
    if (off(line[i]) < off(line[best])) best = i;
  return best;
}

/**
 * @param {Point} p
 * @param {Point} centre
 * @param {number} angle radians
 */
function rotateAbout(p, centre, angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const dx = p.x - centre.x;
  const dy = p.y - centre.y;
  return { x: centre.x + dx * c - dy * s, y: centre.y + dx * s + dy * c };
}

/**
 * Cut the chained line into connectors at the motifs. Every attachment pair (entry, exit) is one
 * motif. A portrait ring is turned about its portrait so its ticks sit where the line meets the
 * ring, and cut there; any other motif is cut from the point nearest its entry tick to the point
 * nearest its exit tick. With a `tail`, the connector after the last motif is that kept stroke,
 * moved so it starts on the last motif's exit tick, and the drawing after the last entry is unused.
 * @param {Point[]} line
 * @param {number[]} joints where the pen lifted, from `chainStrokes`; a lift wider than
 *   CONNECTOR_GAP is refused unless a cut removes it
 * @param {Attachment[]} attachments
 * @param {{ portraits?: Point[], tail?: { from: Point, points: Point[] } | null, seams?: number[] }} [options]
 *   `seams` are the page rows where a patch drawing meets the sheet; a pen lift across one is bridged.
 */
export function cutAtMotifs(
  line,
  joints,
  attachments,
  { portraits = [], tail = null, seams = [] } = {},
) {
  /** @type {string[]} */
  const faults = [];
  /** @type {Point[][]} */
  const connectors = [];
  /** @type {Attachment[]} */
  const placed = [];
  /** @type {[number, number][]} */
  const kept = [];
  let cursor = 0;
  for (let i = 0; i < attachments.length; i += 2) {
    const entry = attachments[i];
    const exit = attachments[i + 1];
    const name = `${entry.section}/${entry.motif}`;
    let iEntry;
    let iExit;
    if (entry.motif === "portraitLoop" && portraits.length > 0) {
      const centre = portraits.reduce((a, b) =>
        gap(a, entry) <= gap(b, entry) ? a : b,
      );
      const radius = gap(entry, centre);
      const offRing = (/** @type {Point} */ p) =>
        Math.abs(gap(p, centre) - radius);
      /* Where the pen lifted at the ring, the ring goes between the lift's two ends. */
      const lift = joints.find(
        (j) =>
          j > cursor &&
          offRing(line[j - 1]) <= RING_TOLERANCE &&
          offRing(line[j]) <= RING_TOLERANCE,
      );
      const at =
        lift !== undefined ? lift - 1 : meetsRing(line, cursor, centre, radius);
      if (at === null) {
        faults.push(`the line never runs along the ring around ${name}`);
        placed.push(entry, exit);
        continue;
      }
      const angle =
        Math.atan2(line[at].y - centre.y, line[at].x - centre.x) -
        Math.atan2(entry.y - centre.y, entry.x - centre.x);
      for (const t of [entry, exit])
        placed.push({
          ...t,
          ...rotateAbout(t, centre, angle),
          heading: wrap(t.heading + deg(angle)),
        });
      iEntry = at;
      iExit = lift ?? at;
    } else {
      const nearEntry = nearestFrom(line, cursor, entry);
      const nearExit = nearestFrom(line, nearEntry.index, exit);
      const last = i + 2 >= attachments.length;
      if (nearEntry.distance > MOTIF_MISS)
        faults.push(
          `the line passes ${name}'s entry ${nearEntry.distance.toFixed(0)}px off`,
        );
      if (!(last && tail) && nearExit.distance > MOTIF_MISS)
        faults.push(
          `the line passes ${name}'s exit ${nearExit.distance.toFixed(0)}px off`,
        );
      placed.push(entry, exit);
      iEntry = nearEntry.index;
      iExit = nearExit.index;
    }
    kept.push([cursor, iEntry]);
    connectors.push(line.slice(cursor, iEntry + 1));
    cursor = iExit;
  }
  if (tail && attachments.length > 0) {
    const exit = /** @type {Attachment} */ (placed.at(-1));
    connectors.push(
      tail.points.map((p) => ({
        x: p.x - tail.from.x + exit.x,
        y: p.y - tail.from.y + exit.y,
      })),
    );
  } else {
    kept.push([cursor, line.length - 1]);
    connectors.push(line.slice(cursor));
  }
  const onSeam = (/** @type {Point} */ p) =>
    seams.some((y) => Math.abs(p.y - y) <= SEAM_REACH);
  for (const [from, to] of kept)
    for (const at of joints) {
      if (at <= from || at > to) continue;
      const span = gap(line[at - 1], line[at]);
      if (span <= CONNECTOR_GAP || (onSeam(line[at - 1]) && onSeam(line[at])))
        continue;
      faults.push(
        `a gap of ${span.toFixed(0)}px at ${line[at].x.toFixed(0)},${line[at].y.toFixed(0)}: a stray stroke, or the pen lifted away from any motif`,
      );
    }
  return { connectors, attachments: placed, faults };
}

/**
 * A loop the owner drew so tight its hole filled with ink leaves no centreline to trace, so it is
 * named on the command line (`--loop=x,y,r`, page pixels) and rebuilt here. Nothing detects one:
 * the one such loop measured 1.85 stroke-widths deep, and thick ink where a stroke doubles back
 * measured up to 1.93.
 *
 * Tie each loop into the line at the line's nearest point: a full circle about the loop's centre,
 * starting and ending there, turning the way the line runs at that point.
 * @param {Point[]} line
 * @param {{ x: number, y: number, r: number }[]} loops
 */
export function withLoops(line, loops) {
  let out = line.slice();
  for (const loop of loops) {
    let at = 0;
    for (let i = 0; i < out.length; i += 1)
      if (gap(out[i], loop) < gap(out[at], loop)) at = i;
    const ahead = out[Math.min(out.length - 1, at + 1)];
    const behind = out[Math.max(0, at - 1)];
    const hx = ahead.x - behind.x;
    const hy = ahead.y - behind.y;
    const start = Math.atan2(out[at].y - loop.y, out[at].x - loop.x);
    const startPoint = {
      x: loop.x + loop.r * Math.cos(start),
      y: loop.y + loop.r * Math.sin(start),
    };
    /* Counter-clockwise (in page coordinates, +angle) leaves along (-sin, cos); keep that direction
       if it runs with the line, else go the other way round. */
    const turn = -Math.sin(start) * hx + Math.cos(start) * hy >= 0 ? 1 : -1;
    const steps = Math.max(24, Math.ceil(2 * Math.PI * loop.r));
    const circle = Array.from({ length: steps + 1 }, (_, k) => {
      const a = start + turn * ((2 * Math.PI * k) / steps);
      return {
        x: loop.x + loop.r * Math.cos(a),
        y: loop.y + loop.r * Math.sin(a),
      };
    });
    out = [
      ...out.slice(0, at + 1),
      startPoint,
      ...circle.slice(1),
      ...out.slice(at),
    ];
  }
  return out;
}

/**
 * Lay a patch drawing over the sheet's field: the patch is a crop of the same sheet, so its rows
 * replace the sheet's from `sheetY` down, magenta and blank alike.
 * @param {Field} field
 * @param {Field} patch
 * @param {number} sheetY
 */
export function overlayPatch(field, patch, sheetY) {
  if (patch.width !== field.width)
    throw new Error(
      `a patch must be the sheet's width (${field.width}px), not ${patch.width}px`,
    );
  const rows = Math.min(patch.height, field.height - sheetY);
  field.ink.set(
    patch.ink.subarray(0, rows * patch.width),
    sheetY * field.width,
  );
}

/** @param {number} r */
const deg = (r) => (r * 180) / Math.PI;
/** @param {number} a */
const wrap = (a) => ((((a + 180) % 360) + 360) % 360) - 180;
/** @param {Point} a @param {Point} b */
const gap = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/* Direction over a short RUN, not the last segment: one simplified segment can be a few pixels
 * long, and its angle is then skeleton noise rather than the line's heading. */
/**
 * @param {Point[]} stroke
 * @param {"from" | "to"} which
 * @param {Page} page
 */
function headingAt(stroke, which, page) {
  const REACH = Math.max(20, Math.round(page.width / 34));
  const anchor = /** @type {Point} */ (
    which === "from" ? stroke[0] : stroke.at(-1)
  );
  const order = which === "from" ? stroke : [...stroke].reverse();
  const away = /** @type {Point} */ (
    order.find((p) => gap(p, anchor) >= REACH) ?? order.at(-1)
  );
  return which === "from"
    ? deg(Math.atan2(away.y - anchor.y, away.x - anchor.x))
    : deg(Math.atan2(anchor.y - away.y, anchor.x - away.x));
}

/**
 * How each connector meets its motifs. N motifs give N+1 connectors — a free run before the first,
 * one between each pair, one after the last — so connector k leaves attachment 2k-1 and arrives at
 * attachment 2k. For every end that joins a motif: how far off the tick it lands, and how far its
 * drawn heading turns from the tick's.
 * @param {Point[][]} connectors
 * @param {Attachment[]} attachments
 * @param {Page} page
 */
export function joinsOf(connectors, attachments, page) {
  let worstAngle = 0;
  /** @type {Join[]} */
  const joins = [];
  /** @type {string[]} */
  const lines = [];
  connectors.forEach((stroke, k) => {
    const ends = {
      from: k > 0 ? (attachments[2 * k - 1] ?? null) : null,
      to: attachments[2 * k] ?? null,
    };
    const parts = [];
    for (const which of /** @type {const} */ (["from", "to"])) {
      const t = ends[which];
      if (!t) {
        parts.push(`${which} FREE`);
        continue;
      }
      const at = /** @type {Point} */ (
        which === "from" ? stroke[0] : stroke.at(-1)
      );
      const drew = headingAt(stroke, which, page);
      const off = Math.abs(wrap(drew - t.heading));
      worstAngle = Math.max(worstAngle, off);
      /* `end` names which end of the CONNECTOR this join is ("from"/"to"). It is not called
         `which` because `t`, spread in below, carries the MOTIF's own `which` ("entry"/"exit"). */
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
    lines.push(`  connector ${k} (${stroke.length} pts)  ${parts.join("   ")}`);
  });
  return { joins, worstAngle, lines };
}

/** Every glyph rect on the page, in `main`-relative coordinates — the same frame the drawing uses —
 * and the page's section count.
 * `Range.getClientRects()`, never an element's bounding box: a wrapper span is as wide as its
 * column plus any overrun allowance, so a bounding-box check reports collisions that are not there.
 * The drawn names count as type (they are words), stroke by stroke; each portrait's centre is returned so a
 * portrait ring can be turned about it.
 * @param {import("playwright").Browser} browser
 * @param {Viewport} viewport
 * @param {string} url
 * @returns {Promise<LivePage>}
 */
async function fetchGlyphRects(browser, viewport, url) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  await page.goto(url, { waitUntil: "load" });
  const count = await page.locator("main > section").count();
  for (let i = 0; i < count; i += 1) {
    await page.locator("main > section").nth(i).scrollIntoViewIfNeeded();
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  const found = await page.evaluate(() => {
    const main = /** @type {HTMLElement} */ (document.querySelector("main"));
    const origin = main.getBoundingClientRect().top + window.scrollY;
    const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
    const out = [];
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!(/** @type {string} */ (node.nodeValue).trim())) continue;
      const parent = node.parentElement;
      if (!parent || parent.closest("[aria-hidden='true']")) continue;
      const style = getComputedStyle(parent);
      if (style.visibility === "hidden" || style.display === "none") continue;
      /* Screen-reader-only text is clipped to a pixel but still reports its full line boxes. */
      const box = parent.getBoundingClientRect();
      if (box.width <= 1 && box.height <= 1) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      const text = /** @type {string} */ (node.nodeValue).trim();
      for (const r of range.getClientRects()) {
        if (r.width < 0.5 || r.height < 0.5) continue;
        out.push({
          left: r.left + window.scrollX,
          right: r.right + window.scrollX,
          top: r.top + window.scrollY - origin,
          bottom: r.bottom + window.scrollY - origin,
          text,
        });
      }
    }
    /* By each drawn stroke, not the drawing's box: the box runs wide of the ink. */
    for (const stroke of main.querySelectorAll("svg[data-names-layout] path")) {
      const r = stroke.getBoundingClientRect();
      if (r.width < 0.5 || r.height < 0.5) continue;
      out.push({
        left: r.left + window.scrollX,
        right: r.right + window.scrollX,
        top: r.top + window.scrollY - origin,
        bottom: r.bottom + window.scrollY - origin,
        text: "drawn names",
      });
    }
    const portraits = [...main.querySelectorAll("[data-relationship] img")].map(
      (img) => {
        const r = img.getBoundingClientRect();
        return {
          x: r.left + r.width / 2 + window.scrollX,
          y: r.top + r.height / 2 + window.scrollY - origin,
        };
      },
    );
    return { glyphs: out, portraits };
  });
  await page.close();
  return { glyphs: found.glyphs, portraits: found.portraits, sections: count };
}

/* A drawn thread that comes under a glyph is closed programmatically: connectors are relaxed to
 * floor + tolerance (8px; 5px for family, where loops wrap the portraits) because a relax targeting
 * the floor lands under it. */
const FLOOR = 8;
const FLOOR_FAMILY = 5;
/* Relax to the floor PLUS the simplification tolerance, then re-simplify: re-simplifying afterwards
 * cuts corners back TOWARD the glyph, so relaxing to the bare floor lands under it. */
const RELAX_DENSIFY = 4;
const RELAX_PASSES = 250;
const RELAX_SIMPLIFY = 1.5;

/**
 * @param {string | null} sectionName
 * @param {number} floor
 * @param {number} floorFamily
 */
const floorFor = (sectionName, floor, floorFamily) =>
  sectionName === "family" ? floorFamily : floor;

/**
 * Points inserted so a SEGMENT cannot pass through a glyph between two clear vertices.
 * @param {Point[]} points
 * @param {number} step
 */
function densify(points, step) {
  const out = [points[0]];
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / step));
    for (let s = 1; s <= n; s += 1) {
      out.push({
        x: a.x + ((b.x - a.x) * s) / n,
        y: a.y + ((b.y - a.y) * s) / n,
      });
    }
  }
  return out;
}

/** @param {number} x @param {number} y @param {Glyph} g */
const relaxClearance = (x, y, g) =>
  Math.hypot(
    Math.max(g.left - x, 0, x - g.right),
    Math.max(g.top - y, 0, y - g.bottom),
  );

/* Pushes a drawn connector off type WITHOUT moving where it meets its motifs: an end joined to a
 * motif is PINNED, since moving it re-opens the join, and only interior vertices relax. An end
 * marked free (`freeStart`/`freeEnd`, the page's own loose ends) has no join and relaxes too. Densify first, then push every interior vertex under
 * the floor along the outward normal by its shortfall — a vertex INSIDE a glyph rect leaves by its
 * nearest edge, since it has no outward direction of its own. A bounded pass cap: non-convergence
 * means a vertex is being pushed off one glyph into another, i.e. no corridor of that width exists
 * there — REPORT it, do not iterate further and do not lower the floor to force it through. */

/**
 * @param {Connector[]} connectors
 * @param {Geometry} geometry
 * @param {Glyph[]} glyphs
 * @param {{ floor?: number, floorFamily?: number, densify?: number, passes?: number, simplifyTolerance?: number }} [options]
 */
export function relaxOffType(
  connectors,
  geometry,
  glyphs,
  {
    floor = FLOOR,
    floorFamily = FLOOR_FAMILY,
    densify: step = RELAX_DENSIFY,
    passes = RELAX_PASSES,
    simplifyTolerance = RELAX_SIMPLIFY,
  } = {},
) {
  const margin = simplifyTolerance + 0.5;
  const sections = geometry.sections;
  /** @param {number} y */
  const sectionAt = (y) =>
    sections.findIndex((s) => y >= s.top && y < s.top + s.height);

  let moved = 0;
  let maxMove = 0;
  /** @type {number[]} */
  const stuck = [];

  const relaxed = connectors.map(
    ({ connector, points, freeStart, freeEnd }) => {
      if (!points) return { connector, points };
      const run = densify(points, step);
      for (let pass = 0; pass < passes; pass += 1) {
        let dirty = false;
        for (
          let i = freeStart ? 0 : 1;
          i < (freeEnd ? run.length : run.length - 1);
          i += 1
        ) {
          const idx = sectionAt(run[i].y);
          const sectionName = idx >= 0 ? SECTION_ORDER[idx] : null;
          const vertexFloor =
            floorFor(sectionName, floor, floorFamily) + margin;
          let worst = null;
          for (const g of glyphs) {
            const d = relaxClearance(run[i].x, run[i].y, g);
            if (d >= vertexFloor) continue;
            if (worst === null || d < worst.d) worst = { d, g };
          }
          if (worst === null) continue;
          const g = worst.g;
          const cx = Math.min(Math.max(run[i].x, g.left), g.right);
          const cy = Math.min(Math.max(run[i].y, g.top), g.bottom);
          let vx = run[i].x - cx;
          let vy = run[i].y - cy;
          let len = Math.hypot(vx, vy);
          if (len < 1e-6) {
            /* Inside the rect: leave by the nearest edge. */
            const left = run[i].x - g.left;
            const right = g.right - run[i].x;
            const top = run[i].y - g.top;
            const bottom = g.bottom - run[i].y;
            const least = Math.min(left, right, top, bottom);
            vx = least === left ? -1 : least === right ? 1 : 0;
            vy = least === top ? -1 : least === bottom ? 1 : 0;
            len = 1;
          }
          const push = vertexFloor - worst.d;
          run[i] = {
            x: run[i].x + (vx / len) * push,
            y: run[i].y + (vy / len) * push,
          };
          maxMove = Math.max(maxMove, push);
          dirty = true;
        }
        if (!dirty) break;
        if (pass === passes - 1) stuck.push(connector);
      }
      const before = densify(points, step);
      for (let i = 0; i < run.length; i += 1) {
        if (Math.hypot(run[i].x - before[i].x, run[i].y - before[i].y) > 0.01)
          moved += 1;
      }
      return { connector, points: simplify(run, simplifyTolerance) };
    },
  );

  return { connectors: relaxed, moved, maxMove, stuck };
}

/* Relaxing pushes one vertex at a time, so it cannot take a line out of a label it runs straight
 * through when the label sits too near something else to push into — a portrait ring above a name,
 * say. Such a run is rerouted instead: round the box of the labels it touches, grown by the floor
 * and the simplification tolerance, by the shorter way. */
const DETOUR_SLACK = 4;

/**
 * @param {Point} a
 * @param {Point} b
 * @param {{ left: number, right: number, top: number, bottom: number }} box
 */
function segmentEntersBox(a, b, box) {
  let t0 = 0;
  let t1 = 1;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const e = 1e-6;
  for (const [p, q] of [
    [-dx, a.x - (box.left + e)],
    [dx, box.right - e - a.x],
    [-dy, a.y - (box.top + e)],
    [dy, box.bottom - e - a.y],
  ]) {
    if (p === 0) {
      if (q < 0) return false;
      continue;
    }
    const r = q / p;
    if (p < 0) t0 = Math.max(t0, r);
    else t1 = Math.min(t1, r);
    if (t0 > t1) return false;
  }
  return true;
}

/**
 * Reroute every run of the line that comes under `floor` of type round the box of the labels it
 * touches. A line already clear comes back unchanged; a run whose end is itself inside the box
 * (an end pinned to a motif) is left for the clearance report to name.
 * @param {Point[]} points
 * @param {Glyph[]} glyphs
 * @param {number | ((p: Point) => number)} floor the floor, or the floor where a point lies
 * @returns {Point[]}
 */
export function detourOffType(points, glyphs, floor) {
  const floorAt = typeof floor === "number" ? () => floor : floor;
  const near = (/** @type {Point} */ p) =>
    glyphs.filter((g) => relaxClearance(p.x, p.y, g) < floorAt(p));
  let line = densify(points, 2);
  if (line.every((p) => near(p).length === 0)) return points;
  let from = 0;
  for (let pass = 0; pass < 20; pass += 1) {
    const start = line.findIndex((p, i) => i >= from && near(p).length > 0);
    if (start === -1) break;
    let touched = near(line[start]);
    let end = start;
    while (end + 1 < line.length && near(line[end + 1]).length > 0) {
      end += 1;
      touched = [...touched, ...near(line[end])];
    }
    const grow = floorAt(line[start]) + DETOUR_SLACK;
    const box = {
      left: Math.min(...touched.map((g) => g.left)) - grow,
      right: Math.max(...touched.map((g) => g.right)) + grow,
      top: Math.min(...touched.map((g) => g.top)) - grow,
      bottom: Math.max(...touched.map((g) => g.bottom)) + grow,
    };
    const inside = (/** @type {Point} */ p) =>
      p.x > box.left && p.x < box.right && p.y > box.top && p.y < box.bottom;
    let i0 = start;
    let i1 = end;
    while (i0 > 0 && inside(line[i0])) i0 -= 1;
    while (i1 < line.length - 1 && inside(line[i1])) i1 += 1;
    from = i1 + 1;
    if (inside(line[i0]) || inside(line[i1])) continue;
    const a = line[i0];
    const b = line[i1];
    const corners = [
      { x: box.left, y: box.top },
      { x: box.right, y: box.top },
      { x: box.right, y: box.bottom },
      { x: box.left, y: box.bottom },
    ];
    /** @type {Point[] | null} */
    let best = null;
    let bestLength = Infinity;
    for (let first = 0; first < 4; first += 1)
      for (const turn of [1, 3])
        for (let count = 1; count <= 3; count += 1) {
          const via = Array.from(
            { length: count },
            (_, k) => corners[(first + turn * k) % 4],
          );
          const path = [a, ...via, b];
          let length = 0;
          let valid = true;
          for (let k = 1; k < path.length; k += 1) {
            if (segmentEntersBox(path[k - 1], path[k], box)) valid = false;
            length += gap(path[k - 1], path[k]);
          }
          if (valid && length < bestLength) {
            best = via;
            bestLength = length;
          }
        }
    if (best === null) continue;
    from = i0 + 1;
    line = [
      ...line.slice(0, i0 + 1),
      ...densify([a, ...best, b], 2).slice(1, -1),
      ...line.slice(i1),
    ];
  }
  return line;
}

/* The placement law is "may cross anything, may never cross type" — a freehand drawing can break
 * it in a way an authored grid never could. This walks the drawn centreline in small steps and
 * measures the nearest glyph rect to every sample, per section, so a real crossing (distance 0) can
 * be told apart from a close pass. `nearestText` names the closest glyph found, so a report can
 * name what a warning is about rather than just a bare distance. */

/**
 * @param {Connector[]} connectors
 * @param {Geometry} geometry
 * @param {Glyph[]} glyphs
 */
export function typeClearanceReport(connectors, geometry, glyphs) {
  const sections = geometry.sections;
  /** @param {number} y */
  const inSection = (y) =>
    sections.findIndex((s) => y >= s.top && y < s.top + s.height);
  /** @type {{ min: number, crossings: number, samples: number, nearestText: string | null }[]} */
  const worst = SECTION_ORDER.map(() => ({
    min: Infinity,
    crossings: 0,
    samples: 0,
    nearestText: null,
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
          if (d < cell.min) {
            cell.min = d;
            cell.nearestText = g.text ?? null;
          }
          if (d === 0) cell.crossings += 1;
        }
      }
    }
  }
  return worst;
}

/** @param {Viewport} viewport @param {string} url */
async function readLivePage(viewport, url) {
  const browser = await chromium.launch({ channel: "chromium" });
  try {
    return await fetchGlyphRects(browser, viewport, url);
  } finally {
    await browser.close();
  }
}

const USAGE =
  "usage: node scripts/thread/import-thread-drawing.mjs <wide|tall|upright> <drawing.png> --dir=<sheet dir>" +
  " [--url=<page>] [--patch=<crop.png>@<sheetY>]... [--loop=<x>,<y>,<r>]... [--tail-from=<dir>] [--report=<file>]";

/**
 * @param {string[]} args
 * @param {string} name
 */
const flags = (args, name) =>
  args
    .filter((a) => a.startsWith(`--${name}=`))
    .map((a) => a.slice(name.length + 3));

/**
 * Import the owner's continuous redraw. The strokes are chained into one line, any loop they drew
 * solid (`--loop`, page pixels) is tied back in, and the line is cut at every motif. With
 * `--tail-from`, the connector after the last motif is kept from that directory's import rather
 * than drawn. The line is relaxed off type, checked, and written as `connectors.json`,
 * `joins.json` and `attachments.json` (a portrait ring's ticks turned to where the line meets it);
 * a refused import writes nothing.
 * @param {string[]} args
 * @param {{ readPage?: (viewport: Viewport, url: string) => Promise<LivePage> }} [options]
 */
export async function importDrawing(args, { readPage = readLivePage } = {}) {
  const [band, file] = args.filter((a) => !a.startsWith("--"));
  const [dir] = flags(args, "dir");
  const [url = "http://localhost:3000/"] = flags(args, "url");
  const [tailFrom] = flags(args, "tail-from");
  const [reportFile] = flags(args, "report");
  if (!band || !file || !dir || !(band in CROSS_INSET)) {
    console.error(USAGE);
    return 1;
  }
  const patches = flags(args, "patch").map((value) => {
    const [patchFile, row] = value.split("@");
    return { file: patchFile, sheetY: Number(row) };
  });
  const loops = flags(args, "loop").map((value) => {
    const [x, y, r] = value.split(",").map(Number);
    return { x, y, r };
  });
  if (
    patches.some((p) => !p.file || !Number.isInteger(p.sheetY)) ||
    loops.some((l) => ![l.x, l.y, l.r].every(Number.isFinite))
  ) {
    console.error(USAGE);
    return 1;
  }

  const geometry = JSON.parse(readFileSync(`${dir}/geometry.json`, "utf8"));
  /** @type {Attachment[]} */
  const attachments = JSON.parse(
    readFileSync(`${dir}/attachments.json`, "utf8"),
  );
  const page = {
    width: geometry.width,
    height: Math.round(
      geometry.sections.at(-1).top + geometry.sections.at(-1).height,
    ),
    crossInset: CROSS_INSET[/** @type {keyof typeof CROSS_INSET} */ (band)],
  };

  /* Every section lookup below is by POSITION — `geometry.json` carries no ids — and the glyph
     rects come from the live page, so the sheet, `SECTION_ORDER` and the page must agree on the
     count or the floors and the clearance report attach to the wrong sections. */
  if (geometry.sections.length !== SECTION_ORDER.length) {
    console.error(
      `\nREFUSED: ${dir}/geometry.json has ${geometry.sections.length} sections; SECTION_ORDER names ${SECTION_ORDER.length}.`,
    );
    return 1;
  }

  /** @type {{ from: Point, points: Point[] } | null} */
  let tail = null;
  if (tailFrom) {
    /** @type {Connector[]} */
    const kept = JSON.parse(
      readFileSync(`${tailFrom}/connectors.json`, "utf8"),
    );
    /** @type {Attachment[]} */
    const keptTicks = JSON.parse(
      readFileSync(`${tailFrom}/attachments.json`, "utf8"),
    );
    const points = /** @type {Point[]} */ (
      /** @type {Connector} */ (kept.at(-1)).points
    );
    tail = { from: /** @type {Attachment} */ (keptTicks.at(-1)), points };
  }

  const { map, strokes, seams } = await extract(file, { page, patches });
  const { line, joints } = chainStrokes(strokes, attachments, seams);

  /* A portrait ring is turned about its portrait, so the page is read before the cut when the
     sheet has one; otherwise a drawing that cannot be cut is refused before the page is read. */
  const needsPortraits = attachments.some((a) => a.motif === "portraitLoop");
  /** @type {LivePage | null} */
  let live = needsPortraits
    ? await readPage(VIEWPORT[/** @type {keyof typeof VIEWPORT} */ (band)], url)
    : null;
  const cut = cutAtMotifs(line, joints, attachments, {
    portraits: live?.portraits ?? [],
    tail,
    seams,
  });
  /* A solid loop is tied in after the cut, into the connector passing nearest it. */
  for (const loop of loops) {
    const nearest = (/** @type {Point[]} */ c) =>
      Math.min(...c.map((p) => gap(p, loop)));
    const k = cut.connectors.reduce(
      (best, c, i) => (nearest(c) < nearest(cut.connectors[best]) ? i : best),
      0,
    );
    cut.connectors[k] = withLoops(cut.connectors[k], [loop]);
  }
  const { joins, worstAngle, lines } = joinsOf(
    cut.connectors,
    cut.attachments,
    page,
  );

  console.log(
    `\n=== ${band} ===  ${page.width} x ${page.height}  identity:${map.identity ?? false}  strokes ${strokes.length} / connectors ${cut.connectors.length}`,
  );
  for (const entry of lines) console.log(entry);
  console.log(`  worst angle ${worstAngle.toFixed(1)}deg`);
  /** The attempted line and ticks, written whether or not the import is refused, to look at.
      @param {(Point[] | null)[]} connectors */
  const report = (connectors) => {
    if (reportFile)
      writeFileSync(
        reportFile,
        `${JSON.stringify({ connectors, attachments: cut.attachments })}\n`,
      );
  };
  report(cut.connectors);
  if (cut.faults.length > 0) {
    console.error(`\nREFUSED: ${cut.faults.join("; ")}.`);
    return 1;
  }

  live ??= await readPage(
    VIEWPORT[/** @type {keyof typeof VIEWPORT} */ (band)],
    url,
  );
  const { glyphs, sections: liveSections } = live;
  if (liveSections !== geometry.sections.length) {
    console.error(
      `\nREFUSED: ${dir}/geometry.json has ${geometry.sections.length} sections; the live page has ${liveSections}. The glyph rects would sit in a different frame from the drawing — import a sheet drawn against the page it is checked on.`,
    );
    return 1;
  }

  /* Relax BEFORE the clearance check, not after, so the check reports what will actually ship. */
  const relax = relaxOffType(
    cut.connectors.map((points, k) => ({
      connector: k,
      points,
      freeStart: k === 0,
      freeEnd: k === cut.connectors.length - 1,
    })),
    geometry,
    glyphs,
  );
  console.log(
    `\n=== relax ===  ${relax.moved} points moved, largest push ${relax.maxMove.toFixed(1)}px` +
      (relax.stuck.length > 0
        ? `   NO CORRIDOR on connector(s) ${[...new Set(relax.stuck)].join(", ")}`
        : ""),
  );

  /* A connector relaxing could not clear is rerouted round the labels it runs through. */
  /** @param {Point} p */
  const floorAt = (p) => {
    const at = geometry.sections.findIndex(
      (/** @type {Band} */ x) => p.y >= x.top && p.y < x.top + x.height,
    );
    return floorFor(SECTION_ORDER[at] ?? null, FLOOR, FLOOR_FAMILY);
  };
  for (const k of new Set(relax.stuck)) {
    const c = relax.connectors[k];
    if (!c.points) continue;
    c.points = simplify(
      detourOffType(c.points, glyphs, floorAt),
      RELAX_SIMPLIFY,
    );
    console.log(
      `  connector ${k}: rerouted round the type relaxing could not clear`,
    );
  }
  report(relax.connectors.map((c) => c.points));
  const worst = typeClearanceReport(relax.connectors, geometry, glyphs);
  console.log(
    `\n=== type clearance (after relax) ===  ${glyphs.length} glyph rects`,
  );
  let crossed = false;
  worst.forEach((w, i) => {
    const sectionName = SECTION_ORDER[i];
    const floor = floorFor(sectionName, FLOOR, FLOOR_FAMILY);
    const nearest = w.min === Infinity ? "n/a" : `${w.min.toFixed(1)}px`;
    const label = `  ${sectionName.padEnd(13)} samples ${String(w.samples).padStart(5)}  nearest type ${nearest}`;
    if (w.crossings > 0) {
      crossed = true;
      console.log(
        `${label}   *** ${w.crossings} SAMPLES ON TYPE (${w.nearestText ?? "unknown"}) ***`,
      );
    } else if (w.min < floor) {
      /* Under the floor but not an actual crossing: an attachment point is PINNED, and relaxing
         cannot move it. Report it by name — the remedy is the motif's placement, the owner's call. */
      console.log(
        `${label}   WARNING: under the ${floor}px floor, nearest "${w.nearestText ?? "unknown"}"`,
      );
    } else {
      console.log(label);
    }
  });
  if (crossed) {
    console.error(
      "\nREFUSED: the drawn thread crosses type. The placement law is 'may cross anything, may never cross type' — nudge the drawing clear of it and re-import.",
    );
    return 1;
  }

  writeFileSync(`${dir}/joins.json`, `${JSON.stringify(joins, null, 2)}\n`);
  writeFileSync(
    `${dir}/connectors.json`,
    `${JSON.stringify(relax.connectors, null, 2)}\n`,
  );
  writeFileSync(
    `${dir}/attachments.json`,
    `${JSON.stringify(cut.attachments, null, 2)}\n`,
  );
  console.log(
    "\nOK: no crossing after relaxing. See any WARNING lines above for what is still under the floor.",
  );
  return 0;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  process.exitCode = await importDrawing(process.argv.slice(2));
}
