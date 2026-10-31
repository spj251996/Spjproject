/* TEMPORARY SPIKES — candidates for the thread's twist and sway, switched by the review panel
   (`thread-variant.ts`). Nothing here does anything unless the panel's axis is set, and the whole file
   leaves with the panel, or is replaced by a real build if a candidate is picked.

   TWIST: a pattern along the ink so the line reads as fibre rather than ink. Two families:
   - TICKS, the owner's pick (b) of three mechanisms spiked (2026-10-26): one lighter dashed copy of
     each piece, whose dash list only ever changes for the piece being drawn;
   - ROPE and BRAID, drawn marks across the line (a slant all one way; a chevron), as a braided cord is
     drawn. They are geometry, so they reveal in short chunks once the ink has passed each chunk's end.

   SWAY: the line moves, as a thread in moving air. A smooth displacement FIELD over `<main>`'s
   coordinates moves every point of every path in the `<svg>` — ink, marks, taper, re-trace — so the
   layers stay on one another. The field is one for the page: the trunk's `<svg>` and the card thread's
   share its clock and phase, so the two move as one line at the Wishes join. Curves are flattened into
   short chords before they move, so the ink follows the field point for point exactly as the re-trace
   (a 1px polyline) does. Two pieces meeting at one point always move together, so no join opens and
   nothing is pinned at a join. It is pinned near every box of type and every portrait: a chord that
   comes within 1.1 x the amplitude of one does not move at all, so the sway cannot carry the line onto
   type it does not already touch. Only paths near the viewport move. */

import type { ThreadPiece } from "./thread-line.ts";
import { pieceProgress } from "./thread-progress.ts";
import { type PieceSamples, samplePath } from "./thread-samples.ts";
import { readVariant } from "./thread-variant.ts";

const SVG_NS = "http://www.w3.org/2000/svg";

/* ---------------------------------------------------------------------------------------------
   SWAY */

/* The owner's pick (2026-10-30): a slow sway with gusts passing through it. Each candidate varies
   one thing from the 8px baseline — the sway's period, how often a gust comes, how much of the motion
   is gust, or the size. */
type Sway = {
  amplitude: number;
  swayPeriod: number;
  gustEvery: number;
  gustShare: number;
};

/* The panel's sway option ids carry their own values: `sg-<px>-p<sway s>-e<gust every s>-g<gust %>`. */
export function parseSway(id: string | undefined): Sway | undefined {
  const match = id?.match(
    /^sg-(\d+(?:\.\d+)?)-p(\d+(?:\.\d+)?)-e(\d+(?:\.\d+)?)-g(\d+)$/,
  );
  if (match === null || match === undefined) return undefined;
  return {
    amplitude: Number(match[1]),
    swayPeriod: Number(match[2]),
    gustEvery: Number(match[3]),
    gustShare: Number(match[4]) / 100,
  };
}

const TYPE_FADE = 24;
const VIEW_MARGIN = 240;
const CHORD = 2;
const NUMBER = /-?\d*\.?\d+(?:[eE][-+]?\d+)?/g;
const TAU = Math.PI * 2;

/* A gust travels the viewport's height in GUST_TRAVEL seconds. */
const GUST_TRAVEL = 3;
const GUST_WIDTH = 180;

/* One clock and one phase for the page, so every `<svg>` sways as one line. */
let pageClock: { start: number; phase: number } | null = null;
function clock() {
  pageClock ??= { start: performance.now(), phase: Math.random() * TAU };
  return pageClock;
}

type Rect = { left: number; top: number; right: number; bottom: number };

function smoothstep(edge: number, value: number): number {
  const t = Math.min(1, Math.max(0, value / edge));
  return t * t * (3 - 2 * t);
}

function distanceToRect(x: number, y: number, r: Rect): number {
  const dx = Math.max(r.left - x, 0, x - r.right);
  const dy = Math.max(r.top - y, 0, y - r.bottom);
  return Math.hypot(dx, dy);
}

type View = { top: number; height: number };

/* The sway and the gust are each bounded by 1 in x and 0.3 in y, and mixed by `gustShare`, so
   `amplitude` is the most any point ever moves. `t` is seconds; `view` is the viewport's band in
   `<main>`'s coordinates, which a gust travels down. */
