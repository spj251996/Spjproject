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

/* Each step is run this far under the one behind it, as insurance: a 0.75px within-stack overlap was
   measured as making no difference to the colour jump on the centreline, so it is kept because it
   costs nothing, not because a seam was seen there. What WAS seen is a hairline (and a dark half-disc of ink cap) at the
   join between the trunk's `<svg>` and the weave's, at 12x. That is why it is exported: where the
   head crosses into a piece that lives in another `<svg>`, the run on the near side carries the same
   overlap past its own path's end. */
export const HEAD_STEP_OVERLAP = 1;

/* The head's leading edge lies this far beyond the ink's own round cap. The two edges would otherwise
   coincide to the subpixel, and where they share a pixel the antialiasing composes into a dark
   sliver at the tip (8 pixels of it at 16x on a real render; none with this margin). */
export const HEAD_TIP_MARGIN = 0.25;

/* A tip within half the ink's width of a piece's end is covered by a short round-capped overrun of
   this length (see `headSegments`). */
const END_COVER_LENGTH = 1.5;

/* Below this, a piece has drawn nothing worth a head. */
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
  const stack = { steps, strokes, widths };
  stacks.set(options, stack);
  return stack;
}

/* ---------------------------------------------------------------------------------------------
   THE RUNS */

export interface HeadSegment {
  /* 0 = the step at the tip. */
  readonly step: number;
  /* Arc length along the piece, `0 <= start < end <= the piece's length`. */
  readonly start: number;
  readonly end: number;
  /* px, widest at the tip. */
  readonly width: number;
  /* The resolved colour for this step. */
  readonly stroke: string;
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
export function paintedLength(drawn: number, piece: PieceSpan): number {
  const length = piece.end - piece.start;
  const { dasharray, dashoffset } = dashForPiece(
    length,
    pieceProgress(drawn, piece),
  );
  return Math.max(0, Math.min(length, dasharray - dashoffset));
}

export interface PieceSpan {
  readonly start: number;
  readonly end: number;
}

/* The runs of the head at `drawn`, over every piece of a chain in order, or none when the thread
   is not mid-draw — nothing drawn yet, or everything drawn. `drawn` is the page-level scalar, on
   the same scale as `pieces[i].start`/`end`.

   Step 0's run reaches half the ink's width, plus `HEAD_TIP_MARGIN`, past the tip. The ink is
   round-capped, so it shows half its width beyond its own end, and a head ending exactly at the tip
   would leave a dark pip of ink showing ahead of the light.

   Each run is clipped to its own piece, so when the tip is within that reach of a piece's end the
   butt step stops short of the ink's cap, and a short round-capped run of the tip colour covers it
   instead. Measured on the shipped build with that cover removed: every one of the 30 forced
   piece-end states checked (25 at wide, 5 at tall) showed a dark pip; with it, none. (An earlier
   dashed head additionally could not draw a butt past a path's end at all; that mechanism is not
   tested on the shipped polylines, and only the clipping is claimed here.) */
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
  return stackRuns(
    pieces[tipPiece].start + painted[tipPiece],
    options.length,
    pieces,
    tipPiece,
    options,
  );
}

/* The runs of one lit segment whose tip is at `tip`, in the chain's own scale, and which spans
   `span` back from it, laid as the head lays them: the stack's colours stretched over however long
   the segment is. The drawing head always spans its full length; the re-trace's segment grows and
   shrinks, so the step length follows `span` rather than the stack's own. `tipPiece` is the piece
   the tip lies in. */
function stackRuns(
  tip: number,
  span: number,
  pieces: readonly PieceSpan[],
  tipPiece: number,
  options: HeadOptions,
): HeadSegment[] {
  const stack = stackFor(options);
  const stepLength = span / stack.steps;
  const cover = options.baseWidth / 2;
  const tipPainted = tip - pieces[tipPiece].start;
  const tipAtPieceEnd =
    pieces[tipPiece].end - pieces[tipPiece].start - tipPainted < cover;

  const segments: HeadSegment[] = [];
  for (let step = 0; step < stack.steps; step += 1) {
    const end = tip - step * stepLength;
    const start = Math.max(0, tip - (step + 1) * stepLength);
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
      start: Math.max(0, tipPainted - END_COVER_LENGTH),
      end: tipPainted,
      width: Math.max(options.baseWidth, options.tipWidth),
      stroke: stack.strokes[0],
      cap: "round",
      rank: tipPiece * PIECE_RANK + COVER_RANK,
    });
  }
  return segments;
}

