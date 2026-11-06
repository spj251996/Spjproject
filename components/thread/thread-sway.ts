/* THE SWAY (DESIGN.md -> Thread -> The sway). The owner finalised it on 2026-11-02; nothing switches it but
   reduced motion and the tests' sway-off seam. The twist (`thread-twist.ts`) reads each piece's unswayed path
   from here through `baseOf`.

   The line moves, as a thread in moving air. A smooth displacement FIELD over `<main>`'s
   coordinates moves every point of every path in the `<svg>` — ink, marks, fibres, crossings, head — so the
   layers stay on one another. The field is one for the page: the trunk's `<svg>` and the card thread's
   share its clock and phase, so the two move as one line at the Wishes join. Curves are flattened into
   short chords before they move, so the ink follows the field point for point exactly as the head's
   polylines do. Two pieces meeting at one point always move together, so no join opens and
   nothing is pinned at a join. It is pinned near every box of type and every portrait: a chord that
   comes within 1.1 x the amplitude of one does not move at all, so the sway cannot carry the line onto
   type it does not already touch. Only paths near the viewport move. */

/* ---------------------------------------------------------------------------------------------
   SWAY */

/* The owner's pick (2026-10-30, finalised 2026-11-02): a slow sway with gusts passing through it. */
type Sway = {
  amplitude: number;
  swayPeriod: number;
  gustEvery: number;
  gustShare: number;
};

/* The shipped sway: 8px, a 4s sway, a gust every 8s carrying half the motion (DESIGN.md -> Thread ->
   The sway). */
export const SHIPPED_SWAY: Sway = {
  amplitude: 8,
  swayPeriod: 4,
  gustEvery: 8,
  gustShare: 0.5,
};

/* The tests of the draw measure without the sway, which keeps a frame loop of its own
   and re-shapes every path: they set `data-thread-sway="off"` on `<html>` before the page's code runs.
   Nothing on the page sets it. */
export function swayIsOff(): boolean {
  return document.documentElement.dataset.threadSway === "off";
}

/* The most the sway moves any point, whether or not it is running now (reduced motion can be
   switched off later): a region read from an unswayed path must still hold the swayed one. */
export function swayAmplitude(): number {
  return swayIsOff() ? 0 : SHIPPED_SWAY.amplitude;
}

const TYPE_FADE = 24;
const VIEW_MARGIN = 240;
const CHORD = 2;
const NUMBER = /-?\d*\.?\d+(?:[eE][-+]?\d+)?/g;
const TAU = Math.PI * 2;

/* A gust travels the viewport's height in GUST_TRAVEL seconds. */
const GUST_TRAVEL = 3;
const GUST_WIDTH = 180;

/* Whether the page is awake: the sway moves only while it is, and stops once the page has gone idle
   (`PageThread` owns the lifecycle and calls `setSwayAwake`). Page-wide, like the clock,
   so the trunk and the card thread stop and start as one line. */
let swayAwake = true;
const swayWakers = new Set<() => void>();
export function setSwayAwake(awake: boolean) {
  /* The clock pauses while the sway sleeps, so it carries on from the shape it stopped at rather than jumping
     to wherever the time ran on to: up to the whole 8px at the end of every rest. */
  const page = clock();
  if (!awake && swayAwake) page.pausedAt = performance.now();
  if (awake && !swayAwake && page.pausedAt !== null) {
    page.paused += performance.now() - page.pausedAt;
    page.pausedAt = null;
  }
  swayAwake = awake;
  if (awake) for (const wake of swayWakers) wake();
}