function field(
  sway: Sway,
  x: number,
  y: number,
  t: number,
  phase: number,
  view: View,
): [number, number] {
  const w = TAU / sway.swayPeriod;
  let fx =
    (1 - sway.gustShare) *
    (0.6 * Math.sin((TAU * y) / 520 + w * t + phase) +
      0.4 * Math.sin((TAU * y) / 830 - 0.77 * w * t + 2 * phase));
  let fy = (1 - sway.gustShare) * 0.3 * Math.sin((TAU * x) / 700 + 0.6 * w * t);
  const into = t % sway.gustEvery;
  if (into < GUST_TRAVEL) {
    const centre = view.top - 200 + (into / GUST_TRAVEL) * (view.height + 400);
    const envelope = Math.exp(-(((y - centre) / GUST_WIDTH) ** 2));
    fx +=
      sway.gustShare *
      envelope *
      Math.sin((TAU * y) / 160 - (TAU * t) / 0.9 + phase);
    fy +=
      sway.gustShare *
      0.3 *
      envelope *
      Math.sin((TAU * x) / 240 - (TAU * t) / 1.1);
  }
  return [fx, fy];
}

/* A path in the thread's own form (absolute M, L, C) as a polyline: every cubic flattened into chords
   of about CHORD px, so a displacement applied point by point bends the line exactly as it bends a
   1px polyline laid on it. Exported for its test. */