/* ---------------------------------------------------------------------------------------------
   THE RE-TRACE — a lit segment that runs a stretch of the thread once it is already drawn, on a
   loop. It is the page's resting motion and its scroll cue (DESIGN.md -> Thread -> The re-trace).

   It follows the owner's reference clip, measured by sampling its frames: the
   segment's length is not constant, since the tip and the tail move at different speeds and it
   grows from nothing and shrinks back to nothing over a loop; its leading edge is hard and its
   trailing end a soft ramp; the gradient is continuous; and the base stroke is unchanged behind and
   ahead of it. So it is laid with the head's own stack, a tail-to-tip ramp stretched over whatever
   length the segment has. The clip's lack of any glow is NOT carried over: on a red thread the clip's
   own grey-to-red contrast is not available, and the head's settled halo and ramp are what read. */

/* Peak length as a multiple of the stroke, as the head's is: the reference's segment grows to about
   89 times the stroke width (~180px on a 2px line) and the clip's absolute scale cannot be recovered,
   so the ratio is what transfers. */
export const RETRACE_LENGTH_RATIO = 89;

/* Of one loop, the share the tip spends reaching the end of the stretch; the tail then runs out the
   remainder. The reference's tip reaches the end of its curve a little over half way through its 2.0s
   loop and the tail finishes as the next begins. */
export const RETRACE_TIP_ARRIVES = 0.55;

/* A segment shorter than this share of its peak is faint, so it appears and vanishes rather than
   popping: the reference's colour falls away as its length does, peak colour 126 -> 14 as the length
   falls 150 -> 21px. */
const RETRACE_FADE_SHARE = 0.5;

export type RetracePhase = "drawing" | "complete";

/* `"complete"` once the thread has been drawn to its end, which the ratchet makes permanent. */
export function retracePhase(drawn: number, totalLength: number): RetracePhase {
  return drawn >= totalLength - NEGLIGIBLE ? "complete" : "drawing";
}

/* The group indices that should carry a running loop; empty when nothing should animate.

   While `"drawing"` it is at most the group holding the tip, if that group is on screen: an unfinished
   line with a live tip says there is more below, which is the page's scroll cue. Once `"complete"` it
   is every group on screen, one loop per stretch. The whole page is not one stretch because at 9.4
   screens a single travelling segment would be in view for about a tenth of each loop, and either
   whip past as a glitch or leave the reader watching nothing between passes. A stretch is a group
   the draw already measures (`groupRects`), so this is an activation rule over existing geometry.

   The last group holds the thread's terminal and loops like any other: the tapered end says there is
   nothing after it, and a loop there is what says the page is alive to its last screen. */
export function retraceTargets(
  phase: RetracePhase,
  groupRects: readonly { readonly top: number; readonly height: number }[],
  viewport: { readonly scrollY: number; readonly height: number },
  tipGroup: number | undefined,
): number[] {
  const onScreen = (index: number) => {
    const rect = groupRects[index];
    return (
      rect !== undefined &&
      rect.top < viewport.scrollY + viewport.height &&
      rect.top + rect.height > viewport.scrollY
    );
  };
  if (phase === "drawing") {
    return tipGroup !== undefined && onScreen(tipGroup) ? [tipGroup] : [];
  }
  return groupRects.flatMap((_, index) => (onScreen(index) ? [index] : []));
}

