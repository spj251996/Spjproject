/* THE THREAD'S DRAWING HEAD — the arithmetic, with no DOM and no React.

   `thread-line.ts` answers WHERE the thread is; this module answers HOW ITS LEADING END IS LIT. The
   component that owns the SVG turns these numbers into elements (`page-thread.tsx`); the one thing
   here that touches geometry, `samplePath`, reads a piece's own path data and asks the browser for
   nothing.

   WHY A STACK OF STEPS. A dash follows a curve because it is geometry; an SVG gradient lives in
   user space and does not, so a gradient laid along a bend puts its colour in the wrong place. A
   chord-aligned gradient was rendered and rejected on measurement (DESIGN.md → Thread → The drawing
   head). The head is instead N abutting opaque butt-capped runs of the piece, each one flat colour,
   the colour stepped along the arc — with N chosen so no two neighbours differ by more than the eye
   can see.

   THE HEAD BELONGS TO THE THREAD, NOT TO A PIECE. It is the last `length` of drawn line up to the
   tip, so with the tip 10px into a piece its tail lies in the piece before. A head computed per
   piece would shrink to a stub at every boundary and regrow, so this takes the whole chain of
   pieces and returns the runs each one carries. The trunk and Wishes' weave, which are separate
   `<svg>`s, call it with the same pieces and the same drawn length and each draws the runs in its
   own — which is what lets the head cross the join between them unbroken. */

import { dashForPiece, pieceProgress } from "./thread-line.ts";

export type Rgb = readonly [number, number, number];

/* The head is 96px at the 1.6px stroke: a ratio rather than a length, so it follows the stroke. The
   owner chose it on live renders (DESIGN.md → Thread → The drawing head). */
export const HEAD_LENGTH_RATIO = 60;

/* A step is held to about this much colour change (OKLab distance x100) — the value at which the
   spike found steps invisible — and to at most this many px, whichever needs more steps. A fixed
   step count bands as soon as the tip is brighter, because a longer colour span spreads over the
   same number of steps. */
const MAX_STEP_DELTA_E = 2;
const MAX_STEP_LENGTH = 8;
const MAX_STEPS = 48;

/* Each step is run this far under the one behind it. Abutting butt ends antialias into a hairline
   through which the dark ink beneath shows; a pale tip makes that hairline a visible tick. Exported
   because the component also needs it: where the head crosses into a piece that lives in another
   `<svg>`, the run on the near side has to carry the same overlap past its own path's end. */
export const HEAD_STEP_OVERLAP = 1;

/* The head's leading edge lies this far beyond the ink's own round cap. The two edges would otherwise
   coincide to the subpixel, and where they share a pixel the antialiasing composes into a dark
   sliver at the tip (8 pixels of it at 16x on a real render; none with this margin). */
export const HEAD_TIP_MARGIN = 0.25;

/* A tip within half the ink's width of a piece's end is covered by a short round-capped overrun of
   this length (see `headSegments`). */
const END_COVER_LENGTH = 1.5;

/* Below this, a piece has drawn nothing worth a head. Chromium also drops a dash this short. */
const NEGLIGIBLE = 0.01;

/* Paint order is a rank, not the order elements happen to be created in: a tight loop crosses
   itself, and the tip's step has to lie over the tail steps that pass beneath it. Later pieces lie
   over earlier ones, and within a piece the tip end lies over the tail; the round-capped cover lies
   over every step of its piece. Step counts stay far below `STEP_RANK_CEILING`. */
const PIECE_RANK = 1000;
const STEP_RANK_CEILING = 500;
const COVER_RANK = 900;

/* ---------------------------------------------------------------------------------------------
   COLOUR — an OKLCH ramp, evenly spaced in OKLab distance, so the eye meets equal steps of change
   rather than equal steps of numbers. Every stop the owner chose sits on or inside the sRGB gamut;
   the colours BETWEEN two stops need not, so each is chroma-reduced until it fits. */