export function flatten(d: string): string {
  const tokens = d.match(/[MLC]|-?\d*\.?\d+(?:[eE][-+]?\d+)?/g) ?? [];
  let out = "";
  let command = "";
  let x = 0;
  let y = 0;
  let i = 0;
  const num = () => Number(tokens[i++]);
  while (i < tokens.length) {
    const token = tokens[i];
    if (token === "M" || token === "L" || token === "C") {
      command = token;
      i += 1;
      continue;
    }
    if (command === "C") {
      const [x1, y1, x2, y2, x3, y3] = [
        num(),
        num(),
        num(),
        num(),
        num(),
        num(),
      ];
      const net =
        Math.hypot(x1 - x, y1 - y) +
        Math.hypot(x2 - x1, y2 - y1) +
        Math.hypot(x3 - x2, y3 - y2);
      const steps = Math.max(2, Math.min(256, Math.ceil(net / CHORD)));
      for (let k = 1; k <= steps; k += 1) {
        const t = k / steps;
        const u = 1 - t;
        const px =
          u * u * u * x +
          3 * u * u * t * x1 +
          3 * u * t * t * x2 +
          t * t * t * x3;
        const py =
          u * u * u * y +
          3 * u * u * t * y1 +
          3 * u * t * t * y2 +
          t * t * t * y3;
        out += `L${px.toFixed(2)} ${py.toFixed(2)}`;
      }
      x = x3;
      y = y3;
      continue;
    }
    x = num();
    y = num();
    out += `${command === "M" ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
    if (command === "M") command = "L";
  }
  return out;
}

type Tracked = {
  base: string;
  written: string;
  parts: string[];
  numbers: number[];
  weights: Float32Array | null;
  top: number;
  bottom: number;
  /* The flattened path's length unswayed, and as last written. */
  length0: number;
  length: number;
};

function parse(
  d: string,
): Pick<
  Tracked,
  "parts" | "numbers" | "top" | "bottom" | "length0" | "length"
> {
  const numbers = (d.match(NUMBER) ?? []).map(Number);
  const parts = d.split(NUMBER);
  let top = Number.POSITIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;
  for (let i = 1; i < numbers.length; i += 2) {
    top = Math.min(top, numbers[i]);
    bottom = Math.max(bottom, numbers[i]);
  }
  let length0 = 0;
  for (let i = 2; i < numbers.length; i += 2) {
    length0 += Math.hypot(
      numbers[i] - numbers[i - 2],
      numbers[i + 1] - numbers[i - 1],
    );
  }
  return { parts, numbers, top, bottom, length0, length: length0 };
}

/* DIAGNOSTICS for a device this repo cannot run (an iPhone): the review panel prints these, so a
   screenshot says whether the sway's loop runs there and what it threw. */
export const swayDiagnostics = { ticks: 0, errors: [] as string[] };
function recordError(where: string, error: unknown) {
  if (swayDiagnostics.errors.length < 5)
    swayDiagnostics.errors.push(`${where}: ${String(error)}`);
}

function createSway(svg: SVGSVGElement, sway: Sway) {
  const tracked = new WeakMap<SVGPathElement, Tracked>();
  let obstacles: Rect[] = [];
  let mainTop = 0;
  let frame: number | null = null;
  const { start, phase } = clock();
  const reach = sway.amplitude * 1.1;

  function nearest(x: number, y: number): number {
    let near = Number.POSITIVE_INFINITY;
    for (const r of obstacles) {
      if (r.top - y > near || y - r.bottom > near) continue;
      near = Math.min(near, distanceToRect(x, y, r));
    }
    return near;
  }

  /* WEIGHTED PER CHORD, by its closest approach sampled along it; a point shared by two chords takes
     the smaller. A point-by-point weight let a cubic's far-off control points move and bend the curve
     onto a glyph (measured: "Mother" at 1536px wide, 0.58px clear, crossed at 8px); flattening removed
     the control points, and the chord weight keeps the guarantee for the straight run between two
     points: a chord within reach of type does not move, and every point of any other chord moves less
     than its distance to the type. */
  function weightsFor(entry: Tracked): Float32Array {
    const { numbers } = entry;
    const count = numbers.length / 2;
    const weights = new Float32Array(count).fill(1);
    const weightAt = (near: number) =>
      near <= reach ? 0 : smoothstep(TYPE_FADE, near - reach);
    if (count === 1) weights[0] = weightAt(nearest(numbers[0], numbers[1]));
    for (let i = 1; i < count; i += 1) {
      const ax = numbers[2 * i - 2];
      const ay = numbers[2 * i - 1];
      const bx = numbers[2 * i];
      const by = numbers[2 * i + 1];
      let near = Number.POSITIVE_INFINITY;
      for (let k = 0; k <= 4; k += 1) {
        const t = k / 4;
        near = Math.min(near, nearest(ax + (bx - ax) * t, ay + (by - ay) * t));
      }
      const weight = weightAt(near);
      weights[i - 1] = Math.min(weights[i - 1], weight);
      weights[i] = Math.min(weights[i], weight);
    }
    return weights;
  }

  function view(): View {
    return { top: window.scrollY - mainTop, height: window.innerHeight };
  }

  function displaced(entry: Tracked, t: number, band: View) {
    entry.weights ??= weightsFor(entry);
    const { numbers, parts, weights } = entry;
    let out = parts[0];
    let length = 0;
    let px = 0;
    let py = 0;
    for (let i = 0; i < numbers.length; i += 2) {
      const w = weights[i / 2] * sway.amplitude;
      let x = numbers[i];
      let y = numbers[i + 1];
      if (w > 0) {
        const [fx, fy] = field(sway, x, y, t, phase, band);
        x += w * fx;
        y += w * fy;
      }
      if (i > 0) length += Math.hypot(x - px, y - py);
      px = x;
      py = y;
      out += `${x.toFixed(2)}${parts[i + 1]}${y.toFixed(2)}${parts[i + 2] ?? ""}`;
    }
    entry.length = length;
    return out;
  }

  function track(path: SVGPathElement): Tracked | undefined {
    const current = path.getAttribute("d") ?? "";
    let entry = tracked.get(path);
    if (entry === undefined || current !== entry.written) {
      if (current === "") return undefined;
      entry = {
        base: current,
        written: current,
        weights: null,
        ...parse(flatten(current)),
      };
      tracked.set(path, entry);
    }
    return entry;
  }

  function write(path: SVGPathElement, entry: Tracked, t: number, band: View) {
    const next = displaced(entry, t, band);
    if (next !== entry.written) {
      entry.written = next;
      path.setAttribute("d", next);
    }
    rescaleDash(path, entry);
  }

  /* THE INK'S DASH FOLLOWS THE SWAY. The painter writes each piece's dash in its unswayed length, and
     a swaying piece is longer (by 2-3.4px measured at 8-12px), so a finished piece stopped short of
     its end and every join showed a gap. `pathLength` would rescale it for free, but WebKit then drew
     pieces ahead of the tip, several at once (bug 258897, seen on an iPhone). So the dash the painter
     wrote is kept as the base and scaled by the piece's own swayed-to-unswayed length: the drawn
     fraction is unchanged and a finished piece reaches its end. */
  const dashes = new WeakMap<
    SVGPathElement,
    { array: number; offset: number; wroteArray: string; wroteOffset: string }
  >();
  function rescaleDash(path: SVGPathElement, entry: Tracked) {
    if (path.dataset.threadPiece === undefined) return;
    const currentArray = path.style.strokeDasharray;
    const currentOffset = path.style.strokeDashoffset;
    if (currentArray === "") return;
    let dash = dashes.get(path);
    if (
      dash === undefined ||
      currentArray !== dash.wroteArray ||
      currentOffset !== dash.wroteOffset
    ) {
      dash = {
        array: Number.parseFloat(currentArray),
        offset: Number.parseFloat(currentOffset) || 0,
        wroteArray: currentArray,
        wroteOffset: currentOffset,
      };
      dashes.set(path, dash);
    }
    /* ONLY THE PIECE BEING DRAWN DEPENDS ON ITS DASH. On an iPhone (WebKit), with the sway rewriting
       each piece's `d` every frame, pieces the dash should have hidden were drawn ahead of the tip;
       shipped, twist alone and width alone were clean (the owner's isolation on the device). The
       engine's mechanism is not established — no WebKit here — so the fix does not depend on it: a
       piece not yet started is hidden outright, a finished one carries no dash at all, and only
       the one mid-draw piece is masked, with its dash scaled to its swayed length. */
    const progress = dash.array > 0 ? 1 - dash.offset / dash.array : 1;
    const hidden = progress <= 0 ? "hidden" : "";
    if (path.style.visibility !== hidden) {
      path.style.visibility = hidden;
      /* The tick skips a hidden piece, so one starting now still carries a stale shape: sway it
         before this frame paints, or its first ink misses the swayed end of the piece before. */
      if (hidden === "") write(path, entry, seconds(), view());
    }
    const k = entry.length0 > 0 ? entry.length / entry.length0 : 1;
    const array = progress >= 1 ? "none" : String(dash.array * k);
    const offset = progress >= 1 ? "0" : String(dash.offset * k);
    if (path.style.strokeDasharray !== array)
      path.style.strokeDasharray = array;
    if (path.style.strokeDashoffset !== offset)
      path.style.strokeDashoffset = offset;
    dash.wroteArray = path.style.strokeDasharray;
    dash.wroteOffset = path.style.strokeDashoffset;
  }

  const seconds = () => (performance.now() - start) / 1000;

  /* A painter that writes a new `d` mid-frame (the re-trace, the taper) is displaced in the same
     frame: the observer runs at the end of that callback, before the frame paints. */
  const observer = new MutationObserver((records) => {
    try {
      const t = seconds();
      const band = view();
      for (const record of records) {
        const path = record.target as SVGPathElement;
        const entry = track(path);
        if (entry === undefined) continue;
        if (record.attributeName === "style") rescaleDash(path, entry);
        else if (entry.written === entry.base) write(path, entry, t, band);
      }
    } catch (error) {
      recordError("observer", error);
    }
  });
  const observe = () =>
    observer.observe(svg, {
      subtree: true,
      attributes: true,
      attributeFilter: ["d", "style"],
    });
  observe();

  function tick() {
    swayDiagnostics.ticks += 1;
    try {
      const t = seconds();
      const band = view();
      const top = band.top - VIEW_MARGIN;
      const bottom = band.top + band.height + VIEW_MARGIN;
      for (const path of svg.querySelectorAll("path")) {
        const entry = track(path);
        if (entry === undefined) continue;
        if (entry.bottom < top || entry.top > bottom) continue;
        /* A piece not yet started paints nothing, so it is never re-shaped. On an iPhone, re-shaping
           those hidden pieces every frame left their stale pixels on screen ahead of the tip — gone
           on a forced repaint and with the line layer hidden (the owner's device test). */
        if (path.style.visibility === "hidden") continue;
        write(path, entry, t, band);
      }
    } catch (error) {
      recordError("tick", error);
    }
    frame = window.requestAnimationFrame(tick);
  }

  return {
    measured(nextObstacles: Rect[], top: number) {
      obstacles = nextObstacles;
      mainTop = top;
      /* React's development mode runs every effect's cleanup once on mount, which calls `stop`; the
         loop restarts below, and the observer has to come back with it, or every re-trace segment is
         painted unswayed beside a swaying line. Observing again is a no-op when already observing. */
      observe();
      for (const path of svg.querySelectorAll("path")) {
        const entry = tracked.get(path);
        if (entry !== undefined) entry.weights = null;
      }
      frame ??= window.requestAnimationFrame(tick);
    },
    /* Synchronous, so a caller that has just written a new `d` reads it as the base before the
       observer has run. */
    baseOf(path: SVGPathElement): string | undefined {
      return track(path)?.base;
    },
    stop() {
      if (frame !== null) window.cancelAnimationFrame(frame);
      frame = null;
      observer.disconnect();
    },
  };
}

/* Every box of type in `<main>`, and every portrait, in `<main>`'s coordinates: each text run's line
   boxes, each drawn mark (the names, the ornaments) that is not the thread, and each portrait photo. */
function obstacleBoxes(main: Element, mainRect: DOMRect): Rect[] {
  const boxes: Rect[] = [];
  const add = (r: DOMRect) => {
    if (r.width === 0 || r.height === 0) return;
    boxes.push({
      left: r.left - mainRect.left,
      top: r.top - mainRect.top,
      right: r.right - mainRect.left,
      bottom: r.bottom - mainRect.top,
    });
  };
  const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    if (!node.textContent?.trim()) continue;
    if (node.parentElement?.closest("[data-thread-review], style, script"))
      continue;
    range.selectNodeContents(node);
    for (const r of range.getClientRects()) add(r);
  }
  for (const mark of main.querySelectorAll("svg:not([data-thread-svg])")) {
    if (mark.closest("[data-thread-svg]")) continue;
    add(mark.getBoundingClientRect());
  }
  for (const photo of main.querySelectorAll("[data-relationship] img")) {
    add(photo.getBoundingClientRect());
  }
  return boxes;
}

/* ---------------------------------------------------------------------------------------------
   TWIST */

/* A rope's look, measured off the owner's reference (2026-10-30) and varied from it: the strand
   pitch as a multiple of the cord's width, the gap as a share of the pitch, the gap's slant to the
   line, how far each gap bows, and how much lighter than the ink the gap is (OKLCH lightness). */
type RopeShape = {
  pitch: number;
  gap: number;
  slant: number;
  bow: number;
  lighter: number;
};
type Twist =
  | { kind: "ticks"; spacing: number }
  | { kind: "rope"; shape: RopeShape };

const TWIST_TICK = 1.5;
const TWIST_LIGHTER = 0.18;
const MARK_CHUNK = 12;
/* At the reference's own ratios a gap on a 1.6px line is below a pixel, so it painted almost nothing.
   A shape keeps its measured pitch and slant; only the gap's width is held at least this, about two
   device pixels on a phone. */
const GAP_FLOOR = 0.6;

/* The long lay the owner liked best, as measured, and one change from it per candidate. */
const LONG_LAY: RopeShape = {
  pitch: 1.94,
  gap: 0.2,
  slant: 28,
  bow: 0.18,
  lighter: 0.18,
};
export const ROPES: Readonly<Record<string, RopeShape>> = {
  "long-ref": LONG_LAY,
  "long-tight": { ...LONG_LAY, pitch: 1.5, slant: 34 },
  "long-loose": { ...LONG_LAY, pitch: 2.5, slant: 22 },
  "long-gaps": { ...LONG_LAY, gap: 0.32 },
  "long-soft": { ...LONG_LAY, lighter: 0.1 },
  "long-bright": { ...LONG_LAY, lighter: 0.26 },
  "long-round": { ...LONG_LAY, bow: 0.4 },
};

/* The panel's twist option ids: `s4.5-clear` for ticks, or a key of ROPES. */
export function parseTwist(id: string | undefined): Twist | undefined {
  const ticks = id?.match(/^s(\d+(?:\.\d+)?)-clear$/);
  if (ticks) return { kind: "ticks", spacing: Number(ticks[1]) };
  const shape = id === undefined ? undefined : ROPES[id];
  return shape === undefined ? undefined : { kind: "rope", shape };
}

/* A point, and the unit tangent there, at `s` px along a piece's samples. */
function frameAt({ xy, length }: PieceSamples, s: number) {
  const i = Math.max(0, Math.min(Math.floor(s), Math.floor(length) - 1));
  const x = xy[2 * i];
  const y = xy[2 * i + 1];
  const dx = xy[2 * i + 2] - x;
  const dy = xy[2 * i + 3] - y;
  const run = Math.hypot(dx, dy) || 1;
  return { x, y, tx: dx / run, ty: dy / run };
}

/* One gap between two strands, centred at `s`, from `fromAcross` to `toAcross` (offsets across the
   line, -half..half), leaning `lean` px along the line over that span. Bowed a little, as the
   reference's gaps are: a strand's end is rounded, so the gap between two is a shallow crescent. */
function gapAt(
  samples: PieceSamples,
  s: number,
  half: number,
  lean: number,
  bow: number,
) {
  const { x, y, tx, ty } = frameAt(samples, s);
  const nx = -ty;
  const ny = tx;
  const p = (along: number, across: number) =>
    `${(x + tx * along + nx * across).toFixed(2)} ${(y + ty * along + ny * across).toFixed(2)}`;
  return `M${p(-lean / 2, -half)}Q${p(bow * half * 2, 0)} ${p(lean / 2, half)}`;
}

/* Every gap of one rope shape whose centre lies in [from, to). */
function ropeGaps(
  shape: RopeShape,
  samples: PieceSamples,
  from: number,
  to: number,
  length: number,
  half: number,
) {
  const pitch = shape.pitch * half * 2;
  const lean = (half * 2) / Math.tan((shape.slant * Math.PI) / 180);
  let d = "";
  for (let at = Math.ceil(from / pitch) * pitch; at < to; at += pitch) {
    if (at < half * 2 || at > length - half * 2) continue;
    d += gapAt(samples, at, half, lean, shape.bow);
  }
  return d;
}

/* How wide a gap's stroke is, ACROSS the gap: its share of the pitch, measured along the line,
   projected onto the gap's own normal. */
function gapWidth(shape: RopeShape, half: number) {
  const along = shape.gap * shape.pitch * half * 2;
  return Math.max(GAP_FLOOR, along * Math.sin((shape.slant * Math.PI) / 180));
}

function createTwist(
  svg: SVGSVGElement,
  before: Element | null,
  twist: Twist,
  cutId: string,
  taperPiece: (count: number) => number,
) {
  const layer = document.createElementNS(SVG_NS, "g");
  layer.dataset.threadTwist = twist.kind;
  svg.insertBefore(layer, before);
  const lighter = twist.kind === "rope" ? twist.shape.lighter : TWIST_LIGHTER;
  const stroke = `oklch(from var(--color-thread-red) calc(l + ${lighter}) c h)`;
  const pattern =
    twist.kind === "ticks" ? `${TWIST_TICK} ${twist.spacing - TWIST_TICK}` : "";
  let pieces: readonly ThreadPiece[] = [];
  let copies: SVGPathElement[] = [];
  let chunks: { element: SVGPathElement; end: number }[][] = [];

  return {
    measured(
      inks: readonly (SVGPathElement | null)[],
      next: readonly ThreadPiece[],
      baseOf: (p: SVGPathElement) => string,
    ) {
      layer.replaceChildren();
      pieces = next;
      copies = [];
      chunks = [];
      const width = Number.parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue(
          "--stroke-thread",
        ),
      );
      const half = (Number.isFinite(width) ? width : 1.6) / 2;
      next.forEach((piece, index) => {
        const ink = inks[index];
        if (ink === null || ink === undefined) return;
        const length = piece.end - piece.start;
        /* A tapered end is cut by the taper's mask, as its ink is; full-width marks there would
           stand wider than the line they sit on. */
        const holder = document.createElementNS(SVG_NS, "g");
        if (index === taperPiece(next.length))
          holder.setAttribute("mask", `url(#${cutId})`);
        layer.append(holder);
        if (twist.kind === "ticks") {
          const copy = document.createElementNS(SVG_NS, "path");
          copy.setAttribute("fill", "none");
          copy.setAttribute("stroke-linecap", "butt");
          copy.style.stroke = stroke;
          copy.style.strokeWidth = "var(--stroke-thread)";
          copy.setAttribute("d", baseOf(ink));
          copy.style.display = "none";
          holder.append(copy);
          copies[index] = copy;
          return;
        }
        const samples = samplePath(baseOf(ink), length);
        const own: { element: SVGPathElement; end: number }[] = [];
        for (let from = 0; from < length; from += MARK_CHUNK) {
          const end = Math.min(length, from + MARK_CHUNK);
          const d = ropeGaps(twist.shape, samples, from, end, length, half);
          if (d === "") continue;
          const element = document.createElementNS(SVG_NS, "path");
          element.setAttribute("fill", "none");
          element.setAttribute("stroke-linecap", "butt");
          element.style.stroke = stroke;
          element.style.strokeWidth = `${gapWidth(twist.shape, half).toFixed(2)}px`;
          element.setAttribute("d", d);
          element.style.display = "none";
          holder.append(element);
          own.push({ element, end });
        }
        chunks[index] = own;
      });
    },
    painted(drawn: number) {
      pieces.forEach((piece, index) => {
        const length = piece.end - piece.start;
        const reached = Math.min(length, pieceProgress(drawn, piece) * length);
        if (twist.kind !== "ticks") {
          for (const chunk of chunks[index] ?? []) {
            const value = reached >= chunk.end - 0.01 ? "" : "none";
            if (chunk.element.style.display !== value)
              chunk.element.style.display = value;
          }
          return;
        }
        const copy = copies[index];
        if (copy === undefined || twist.kind !== "ticks") return;
        const whole = Math.floor((reached - TWIST_TICK) / twist.spacing) + 1;
        if (reached <= 0 || whole <= 0) {
          if (copy.style.display !== "none") copy.style.display = "none";
          return;
        }
        if (copy.style.display !== "") copy.style.display = "";
        const dashes =
          reached >= length
            ? pattern
            : `${`${pattern} `.repeat(whole)}0 ${length * 2}`;
        if (copy.style.strokeDasharray !== dashes)
          copy.style.strokeDasharray = dashes;
      });
    },
  };
}