/* THE GLOW AS STROKES, NOT A FILTER. A halo does not have to be a blur: a few translucent strokes on
   the same path, each wider and fainter than the next, painted under the core, fall off outward in
   steps. The 4x halo as a filter over three lit stretches at 1536px wide cost 77 dropped frames in
   the measurement DESIGN.md records; the strokes have no filter, and so no blur buffer to re-render
   each frame. (A group with `opacity` below 1, which a short segment's group takes, is still an
   isolated group; that case is inferred and was not isolated in the measurement.)

   Fitted to the 4x filter halo as measured on a straight 3.2px line over the ivory ground: the share
   of vermilion at 2-60px from the centreline is 0.24 at 2px, 0.13 at 6, 0.06 at 10-12, 0.036 at 20,
   0.018 at 30 and 0.006 at 50-60. Each stroke covers one band of that curve, and its alpha is what
   brings the composite inside the band up to the measured share given the strokes outside it. Three
   strokes gave an RMS error of 0.014 in that share and a visibly stepped edge at 3x (the widest
   stroke's rim read as an outline); eight give 0.007 and none shows at 3x. Widest first, as they are
   painted.

   THESE EIGHT ALPHAS DEPEND ON THE HALO'S RADII (3.5 / 12 / 33px, `--halo-thread-head`) AND ON ITS
   THREE ALPHAS: they were fitted to the falloff those values produce. Retune the halo and this stack
   describes a halo that no longer exists until it is re-fitted and `MEASURED_HALO` re-measured; the
   test that pins the radii fails for exactly that reason. */
const FITTED_GLOW = [
  { width: 100, alpha: 0.01 },
  { width: 56, alpha: 0.019 },
  { width: 38, alpha: 0.013 },
  { width: 26, alpha: 0.018 },
  { width: 18, alpha: 0.029 },
  { width: 13, alpha: 0.057 },
  { width: 9, alpha: 0.045 },
  { width: 6, alpha: 0.061 },
] as const;

/* SCALED BY `RETRACE_GLOW_SCALE`. A constant-width stroke over the whole segment covers more area
   with faint glow than the filter does round a segment that tapers to the ink's width and fades at
   its ends, although it is fainter than the filter at every distance on a straight line. So the
   fitted alphas are scaled until the real segment's glow area is near the filter's. Measured on the
   real segment (393x700, scroll 0, ten frames, pixels changed against the layer hidden, three runs;
   figures are pixels over 12/255, summed delta, pixels over 4/255): the filter 2,217 / 64,412 /
   5,592; scale 1.0 gives 2,770 / 85,598 / 9,306; 0.72 gives 1,979 / 57,440 / 4,613; the shipped
   0.77 gives 2,528 / 70,946 / 6,399. The response steps rather than ramps because an alpha is
   stored in eight bits. */
export const RETRACE_GLOW_SCALE = 0.77;
export const RETRACE_GLOW = FITTED_GLOW.map(({ width, alpha }) => ({
  width,
  alpha: Number((alpha * RETRACE_GLOW_SCALE).toFixed(4)),
}));

/* The glow under a lit segment from `tail` to `tip` (the chain's scale): for each piece it covers,
   one polyline per stroke, so a stroke is composited once however many steps the core has (per-step
   glow would composite twice where steps overlap and band). Round caps carry it past both ends, as
   the filter's blur does. `colour` is the vermilion stop. */
export function retraceGlow(
  tail: number,
  tip: number,
  pieces: readonly PieceSpan[],
  colour: Rgb,
): HeadSegment[] {
  const [r, g, b] = colour;
  const segments: HeadSegment[] = [];
  pieces.forEach((piece, index) => {
    if (piece.end <= tail || piece.start >= tip) return;
    const from = Math.max(tail, piece.start) - piece.start;
    const to = Math.min(tip, piece.end) - piece.start;
    if (to - from <= NEGLIGIBLE) return;
    RETRACE_GLOW.forEach((stroke, level) => {
      segments.push({
        step: level,
        piece: index,
        start: from,
        end: to,
        width: stroke.width,
        stroke: `rgba(${r},${g},${b},${stroke.alpha})`,
        cap: "round",
        rank: index * PIECE_RANK + level,
      });
    });
  });
  return segments;
}