interface Oklch {
  readonly l: number;
  readonly c: number;
  readonly h: number;
}

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

function linearFromOklch({ l, c, h }: Oklch): [number, number, number] {
  const a = c * Math.cos(toRadians(h));
  const b = c * Math.sin(toRadians(h));
  const l3 = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m3 = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s3 = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3,
    -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3,
    -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3,
  ];
}

const inGamut = (linear: readonly number[]) =>
  linear.every((value) => value >= -0.0005 && value <= 1.0005);

function encode(linear: number): number {
  const clamped = Math.max(0, Math.min(1, linear));
  const gamma =
    clamped <= 0.0031308
      ? 12.92 * clamped
      : 1.055 * clamped ** (1 / 2.4) - 0.055;
  return Math.round(255 * gamma);
}

/* Bisects chroma down until the colour fits, holding lightness and hue. */
function toRgb(colour: Oklch): Rgb {
  let used = colour;
  if (!inGamut(linearFromOklch(used))) {
    let low = 0;
    let high = colour.c;
    for (let i = 0; i < 30; i += 1) {
      const mid = (low + high) / 2;
      if (inGamut(linearFromOklch({ ...colour, c: mid }))) low = mid;
      else high = mid;
    }
    used = { ...colour, c: low };
  }
  const [r, g, b] = linearFromOklch(used);
  return [encode(r), encode(g), encode(b)];
}