/* One clock and one phase for the page, so every `<svg>` sways as one line. */
let pageClock: {
  start: number;
  phase: number;
  paused: number;
  pausedAt: number | null;
} | null = null;
function clock() {
  pageClock ??= {
    start: performance.now(),
    phase: Math.random() * TAU,
    paused: 0,
    pausedAt: null,
  };
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

/* A path in the thread's own form (absolute M, L, C, and the twist's Q) as a polyline: every curve
   flattened into chords of about CHORD px, so a displacement applied point by point bends the line
   exactly as it bends a 1px polyline laid on it. Exported for its test. */
export function flatten(d: string): string {
  const tokens = d.match(/[MLCQ]|-?\d*\.?\d+(?:[eE][-+]?\d+)?/g) ?? [];
  let out = "";
  let command = "";
  let x = 0;
  let y = 0;
  let i = 0;
  const num = () => Number(tokens[i++]);
  while (i < tokens.length) {
    const token = tokens[i];
    if (token === "M" || token === "L" || token === "C" || token === "Q") {
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
    /* The twist's gaps: a few pixels long and bowed under a pixel, so two chords through the curve's middle
       hold its shape, and the hundreds of gaps on screen add one point each, not several. */
    if (command === "Q") {
      const [x1, y1, x2, y2] = [num(), num(), num(), num()];
      const mx = 0.25 * x + 0.5 * x1 + 0.25 * x2;
      const my = 0.25 * y + 0.5 * y1 + 0.25 * y2;
      out += `L${mx.toFixed(2)} ${my.toFixed(2)}L${x2.toFixed(2)} ${y2.toFixed(2)}`;
      x = x2;
      y = y2;
      continue;
    }
    x = num();
    y = num();
    out += `${command === "M" ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
    if (command === "M") command = "L";
  }
  return out;
}

/* A flattened path's numbers back into its text, two decimals a coordinate. */
function joinPolyline(numbers: readonly number[], parts: readonly string[]) {
  let out = parts[0];
  for (let i = 0; i < numbers.length; i += 2)
    out += `${numbers[i].toFixed(2)}${parts[i + 1]}${numbers[i + 1].toFixed(2)}${parts[i + 2] ?? ""}`;
  return out;
}

/* The shape a stopped sway leaves on a path: its base, unless a painter wrote a newer path since the sway last wrote
   it, which the stop never saw because it disconnects the observer first; that newer path is the base, and stays. A
   path the painter emptied stays empty. Exported for its test. */
export function restoredShape(
  current: string | null,
  written: string,
  base: string,
): string | null {
  if (current === null) return null;
  return current !== written ? current : base;
}

/* The paths a batch of mutation records changed, each once, and whether its style changed: a painter's write arrives
   as two or three records, and shaping the path once per record repeated the work for nothing. Exported for its
   test. */
export function writesInBatch<T>(
  records: readonly { target: T; attributeName: string | null }[],
): Map<T, boolean> {
  const writes = new Map<T, boolean>();
  for (const { target, attributeName } of records)
    writes.set(
      target,
      (writes.get(target) ?? false) || attributeName === "style",
    );
  return writes;
}

/* The flattened path from its start to `fraction` of its length, ending on the point there: nothing past it
   is in the path. At 0 it is empty, and from 1 it is the whole path. The fraction is found along
   `measuredOn` — the same points before they moved, by default the path itself — and laid on `numbers`. */
export function cutPolyline(
  numbers: readonly number[],
  parts: readonly string[],
  fraction: number,
  measuredOn: readonly number[] = numbers,
): string {
  if (!(fraction > 0)) return "";
  if (fraction >= 1) return joinPolyline(numbers, parts);
  const along = measuredOn;
  let total = 0;
  for (let i = 2; i < along.length; i += 2)
    total += Math.hypot(along[i] - along[i - 2], along[i + 1] - along[i - 1]);
  const target = fraction * total;
  let out = parts[0];
  let walked = 0;
  for (let i = 0; i < numbers.length; i += 2) {
    let x = numbers[i];
    let y = numbers[i + 1];
    let last = i + 2 >= numbers.length;
    if (i > 0) {
      const step = Math.hypot(
        along[i] - along[i - 2],
        along[i + 1] - along[i - 1],
      );
      if (walked + step >= target) {
        const share = step > 0 ? (target - walked) / step : 1;
        x = numbers[i - 2] + (x - numbers[i - 2]) * share;
        y = numbers[i - 1] + (y - numbers[i - 1]) * share;
        last = true;
      } else walked += step;
    }
    out += `${x.toFixed(2)}${parts[i + 1]}${y.toFixed(2)}${last ? "" : parts[i + 2]}`;
    if (last) break;
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
  /* The moment its shape was last written at; null while it keeps the unswayed shape it was given. */
  at: number | null;
  /* The drawn fraction its shape was last written for; null until then. */
  progress: number | null;
};

function parse(
  d: string,
): Pick<Tracked, "parts" | "numbers" | "top" | "bottom"> {
  const numbers = (d.match(NUMBER) ?? []).map(Number);
  const parts = d.split(NUMBER);
  let top = Number.POSITIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;
  for (let i = 1; i < numbers.length; i += 2) {
    top = Math.min(top, numbers[i]);
    bottom = Math.max(bottom, numbers[i]);
  }
  return { parts, numbers, top, bottom };
}

/* A throw inside the frame loop must not stop the loop, nor flood the console at 60 a second: the first
   few are reported, the rest dropped. */
let reportedErrors = 0;
function recordError(where: string, error: unknown) {
  if (reportedErrors >= 5) return;
  reportedErrors += 1;
  console.error(`thread sway (${where})`, error);
}

function createSway(svg: SVGSVGElement, sway: Sway) {
  const tracked = new WeakMap<SVGPathElement, Tracked>();
  let obstacles: Rect[] = [];
  let mainTop = 0;
  let frame: number | null = null;
  const { phase } = clock();
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

  /* Every point of the flattened path moved by the field: the same list, the same order. */
  function displaced(entry: Tracked, t: number, band: View): number[] {
    entry.weights ??= weightsFor(entry);
    const { numbers, weights } = entry;
    const moved = numbers.slice();
    for (let i = 0; i < numbers.length; i += 2) {
      const w = weights[i / 2] * sway.amplitude;
      if (w > 0) {
        const [fx, fy] = field(
          sway,
          numbers[i],
          numbers[i + 1],
          t,
          phase,
          band,
        );
        moved[i] += w * fx;
        moved[i + 1] += w * fy;
      }
    }
    return moved;
  }

  function track(path: SVGPathElement): Tracked | undefined {
    const current = path.getAttribute("d") ?? "";
    let entry = tracked.get(path);
    if (entry === undefined || current !== entry.written) {
      /* A path a painter emptied is forgotten, or the frame would paint its old shape back. */
      if (current === "") {
        tracked.delete(path);
        return undefined;
      }
      entry = {
        base: current,
        written: current,
        weights: null,
        at: null,
        progress: null,
        ...parse(flatten(current)),
      };
      tracked.set(path, entry);
    }
    return entry;
  }

  /* THE PIECE BEING DRAWN IS CUT AT ITS TIP, NEVER DASHED, WHILE THE LINE SWAYS. On an iPhone a dashed
     piece whose `d` is rewritten every frame painted ink past its tip — "the stretch from motif to next
     motif all start drawing at same time" (the owner, 2026-11-01 and 2026-11-02). Two fixes to the dash
     did not cure it, and the engine's mechanism was never established, so no piece carries a dash at all
     while the sway runs and the defect has nothing to paint. The painter still writes its dash, in the
     piece's unswayed length; this reads the drawn fraction off it, then clears it: a piece not yet started
     is hidden, a finished one is whole, and the one between is its swayed path cut at that fraction. The
     fraction is the painter's own, so the sway, which lengthens a piece by a few pixels, cannot move the
     tip along it. */
  const progresses = new WeakMap<
    SVGPathElement,
    { progress: number; wroteArray: string; wroteOffset: string }
  >();
  function progressOf(path: SVGPathElement): number {
    if (path.dataset.threadPiece === undefined) return 1;
    const array = path.style.strokeDasharray;
    const offset = path.style.strokeDashoffset;
    let known = progresses.get(path);
    if (
      known === undefined ||
      array !== known.wroteArray ||
      offset !== known.wroteOffset
    ) {
      const period = Number.parseFloat(array);
      known = {
        progress:
          period > 0 ? 1 - (Number.parseFloat(offset) || 0) / period : 1,
        wroteArray: array,
        wroteOffset: offset,
      };
    }
    if (array !== "none") path.style.strokeDasharray = "none";
    if (offset !== "0" && offset !== "") path.style.strokeDashoffset = "0";
    known.wroteArray = path.style.strokeDasharray;
    known.wroteOffset = path.style.strokeDashoffset;
    progresses.set(path, known);
    return known.progress;
  }

  /* `always` false: a piece whose dash was rewritten but whose drawn fraction did not move keeps its shape. Every
     catch-up frame rewrites every piece's dash, and re-shaping each of them at a fresh moment, far off screen too,
     repainted the whole page-length line every frame while the page's images loaded; moving the line is the frame
     loop's job, within its range. */
  function write(
    path: SVGPathElement,
    entry: Tracked,
    t: number,
    band: View,
    always = true,
  ) {
    const progress = progressOf(path);
    const hidden = progress <= 0 ? "hidden" : "";
    if (path.style.visibility !== hidden) path.style.visibility = hidden;
    if (hidden !== "") return;
    if (!always && progress === entry.progress) return;
    const moved = displaced(entry, t, band);
    entry.at = t;
    entry.progress = progress;
    const next =
      progress >= 1
        ? joinPolyline(moved, entry.parts)
        : cutPolyline(moved, entry.parts, progress, entry.numbers);
    if (next !== entry.written) {
      entry.written = next;
      path.setAttribute("d", next);
    }
  }

  const seconds = () => {
    const page = clock();
    return (performance.now() - page.start - page.paused) / 1000;
  };
  /* The moment of the last frame the sway drew, and the window it drew against, which a gust travels: both held
     while the sway sleeps, so a scroll then carries no gust across the line. */
  let stoppedAt = 0;
  let stoppedBand: View | null = null;

  /* A painter that writes a new `d` mid-frame (the head, the moving tip) is displaced in the same
     frame: the observer runs at the end of that callback, before the frame paints. */
  const observer = new MutationObserver((records) => {
    try {
      /* While the sway is stopped, a piece rewritten (a redraw on resize, a new tip) keeps the moment
         the line stopped at: the twist, the head, the frayed ends and the crossings hold that moment too. */
      const t = swayAwake ? seconds() : stoppedAt;
      const band = swayAwake ? view() : (stoppedBand ?? view());
      for (const [target, styled] of writesInBatch(records)) {
        /* A painter that builds a group hidden and shows it whole — a crossing, a frayed end — records no change
           on the paths it added, so showing the group is what shapes them, as showing a path shapes that path. */
        if (target instanceof SVGGElement) {
          if (styled && target.style.display !== "none")
            for (const path of target.querySelectorAll("path")) {
              const entry = track(path);
              if (entry !== undefined) write(path, entry, t, band);
            }
          continue;
        }
        const path = target as SVGPathElement;
        /* A path the painter has just hidden paints nothing; the change that shows it again shapes it. */
        if (path.style.display === "none") continue;
        const entry = track(path);
        if (entry === undefined) continue;
        if (styled)
          write(path, entry, t, band, path.dataset.threadPiece === undefined);
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

  function wake() {
    frame ??= window.requestAnimationFrame(tick);
  }

  /* While the sway rests, the page can scroll onto paths last reshaped at an older moment, or never: each path is
     culled by its own box, so a long piece of ink stays in range while a twist mark on its far end freezes, and the
     mark showed apart from its ink (the owner's iPhone, 2026-11-03). Each such path is brought to the moment the line
     stopped at as it comes into range, so nothing on screen holds two moments; the paths already there cost nothing.
     Scheduled for the frame rather than run in the scroll event, which can arrive before the rest begins. */
  let catchingUp: number | null = null;
  function catchUp() {
    catchingUp = null;
    if (swayAwake || stoppedBand === null) return;
    try {
      const band = view();
      const top = band.top - VIEW_MARGIN;
      const bottom = band.top + band.height + VIEW_MARGIN;
      for (const path of svg.querySelectorAll("path")) {
        const entry = tracked.get(path) ?? track(path);
        if (entry === undefined || entry.at === stoppedAt) continue;
        if (entry.bottom < top || entry.top > bottom) continue;
        if (path.style.visibility === "hidden" || path.style.display === "none")
          continue;
        write(path, entry, stoppedAt, stoppedBand);
      }
    } catch (error) {
      recordError("catch-up", error);
    }
  }
  const onScroll = () => {
    catchingUp ??= window.requestAnimationFrame(catchUp);
  };

  function tick() {
    if (!swayAwake) {
      frame = null;
      return;
    }
    try {
      const t = seconds();
      stoppedAt = t;
      const band = view();
      stoppedBand = band;
      const top = band.top - VIEW_MARGIN;
      const bottom = band.top + band.height + VIEW_MARGIN;
      for (const path of svg.querySelectorAll("path")) {
        /* A known path is not re-read: reading back every path's `d` each frame was a measured share of the
           sway's cost, and a painter's rewrite reaches `tracked` through the observer before this runs. */
        const entry = tracked.get(path) ?? track(path);
        if (entry === undefined) continue;
        if (entry.bottom < top || entry.top > bottom) continue;
        /* A piece not yet started paints nothing, so it is never re-shaped. On an iPhone, re-shaping
           those hidden pieces every frame left their stale pixels on screen ahead of the tip — gone
           on a forced repaint and with the line layer hidden (the owner's device test). */
        if (path.style.visibility === "hidden") continue;
        /* A twist mark not yet reached, or a head step not in use, paints nothing either: the observer shapes it
           the moment it is shown. */
        if (path.style.display === "none") continue;
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
         loop restarts below, and the observer has to come back with it, or every head segment is
         painted unswayed beside a swaying line. Observing again is a no-op when already observing. */
      observe();
      for (const path of svg.querySelectorAll("path")) {
        const entry = tracked.get(path);
        if (entry !== undefined) entry.weights = null;
      }
      swayWakers.add(wake);
      window.addEventListener("scroll", onScroll, { passive: true });
      if (swayAwake) frame ??= window.requestAnimationFrame(tick);
    },
    /* Synchronous, so a caller that has just written a new `d` reads it as the base before the
       observer has run. */
    baseOf(path: SVGPathElement): string | undefined {
      return track(path)?.base;
    },
    /* Every piece goes back to its unswayed shape and shows, so whatever paints next — the draw, or reduced
       motion's complete line — starts from the geometry, not from a swayed or cut copy of it. */
    stop() {
      if (frame !== null) window.cancelAnimationFrame(frame);
      frame = null;
      if (catchingUp !== null) window.cancelAnimationFrame(catchingUp);
      catchingUp = null;
      window.removeEventListener("scroll", onScroll);
      swayWakers.delete(wake);
      observer.disconnect();
      for (const path of svg.querySelectorAll("path")) {
        const entry = tracked.get(path);
        if (entry === undefined) continue;
        const current = path.getAttribute("d");
        const shape = restoredShape(current, entry.written, entry.base);
        if (shape !== null && current !== shape) path.setAttribute("d", shape);
        if (path.style.visibility === "hidden") path.style.visibility = "";
        tracked.delete(path);
      }
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
    if (node.parentElement?.closest("style, script")) continue;
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
   ONE ENTRY POINT PER `<svg>` */

export function createThreadSway(svg: SVGSVGElement, reduced: boolean) {
  const sway =
    reduced || swayIsOff() ? undefined : createSway(svg, SHIPPED_SWAY);

  return {
    /* Whether this sway was built for reduced motion, so a change of preference builds the other kind. */
    reduced,
    /* A piece's unswayed `d`: its geometry, which every painter that measures along it must read. */
    baseOf(path: SVGPathElement): string {
      return sway?.baseOf(path) ?? path.getAttribute("d") ?? "";
    },
    measured(main: Element) {
      if (sway === undefined) return;
      const mainRect = main.getBoundingClientRect();
      sway.measured(
        obstacleBoxes(main, mainRect),
        mainRect.top + window.scrollY,
      );
    },
    stop() {
      sway?.stop();
    },
  };
}

export type ThreadSway = ReturnType<typeof createThreadSway>;