/* The group holding the tip: the last one the drawn length has entered, or none before any has. */
export function tipGroupIndex(
  ranges: readonly { readonly start: number }[],
  drawn: number,
): number | undefined {
  const index = ranges.findLastIndex((range) => range.start < drawn);
  return index === -1 ? undefined : index;
}

/* A CSS time token, `2s` or `800ms`, in milliseconds; undefined when it is not one, so a missing or
   malformed token stops the loop rather than running it at a value nobody chose. */
export function parseCssTime(value: string): number | undefined {
  const match = value.trim().match(/^([\d.]+)(ms|s)$/);
  if (match === null) return undefined;
  const time = Number(match[1]) * (match[2] === "s" ? 1000 : 1);
  return time > 0 && Number.isFinite(time) ? time : undefined;
}

/* A CSS count, `3`, as a whole number of loops; undefined when it is not one, for the same reason
   `parseCssTime` has: a missing or malformed token stops the loop rather than running it at a budget
   nobody chose. Zero is not a count, since a loop that may run no times is no loop. */
export function parseCssCount(value: string): number | undefined {
  const match = value.trim().match(/^\d+$/);
  if (match === null) return undefined;
  const count = Number(match[0]);
  return count > 0 ? count : undefined;
}

/* Where `elapsed` ms of running time falls in a loop of `duration` ms, as 0 to 1 through the loop, and
   whether the budget of `loops` WHOLE loops is spent. It counts loops and not time: the pace is the
   owner's to change, and a slower loop must not silently keep the page busy for longer. `elapsed` is
   running time, so a caller that suspends the loop (a hidden tab) simply stops advancing it and
   spends nothing. Every loop is empty at both its edges, so stopping at the end of the last one is
   not a visible cut. */
export function retraceLoopAt(
  elapsed: number,
  duration: number,
  loops: number,
): { loop: number; spent: boolean } {
  const through = Math.max(0, elapsed) / duration;
  return through >= loops
    ? { loop: 0, spent: true }
    : { loop: through % 1, spent: false };
}

/* THE RE-TRACE'S SPEED MODEL (owner, 2026-10-05: "lets decouple speed and length, its not calm
   retrace but jarring effect", and "max looping duration as N loops on biggest thread section ...
   find looping duration that ensures complete loops for all").

   A loop of fixed duration makes the light's SPEED depend on the stretch's length, because every
   stretch has to finish in the same time whatever distance it covers. Measured on the shipped layout
   that is a 10.3x spread at `wide` -- 231px/s on celebrations' short row against 2371px/s on
   event-info, both on screen together.

   Fixing the speed instead gives each stretch a period proportional to its own length, which alone
   would cut most stretches off part-way round a loop when the shared budget expires: arbitrary
   lengths share no common multiple. So the budget is the LONGEST stretch's own loops, and every
   other stretch takes the WHOLE number of loops nearest its natural period and runs at exactly
   `budget / that count`. Each one ends on a loop boundary, they all stop together, and the speed
   error is a few per cent -- at most 9.6% at `wide` and 7.9% at `tall` on the shipped layout,
   against the 10.3x it replaces. The longest stretch is exact by construction.

   Lives here, not in the component, for the same reason the rest of the arithmetic does: it is
   testable without a DOM, which is how the epsilon seed and the vacuous checks were caught. */
export function retraceNominalMs(extent: number, speed: number): number {
  return (extent / (RETRACE_TIP_ARRIVES * speed)) * 1000;
}

/* The period a stretch actually runs at, so that a whole number of its loops fills `budgetMs`. */
export function retracePeriodMs(budgetMs: number, nominalMs: number): number {
  if (!(budgetMs > 0) || !(nominalMs > 0)) return budgetMs;
  return budgetMs / Math.max(1, Math.round(budgetMs / nominalMs));
}

/* Where the segment's tip and tail are, as arc lengths into a stretch of `extent`, at `loop` (0 to 1)
   through a loop. Both start at the stretch's start and both end at its end, so the loop is empty at
   each edge. The tip runs out to the end in the first `RETRACE_TIP_ARRIVES` of the loop and the tail
   follows: it trails the tip by the peak length while that is shorter than the stretch, then runs
   the rest of the way in the remainder. Neither end ever moves backwards. */