/* ---------------------------------------------------------------------------------------------
   ONE ENTRY POINT PER `<svg>` */

export function createThreadSpikes(
  svg: SVGSVGElement,
  before: Element | null,
  cutId: string,
  taperPiece: (count: number) => number,
  reduced: boolean,
) {
  const twistValues = parseTwist(readVariant("twist"));
  const twist =
    twistValues === undefined
      ? undefined
      : createTwist(svg, before, twistValues, cutId, taperPiece);
  const swayValues = reduced ? undefined : parseSway(readVariant("sway"));
  const sway =
    swayValues === undefined ? undefined : createSway(svg, swayValues);
  const baseOf = (path: SVGPathElement) =>
    sway?.baseOf(path) ?? path.getAttribute("d") ?? "";

  return {
    baseOf,
    measured(
      inks: readonly (SVGPathElement | null)[],
      pieces: readonly ThreadPiece[],
      main: Element,
    ) {
      if (sway !== undefined) {
        /* NO `pathLength`. The ink's dash is in its unswayed length, and a swaying piece is a hair
           longer, so pinning `pathLength` to the unswayed length looked right — but WebKit (Safari,
           and every iOS browser) then drew pieces ahead of the tip, several at once (WebKit bug
           258897, seen on an iPhone). The sway lengthens a piece by far less than a pixel; the round
           cap covers the difference. */
        const mainRect = main.getBoundingClientRect();
        sway.measured(
          obstacleBoxes(main, mainRect),
          mainRect.top + window.scrollY,
        );
      }
      twist?.measured(inks, pieces, baseOf);
    },
    painted(drawn: number) {
      twist?.painted(drawn);
    },
    stop() {
      sway?.stop();
    },
  };
}

export type ThreadSpikes = ReturnType<typeof createThreadSpikes>;