function oklab(rgb: Rgb): [number, number, number] {
  const linear = (channel: number) => {
    const x = channel / 255;
    return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = [linear(rgb[0]), linear(rgb[1]), linear(rgb[2])];
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function oklch(rgb: Rgb): Oklch {
  const [l, a, b] = oklab(rgb);
  return {
    l,
    c: Math.hypot(a, b),
    h: ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360,
  };
}

/* OKLab distance x100 — the unit the spike and the owner's reference were compared in. */
export function deltaE(from: Rgb, to: Rgb): number {
  const [l1, a1, b1] = oklab(from);
  const [l2, a2, b2] = oklab(to);
  return 100 * Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

/* The hue the short way round, so red toward orange does not travel through blue. */
function mixHue(from: number, to: number, t: number): number {
  const delta = ((to - from + 540) % 360) - 180;
  return (from + delta * t + 360) % 360;
}

/* ---------------------------------------------------------------------------------------------
   THE STACK — everything about the head that does not depend on where the tip is. */

export interface HeadOptions {
  /* px of drawn line the head spans. */
  readonly length: number;
  /* Stroke width at the tip; the head tapers back to `baseWidth` at its tail. */
  readonly tipWidth: number;
  /* The ink's own stroke width, which the tail meets and the round cap of which the tip covers. */
  readonly baseWidth: number;
  /* The ramp runs tail -> mid -> tip. The mid stop is the owner's judged colour, so it stays a stop
     rather than being interpolated away. */
  readonly tailColor: Rgb;
  readonly midColor: Rgb;
  readonly tipColor: Rgb;
}

interface Stack {
  readonly steps: number;
  readonly stepLength: number;
  readonly strokes: readonly string[];
  readonly widths: readonly number[];
}

function rampSpan({ tailColor, midColor, tipColor }: HeadOptions): number {
  return deltaE(tailColor, midColor) + deltaE(midColor, tipColor);
}

/* `steps = max(ceil(length / 8), ceil(span / 2))`, capped. Exported so the rule itself is tested. */
export function headStepCount(options: HeadOptions): number {
  return Math.min(
    MAX_STEPS,
    Math.max(
      Math.ceil(options.length / MAX_STEP_LENGTH),
      Math.ceil(rampSpan(options) / MAX_STEP_DELTA_E),
    ),
  );
}

/* t = 0 at the tail colour, 1 at the tip colour, uniform in OKLab distance along both legs. */
function rampAt(options: HeadOptions, t: number): Rgb {
  const stops = [options.tailColor, options.midColor, options.tipColor];
  const legs = [
    { from: stops[0], to: stops[1], length: deltaE(stops[0], stops[1]) },
    { from: stops[1], to: stops[2], length: deltaE(stops[1], stops[2]) },
  ];
  let remaining = Math.max(0, Math.min(1, t)) * rampSpan(options);
  for (const leg of legs) {
    if (remaining <= leg.length + 1e-9) {
      const along = leg.length === 0 ? 0 : remaining / leg.length;
      const from = oklch(leg.from);
      const to = oklch(leg.to);
      return toRgb({
        l: from.l + (to.l - from.l) * along,
        c: from.c + (to.c - from.c) * along,
        h: mixHue(from.h, to.h, along),
      });
    }
    remaining -= leg.length;
  }
  return options.tipColor;
}

/* Built once per options object: a frame asks for it many times and none of it changes. */
const stacks = new WeakMap<HeadOptions, Stack>();

function stackFor(options: HeadOptions): Stack {
  const cached = stacks.get(options);
  if (cached !== undefined) return cached;
  const steps = headStepCount(options);
  const tipWidth = Math.max(options.baseWidth, options.tipWidth);
  const strokes: string[] = [];
  const widths: number[] = [];
  for (let step = 0; step < steps; step += 1) {
    /* Each step takes the colour and width at its own midpoint, counted from the tip. */
    const along = 1 - (step + 0.5) / steps;
    const [r, g, b] = rampAt(options, along);
    strokes.push(`rgb(${r},${g},${b})`);
    widths.push(options.baseWidth + (tipWidth - options.baseWidth) * along);
  }
  const stack = { steps, stepLength: options.length / steps, strokes, widths };
  stacks.set(options, stack);
  return stack;
}

/* ---------------------------------------------------------------------------------------------
   THE RUNS */

export interface HeadLayer {
  /* 0 = the step at the tip. */
  readonly step: number;
  /* Arc length along the piece, `0 <= start < end <= the piece's length`. */
  readonly start: number;
  readonly end: number;
  /* px, widest at the tip. */
  readonly width: number;
  /* The resolved colour for this step. */
  readonly stroke: string;
}

export interface HeadSegment extends HeadLayer {
  /* Index into the pieces handed in. */
  readonly piece: number;
  /* `round` only for the cover at a piece's end. */
  readonly cap: "butt" | "round";
  /* Paint order across the whole stack: higher lies over lower. */
  readonly rank: number;
}

/* How much of a piece the ink has actually painted. The dash paints `period * progress` of it,
   clipped to the piece, and the period overshoots the piece by an epsilon — so the ink's tip is NOT
   `progress * length`. The head follows the ink, so it takes the dash's own arithmetic. */
function paintedLength(drawn: number, piece: PieceSpan): number {
  const length = piece.end - piece.start;
  const { dasharray, dashoffset } = dashForPiece(
    length,
    pieceProgress(drawn, piece),
  );
  return Math.max(0, Math.min(length, dasharray - dashoffset));
}

interface PieceSpan {
  readonly start: number;
  readonly end: number;
}

/* The runs of the head at `drawn`, over every piece of a chain in order, or none when the thread
   is not mid-draw — nothing drawn yet, or everything drawn. `drawn` is the page-level scalar, on
   the same scale as `pieces[i].start`/`end`.

   Step 0's run reaches half the ink's width, plus `HEAD_TIP_MARGIN`, past the tip. The ink is
   round-capped, so it shows half its width beyond its own end, and a head ending exactly at the tip
   would leave a dark pip of ink showing ahead of the light. When the tip is within that reach of a piece's end, a butt step
   cannot reach past the path, and Chromium drops a dash that ends exactly at a path's end, so a
   short round-capped run of the tip colour covers the ink's cap instead. */
export function headSegments(
  drawn: number,
  pieces: readonly PieceSpan[],
  options: HeadOptions,
): HeadSegment[] {
  const painted = pieces.map((piece) => paintedLength(drawn, piece));
  let tipPiece = -1;
  painted.forEach((length, index) => {
    if (length > NEGLIGIBLE) tipPiece = index;
  });
  const finished = pieces.every(
    (piece, index) => painted[index] >= piece.end - piece.start - NEGLIGIBLE,
  );
  if (tipPiece === -1 || finished) return [];

  const stack = stackFor(options);
  const cover = options.baseWidth / 2;
  const tip = pieces[tipPiece].start + painted[tipPiece];
  const tipAtPieceEnd =
    pieces[tipPiece].end - pieces[tipPiece].start - painted[tipPiece] < cover;

  const segments: HeadSegment[] = [];
  for (let step = 0; step < stack.steps; step += 1) {
    const end = tip - step * stack.stepLength;
    const start = Math.max(0, tip - (step + 1) * stack.stepLength);
    if (end - start <= NEGLIGIBLE) break;
    const reach =
      step === 0
        ? tipAtPieceEnd
          ? 0
          : cover + HEAD_TIP_MARGIN
        : HEAD_STEP_OVERLAP;
    const inPieces: HeadSegment[] = [];
    for (let index = tipPiece; index >= 0; index -= 1) {
      const piece = pieces[index];
      if (piece.end <= start) break;
      const from = Math.max(start, piece.start) - piece.start;
      const to = Math.min(end + reach, piece.end) - piece.start;
      if (to - from <= NEGLIGIBLE) continue;
      inPieces.push({
        step,
        piece: index,
        start: from,
        end: to,
        width: stack.widths[step],
        stroke: stack.strokes[step],
        cap: "butt",
        rank: index * PIECE_RANK + (STEP_RANK_CEILING - step),
      });
    }
    segments.push(...inPieces.reverse());
  }

  if (tipAtPieceEnd) {
    segments.push({
      step: 0,
      piece: tipPiece,
      start: Math.max(0, painted[tipPiece] - END_COVER_LENGTH),
      end: painted[tipPiece],
      width: Math.max(options.baseWidth, options.tipWidth),
      stroke: stack.strokes[0],
      cap: "round",
      rank: tipPiece * PIECE_RANK + COVER_RANK,
    });
  }
  return segments;
}

/* ---------------------------------------------------------------------------------------------
   THE GEOMETRY OF A RUN */

/* A piece's `d` is only ever `M` then `C`s (`thread-line.ts` emits nothing else), so its points are
   computed from the `d` itself rather than asked of the browser. `getPointAtLength` walks the whole
   path on every call, so sampling a 100-segment motif once per pixel is quadratic: measured at about
   a second of main thread for the page, in stalls of 25-85ms as the head reached each piece. Each
   cubic is cut into chords about this long (by its control polygon, which bounds its length) and the
   whole run is then walked once at one point per pixel of arc. A fixed number of chords per cubic
   was tried first and was off the true arc by 0.26px on a long connector, whose cubics are 50px. */
const CHORD_LENGTH = 1;
const MIN_CHORDS = 8;

const PATH_TOKEN = /[A-Za-z]|-?\d*\.?\d+(?:[eE][-+]?\d+)?/g;

/* `length` is the piece's own length from the model, the same one its dash is scaled by. The
   polyline's arc length is scaled onto it, so a sample at arc `s` lands where the ink's dash ends at
   `s` to well under a hundredth of a pixel, and the two agree at the piece's end exactly. */
export function samplePath(d: string, length: number): PieceSamples {
  const tokens = d.match(PATH_TOKEN) ?? [];
  const xs: number[] = [];
  const ys: number[] = [];
  const along: number[] = [];
  const lay = (x: number, y: number) => {
    const last = xs.length - 1;
    along.push(
      last < 0 ? 0 : along[last] + Math.hypot(x - xs[last], y - ys[last]),
    );
    xs.push(x);
    ys.push(y);
  };
  let command = "";
  let index = 0;
  const next = () => Number(tokens[index++]);
  while (index < tokens.length) {
    if (/^[A-Za-z]$/.test(tokens[index])) {
      command = tokens[index++];
      if (command !== "M" && command !== "C") {
        throw new Error(`samplePath: unsupported path command "${command}"`);
      }
      continue;
    }
    if (command === "M") {
      lay(next(), next());
      command = "";
    } else if (command === "C" && xs.length > 0) {
      const [x0, y0] = [xs[xs.length - 1], ys[ys.length - 1]];
      const [x1, y1, x2, y2, x3, y3] = [
        next(),
        next(),
        next(),
        next(),
        next(),
        next(),
      ];
      const controlLength =
        Math.hypot(x1 - x0, y1 - y0) +
        Math.hypot(x2 - x1, y2 - y1) +
        Math.hypot(x3 - x2, y3 - y2);
      const chords = Math.max(
        MIN_CHORDS,
        Math.ceil(controlLength / CHORD_LENGTH),
      );
      for (let chord = 1; chord <= chords; chord += 1) {
        const t = chord / chords;
        const u = 1 - t;
        const [a, b, c, e] = [
          u * u * u,
          3 * u * u * t,
          3 * u * t * t,
          t * t * t,
        ];
        lay(
          a * x0 + b * x1 + c * x2 + e * x3,
          a * y0 + b * y1 + c * y2 + e * y3,
        );
      }
    } else {
      throw new Error("samplePath: numbers with no command to read them");
    }
  }

  const count = Math.ceil(length) + 2;
  const xy = new Float32Array(count * 2);
  const scale = length > 0 ? along[along.length - 1] / length : 0;
  let segment = 1;
  for (let i = 0; i < count; i += 1) {
    const target = Math.min(length, i) * scale;
    while (segment < along.length - 1 && along[segment] < target) segment += 1;
    const span = along[segment] - along[segment - 1];
    const t = span > 0 ? (target - along[segment - 1]) / span : 0;
    xy[2 * i] = xs[segment - 1] + (xs[segment] - xs[segment - 1]) * t;
    xy[2 * i + 1] = ys[segment - 1] + (ys[segment] - ys[segment - 1]) * t;
  }
  return { xy, length };
}

/* A piece's points, one per pixel of arc, so a frame slices numbers instead of asking the browser
   for points: `getPointAtLength` walks the whole path on every call. The sampler leaves two extra
   points past the end so interpolating at the very end never reads beyond the array. */
export interface PieceSamples {
  readonly xy: Float32Array;
  readonly length: number;
}

/* A position past the path's end continues along the path's own last direction. That is what lets a
   run cross into a piece that lives in another `<svg>`: this side has to overlap the far side, or
   the far side's round cap of ink shows through as a speck and the two runs' butt ends antialias
   into a hairline. */
export function polylineBetween(
  { xy, length }: PieceSamples,
  from: number,
  to: number,
): string {
  const lastIndex = xy.length / 2 - 2;
  const point = (position: number): [number, number] => {
    const clamped = Math.max(0, Math.min(length, position));
    const index = Math.min(Math.floor(clamped), lastIndex);
    const t = clamped - index;
    return [
      xy[2 * index] * (1 - t) + xy[2 * index + 2] * t,
      xy[2 * index + 1] * (1 - t) + xy[2 * index + 3] * t,
    ];
  };
  const format = ([x, y]: [number, number]) =>
    `${x.toFixed(2)} ${y.toFixed(2)}`;
  let d = `M${format(point(from))}`;
  for (let i = Math.floor(from) + 1; i < Math.min(to, length); i += 1) {
    d += `L${xy[2 * i].toFixed(2)} ${xy[2 * i + 1].toFixed(2)}`;
  }
  if (to <= length) return `${d}L${format(point(to))}`;
  const end = point(length);
  const before = point(length - 1);
  const run = Math.hypot(end[0] - before[0], end[1] - before[1]) || 1;
  const past = to - length;
  return `${d}L${format(end)}L${format([
    end[0] + ((end[0] - before[0]) / run) * past,
    end[1] + ((end[1] - before[1]) / run) * past,
  ])}`;
}