export function retraceSpan(
  loop: number,
  extent: number,
  peakLength: number,
): { tail: number; tip: number } {
  const u = Math.max(0, Math.min(1, loop));
  if (u < RETRACE_TIP_ARRIVES) {
    const tip = extent * (u / RETRACE_TIP_ARRIVES);
    return { tail: Math.max(0, tip - peakLength), tip };
  }
  const tailWhenTipArrives = Math.max(0, extent - peakLength);
  const left = (u - RETRACE_TIP_ARRIVES) / (1 - RETRACE_TIP_ARRIVES);
  return {
    tail: tailWhenTipArrives + (extent - tailWhenTipArrives) * left,
    tip: extent,
  };
}

/* The segment's opacity: full once it is half its peak length, falling to nothing as it shrinks. */
export function retraceFade(length: number, peakLength: number): number {
  return Math.max(0, Math.min(1, length / (RETRACE_FADE_SHARE * peakLength)));
}

/* The runs of a segment from `tail` to `tip`, in the chain's own scale, over every piece of the
   chain. `options.length` is the peak the stack is built for; the segment spans however much of it
   `tip - tail` is. */
export function retraceSegments(
  tail: number,
  tip: number,
  pieces: readonly PieceSpan[],
  options: HeadOptions,
): HeadSegment[] {
  if (tip - tail <= NEGLIGIBLE) return [];
  let tipPiece = -1;
  pieces.forEach((piece, index) => {
    if (piece.start < tip) tipPiece = index;
  });
  if (tipPiece === -1) return [];
  return stackRuns(tip, tip - tail, pieces, tipPiece, options);
}

/* ---------------------------------------------------------------------------------------------
   THE TAPER — the thread's two static free ends, the invite's top terminal and Wishes' close, come
   to a point instead of stopping at a round cap.

   An SVG stroke has one width along its whole length, and a stroke cannot be thinned by drawing a
   narrower one over it, so a taper is built the way the head is: a stack of butt-capped runs of the
   piece, each a little narrower than the one inside it, with the ink itself cut back over the same
   stretch so the stack is all that shows there. Like the head it is polylines through only its own
   stretch (`polylineBetween`), never dashes on a copy of the piece. The ends are fixed in the
   piece's own arc length, so all of it is worked out once, when the page is measured.

   It ships at these two ends only, and not under the live drawing head: the head already covers
   the last 96px of the line, and a taper beneath it was not visible there (DESIGN.md -> Thread ->
   The tapered ends). */

/* 16 runs: at 4 and 8 the steps and a tick at each seam show, at 16 it reads as a taper and the
   antialiased seam is visible only from about 6x zoom (measured on renders at dpr 3). */
export const TAPER_STEPS = 16;

/* A run is widest at `strokeWidth` and narrows to this at the end, so the last run is a hairline
   rather than vanishing in a zero-width stroke. */
const TAPER_FLOOR = 0.2;

/* Each run is lent this much of the stretch inside it, as the head's steps are, so the seam between
   two abutting butt ends cannot open. The narrower run lies wholly inside the wider one's body, so
   the loan never shows. */
const TAPER_OVERLAP = 1;

/* The cut is a stroke wider than the ink: it has to take the ink's round cap past a free end (half the
   stroke) and its antialiased edge. It cuts the ink BEFORE the bleed runs, so it need not reach the
   halo, and narrow is better: it takes any other ink of the same piece that passes within half
   of it. */
export const TAPER_CUT_WIDTH = 8;

export interface TaperOptions {
  readonly steps: number;
  /* px of the piece the taper spans; shortened when less than this lies on the path. */
  readonly taperLength: number;
  /* The ink's own stroke width, which the innermost run meets. */
  readonly strokeWidth: number;
}

export interface TaperSegment {
  /* 0 = the innermost run, the widest and furthest from the end. */
  readonly index: number;
  /* Arc length along the piece, `0 <= start < end <= the piece's length`. */
  readonly start: number;
  readonly end: number;
  readonly width: number;
}

