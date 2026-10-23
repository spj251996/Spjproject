import {
  type HeadOptions,
  type HeadSegment,
  NEGLIGIBLE,
  PIECE_RANK,
  type PieceSpan,
  type Rgb,
  stackRuns,
} from "./thread-head.ts";

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
const RETRACE_TIP_ARRIVES = 0.55;

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

   Fitted to the 4x filter halo as measured on a straight 3.2px line over the ivory ground, one stroke
   per band of its falloff; eight strokes, because fewer show a stepped edge at 3x. Widest first, as
   they are painted.

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
   fitted alphas are scaled until the real segment's glow area is near the filter's: 0.77, measured
   on the real segment. The response steps rather than ramps because an alpha is stored in eight
   bits. */
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

/* THE RE-TRACE'S SPEED MODEL. A loop of fixed duration makes the light's SPEED depend on the stretch's length, because every
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
   testable without a DOM. */
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