/* How much of the path lies on the taper's side of `endAt`. */
function taperReach(
  endAt: number,
  pathLength: number,
  direction: -1 | 1,
  taperLength: number,
): number {
  return Math.max(
    0,
    Math.min(taperLength, direction === 1 ? endAt : pathLength - endAt),
  );
}

/* The runs of a taper at an end sitting `endAt` along a path of `pathLength`. `direction` is -1 for
   an end that points backwards along the path (the invite's top terminal, `endAt = 0`) and +1 for
   one that points forwards (Wishes' close, `endAt = pathLength`). The widths do not depend on which
   way the end points, so the two mirror each other. */
export function taperSegments(
  endAt: number,
  pathLength: number,
  direction: -1 | 1,
  { steps, taperLength, strokeWidth }: TaperOptions,
): TaperSegment[] {
  const reach = taperReach(endAt, pathLength, direction, taperLength);
  const step = reach / steps;
  const floor = Math.min(TAPER_FLOOR, strokeWidth);
  const segments: TaperSegment[] = [];
  for (let index = 0; index < steps; index += 1) {
    /* Distances from the end: run `index` lies between `near` (the narrow side) and `far`. */
    const far = reach - index * step;
    const near = reach - (index + 1) * step;
    const width = floor + (strokeWidth - floor) * (1 - (index + 0.5) / steps);
    segments.push(
      direction === 1
        ? {
            index,
            start: Math.max(0, endAt - far - TAPER_OVERLAP),
            end: endAt - near,
            width,
          }
        : {
            index,
            start: endAt + near,
            end: Math.min(pathLength, endAt + far + TAPER_OVERLAP),
            width,
          },
    );
  }
  return segments;
}

/* Whether the ink has drawn far enough for this run to show. A run the ink has reached only part of
   stays hidden: the head covers the last 96px of drawn line and is wider than any run, so nothing is
   missed, and a run never shows ahead of the ink. Ink grows from arc 0, so this holds at both ends. */
export function taperReached(segment: TaperSegment, painted: number): boolean {
  return painted >= segment.end - NEGLIGIBLE;
}

/* The stretch of the piece whose ink is cut away under a taper: the tapered stretch itself, and, past
   the free end, enough to take the ink's round cap with it. */
export function taperCut(
  endAt: number,
  pathLength: number,
  direction: -1 | 1,
  taperLength: number,
): { from: number; to: number } {
  const reach = taperReach(endAt, pathLength, direction, taperLength);
  const past = TAPER_CUT_WIDTH / 2;
  return direction === 1
    ? { from: endAt - reach, to: endAt + past }
    : { from: endAt - past, to: endAt + reach };
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

/* A position past the path's end continues along the path's own last direction, and one before its
   start along the first. That is what lets a run cross into a piece that lives in another `<svg>`:
   this side has to overlap the far side, or this side's own round end cap of ink stands out past
   the join as a dark half-disc and the two runs' butt ends antialias into a hairline (both seen at
   12x). It is also what lets the taper's cut reach past a free end far enough to take the ink's cap
   and its bleed with it. */
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
  /* `distance` beyond `end`, on the line `end` lies on running away from `inside`. */
  const beyond = (
    end: [number, number],
    inside: [number, number],
    distance: number,
  ): [number, number] => {
    const run = Math.hypot(end[0] - inside[0], end[1] - inside[1]) || 1;
    return [
      end[0] + ((end[0] - inside[0]) / run) * distance,
      end[1] + ((end[1] - inside[1]) / run) * distance,
    ];
  };
  let d =
    from < 0
      ? `M${format(beyond(point(0), point(1), -from))}L${format(point(0))}`
      : `M${format(point(from))}`;
  for (
    let i = Math.max(1, Math.floor(from) + 1);
    i < Math.min(to, length);
    i += 1
  ) {
    d += `L${xy[2 * i].toFixed(2)} ${xy[2 * i + 1].toFixed(2)}`;
  }
  if (to <= length) return `${d}L${format(point(to))}`;
  const end = point(length);
  return `${d}L${format(end)}L${format(beyond(end, point(length - 1), to - length))}`;
}
