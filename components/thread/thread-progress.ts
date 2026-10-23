import type { SectionRange, SectionRect } from "./thread-line.ts";

/* ---------------------------------------------------------------------------------------------
   THE PIECEWISE PROGRESS MAP. Each section's scroll window maps onto that section's own stretch of
   the page total, never one global `scrollY / (scrollHeight - innerHeight)`: total path length has no
   relationship to where a section's scroll window falls, so a global fraction advances every section
   at once. */

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/* A clamped linear ramp from `(x0, y0)` to `(x1, y1)` -- shared by every ramp below so a degenerate
   span (`x1 <= x0`, no scroll room between the two points) has exactly one definition project-wide:
   step from `y0` to `y1` at `x0`, never divide by a zero or negative span. */
function lerpProgress(
  scrollY: number,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
): number {
  if (x1 <= x0) return scrollY >= x0 ? y1 : y0;
  return y0 + (y1 - y0) * clamp01((scrollY - x0) / (x1 - x0));
}

/* THE 75%/25% CROSSING RULE, now that the dash is per-PIECE rather than per-section: "the last
   connector of every section except wishes is 75% drawn at the moment the
   section's top reaches the viewport's top... the remaining 25% draws as the reader scrolls on...
   the next section's first piece waits for that 25%." In the owner's own words this is about ONE
   piece -- the section's final connector -- not the section as a whole, so the fraction of the
   SECTION's own total length that has drawn by `scrollY === rect.top` depends on how much of that
   total the last piece itself is (`SectionRange.lastPieceLength`): every piece before it must
   already be complete, plus 75% of the last one.

   `CROSSING_HOLD_FRACTION` names the piece-level fraction (0.75) the owner stated; `rampAFraction`
   below converts it into the section-level fraction `sectionProgress` actually drives. */
const CROSSING_HOLD_FRACTION = 0.75;

/* Wishes is the page's own terminal stretch -- there is no "next section" waiting on its last
   piece, and no `rect.top`-anchored crossing to aim for, so the owner exempts it explicitly ("every
   section except wishes"). It draws across its own remaining reachable window to completion, the
   single ramp every section used before this rule existed. */
function terminalSectionProgress(
  scrollY: number,
  windowStart: number,
  windowEnd: number,
): { progress: number; windowEnd: number } {
  return {
    progress: lerpProgress(scrollY, windowStart, windowEnd, 0, 1),
    windowEnd,
  };
}

/* THE TERMINAL STRETCH'S OWN SCROLL BUDGET. `wishes.top` EQUALS the page's own `maxScroll`, because
   wishes occupies exactly the final viewport, so its card is never scrolled THROUGH and the chain
   would hand it only whatever the previous section left over: the stretch would draw too fast to read
   as a draw and reach 100% only at the page's last pixel, leaving the drawing head lit over the
   closing taper at any resting position short of the bottom.

   `span` buys the stretch a real window and `finish` lands it before the page bottom, so the head
   retires while the reader is still there. Both are read from tokens rather than coined here: the
   owner sets them on a render (see DESIGN.md -> Thread). The scroll they take comes out of the
   earlier sections' shared budget — the page's total is fixed — which is why `sectionProgressAt`
   bounds those sections by the terminal window's own start rather than by `maxScroll`. That bound is
   what keeps "at most one section mid-ramp" true; without it the terminal ramp would overlap
   whichever section is still running. A `span` of 0 defers to the chain's leftover. */
export type TerminalWindow = {
  /* Scroll distance, in px, the terminal stretch draws across. 0 defers to the chain's leftover. */
  readonly span: number;
  /* How far before the page's maximum scroll the stretch finishes, in px. */
  readonly finish: number;
};

export const CHAIN_TERMINAL_WINDOW: TerminalWindow = { span: 0, finish: 0 };

/* THE FIRST SECTION IS THE ONE CASE THE CROSSING RULE CANNOT REACH, A CONSEQUENCE OF THE PAGE
   HAVING A START AND NOT A BUG TO PATCH HERE (parallel to this file's own earlier documented
   exception for the LAST section's tight window, before the crossing rule existed). The crossing
   rule needs scroll room BEFORE a section's own top to ramp gradually through — room this file
   gives every later section by having its PREDECESSOR finish early, before ITS own bottom, and
   hold. `invite` has no predecessor: its own top is the page's own scroll origin (0), so
   `windowStart === rect.top` identically and the derived-rate mechanism `crossingSectionProgress`
   uses (ramp B's duration comes from ramp A's own measured rate) has no ramp A duration to measure
   a rate from. Applying the crossing formula there anyway does not gracefully degrade — verified
   by hand and left here rather than silently "fixed": with `durationA === 0`, `crossingSectionProgress`
   also collapses `durationB` to 0 (its own guard against dividing by that same zero), so the ENTIRE
   first section reads complete at `scrollY === 0`, before any scrolling — and because this section's
   `windowEnd` then feeds `event-info`'s own `windowStart`, the very same collapse propagates down
   every later section in turn, reading the WHOLE PAGE complete at scroll 0. That is a correctness
   bug, not a matter of degree, so `invite` instead keeps this file's own PRE-crossing rule: ramp
   across the first `FIRST_SECTION_DRAW_FRACTION` of its own window (still `[rect.top, rect.top +
   rect.height]`, no lead-in) and hold for the rest — a deliberate, evidence-driven exception to
   "every section except wishes". */
const FIRST_SECTION_DRAW_FRACTION = 0.6;

function firstSectionProgress(
  scrollY: number,
  rect: SectionRect,
  maxScroll: number,
): { progress: number; windowEnd: number } {
  // The first section has no predecessor to inherit a chained `windowStart` from -- its own window
  // is exactly `[rect.top, rect.top + rect.height]` (the "no lead-in" rule, unchanged from before
  // the crossing rule existed), never the page's bare scroll origin. On the real page `rect.top` IS
  // 0 for `invite`, so this coincides with the chain's placeholder start of 0 -- but a synthetic
  // section placed away from x=0 (this file's own tests do this deliberately, to rule out an
  // accidental origin dependency) would otherwise ramp from the wrong point entirely.
  const windowStart = Math.min(rect.top, maxScroll);
  const windowEnd = rect.top + rect.height;
  const rawDrawEnd =
    windowStart + FIRST_SECTION_DRAW_FRACTION * (windowEnd - windowStart);
  const drawEnd = Math.min(rawDrawEnd, maxScroll);
  return {
    progress: lerpProgress(scrollY, windowStart, drawEnd, 0, 1),
    windowEnd: drawEnd,
  };
}

/* ONE CONSTANT DRAW SPEED (thread-length per scroll-pixel) ACROSS BOTH HALVES OF A SECTION'S OWN
   WINDOW -- the mechanism that makes "scroll divides between a section's pieces BY LENGTH" (the
   owner's own words) hold for the crossing piece too, as a consequence of one rule rather than a
   second one to keep in sync with the first: ramp A (`[windowStart, rect.top]`, 0 to
   `rampAFraction` of the section) fixes the rate, and ramp B's own duration is DERIVED from it --
   the same rate carries the last piece through its own 75%/100% boundary, so the crossing speed and
   the approach speed are the same number, never chosen independently.

   `windowStart` is NOT this section's own `rect.top` -- it is the previous section's `windowEnd`
   (the first section uses `firstSectionProgress`), threaded through
   `drawnLength`'s loop below. That chaining is what "the next section's first piece waits" reduces
   to: the next section's ramp A cannot begin, by definition, before this one's ramp B has an
   `windowEnd` to hand it. */
function crossingSectionProgress(
  scrollY: number,
  windowStart: number,
  rect: SectionRect,
  range: SectionRange,
  maxScroll: number,
): { progress: number; windowEnd: number } {
  const totalLength = range.end - range.start;
  const rampAEnd = Math.min(rect.top, maxScroll);
  // Guarded for a pathological section whose one "piece" IS the whole thing (never true of this
  // project's real data -- every section has at least one motif, so at least two connectors --
  // kept only so this pure function cannot divide by zero on a hand-built test input).
  const rampAFraction =
    totalLength > 0
      ? clamp01(
          (totalLength - (1 - CROSSING_HOLD_FRACTION) * range.lastPieceLength) /
            totalLength,
        )
      : 1;
  const rampBFraction = 1 - rampAFraction;

  const durationA = rampAEnd - windowStart;
  // Ramp B's duration is the SAME rate (durationA / rampAFraction thread-px per scroll-px) applied
  // to the remaining rampBFraction of the section -- not an independently chosen window.
  const durationB =
    durationA > 0 && rampAFraction > 0
      ? durationA * (rampBFraction / rampAFraction)
      : 0;
  const rampBEnd = Math.min(rampAEnd + durationB, maxScroll);

  const progress =
    scrollY < rampAEnd
      ? lerpProgress(scrollY, windowStart, rampAEnd, 0, rampAFraction)
      : lerpProgress(scrollY, rampAEnd, rampBEnd, rampAFraction, 1);
  return { progress, windowEnd: rampBEnd };
}

/* The page's own highest reachable scrollY, read off the sections' own rects rather than trusted
   from a separately-passed page height -- sections are contiguous, so the largest `top + height`
   among them IS the page's total content height. */
function pageMaxScroll(
  sectionRects: readonly SectionRect[],
  viewportHeight: number,
): number {
  let totalHeight = 0;
  for (const rect of sectionRects) {
    totalHeight = Math.max(totalHeight, rect.top + rect.height);
  }
  return Math.max(totalHeight - viewportHeight, 0);
}

/* Every section's own 0-1 progress at a given scroll position, in THREAD_IDS order -- the piece
   this file's three ramp shapes (`firstSectionProgress`/`crossingSectionProgress`/
   `terminalSectionProgress`) share, and what `drawnLength` below sums. Exported (alongside the sum)
   because "which sections are mid-ramp right now" is itself a testable claim -- "at most one
   section mid-ramp" (`thread-line.test.ts`) needs to inspect EACH section's own value, not just
   their combined total, and re-deriving that by hand-zeroing ranges in the test would only
   reproduce these same ramp shapes a second time, with its own chance to drift from them.

   `windowStart` threads sequentially through the loop: each section's ramp begins exactly where the
   previous one's ramp B ended (the first section uses `firstSectionProgress`), which is the mechanism
   behind "the next section's first piece waits": its ramp A cannot start before `windowStart`
   reaches it, and `windowStart` cannot advance until the previous section's crossing piece (or, for
   `wishes`, its own terminal ramp) has reported its `windowEnd`. */
export function sectionProgressAt(
  scrollY: number,
  viewportHeight: number,
  sectionRects: readonly SectionRect[],
  ranges: readonly SectionRange[],
  terminal: TerminalWindow = CHAIN_TERMINAL_WINDOW,
): number[] {
  const pageEnd = pageMaxScroll(sectionRects, viewportHeight);

  /* Resolved BEFORE the loop because the earlier sections' own ceiling depends on it: the terminal
     stretch's scroll has to come out of the same fixed page budget, so claiming it late would let
     two ramps overlap. `span` 0 leaves both at the page's own end, which is the chain's behaviour. */
  const terminalEnd = Math.max(0, pageEnd - Math.max(0, terminal.finish));
  const terminalStart =
    terminal.span > 0 ? Math.max(0, terminalEnd - terminal.span) : undefined;
  const earlierEnd = terminalStart ?? pageEnd;

  const progresses: number[] = [];
  let windowStart = 0;
  for (let i = 0; i < ranges.length; i++) {
    const rect = sectionRects[i];
    const range = ranges[i];
    if (rect === undefined || range === undefined) {
      progresses.push(0);
      continue;
    }

    if (range.id === "wishes") {
      const start = terminalStart ?? Math.min(windowStart, pageEnd);
      const { progress, windowEnd } = terminalSectionProgress(
        scrollY,
        start,
        terminalStart === undefined
          ? Math.min(rect.top + rect.height, pageEnd)
          : terminalEnd,
      );
      progresses.push(progress);
      windowStart = windowEnd;
      continue;
    }

    const clampedStart = Math.min(windowStart, earlierEnd);
    const { progress, windowEnd } =
      i === 0
        ? firstSectionProgress(scrollY, rect, earlierEnd)
        : crossingSectionProgress(
            scrollY,
            clampedStart,
            rect,
            range,
            earlierEnd,
          );

    progresses.push(progress);
    windowStart = windowEnd;
  }
  return progresses;
}

/* The total drawn length of the whole page's dash at a given scroll position: each section's own
   range contributes `progress * rangeLength`, and nothing more -- a section whose window has not
   opened yet contributes zero regardless of how far past it any LATER section already is, and a
   section fully behind keeps its full range regardless of how far the reader has since continued. */
export function drawnLength(
  scrollY: number,
  viewportHeight: number,
  sectionRects: readonly SectionRect[],
  ranges: readonly SectionRange[],
  terminal: TerminalWindow = CHAIN_TERMINAL_WINDOW,
): number {
  const progresses = sectionProgressAt(
    scrollY,
    viewportHeight,
    sectionRects,
    ranges,
    terminal,
  );
  let total = 0;
  for (let i = 0; i < ranges.length; i++) {
    const range = ranges[i];
    if (range === undefined) continue;
    total += progresses[i] * (range.end - range.start);
  }
  return total;
}

/* One piece's own local progress, over the SAME `drawn` scalar `drawnLength` above produces -- the
   whole fix, in one function. `piece.start`/`piece.end` are contiguous and disjoint by construction
   (`threadLine`'s own header), so at any given `drawn` at most one piece has `0 < progress < 1`:
   every piece whose `end <= drawn` reads 1, every piece whose `start >= drawn` reads 0, and the one
   piece straddling `drawn` (there is at most one, since the ranges partition [0, length]) reads the
   fraction in between. This is what "exactly one piece mid-draw" reduces to -- not a property of
   `drawnLength`'s own pacing curve, which pieces it favours moment to moment, but of the ranges
   being disjoint at all. */
export function pieceProgress(
  drawn: number,
  piece: { readonly start: number; readonly end: number },
): number {
  const length = piece.end - piece.start;
  return length <= 0 ? 1 : clamp01((drawn - piece.start) / length);
}

/* A piece's dash, as the two numbers the renderer sets. The offset scales by the whole PERIOD, not
   by `length` alone: `dasharray` overshoots the piece's own end by `DASH_EPSILON` so a
   fully-drawn piece never lands on the "stops short" case an exactly-matching dash hits, and scaling the offset by `length` instead would leave exactly that
   epsilon painted at progress 0 -- a seed of ink on every one of the nineteen pieces before any of
   them has begun. Lives here rather than in the component so the arithmetic is testable without a
   DOM. */
const DASH_EPSILON = 4;

export function dashForPiece(
  length: number,
  progress: number,
): { dasharray: number; dashoffset: number } {
  const period = length + DASH_EPSILON;
  return { dasharray: period, dashoffset: period * (1 - clamp01(progress)) };
}

/* THE RATCHET — the owner's "and then stay drawn". `drawnLength` above is a pure function of
   `scrollY` with no memory, and that is deliberate: it is what makes the whole sequencing testable
   without a browser. So the memory lives here instead, as a small piece of state the CALLER owns
   and threads its own scroll value through — one ratchet per component, never a module-level
   singleton, or `PageThread` and `CardThread` would share a maximum that means different things in
   their two different path lengths.

   `rebase` exists because a maximum is only meaningful against the layout it was measured in: a
   resize or a font load re-measures the page and changes the path's total length, and a maximum
   held over from the old one can exceed the new total, clamping every piece to fully drawn. It
   scales the peak by the two totals instead of discarding it, because discarding it is a visible
   defect on a phone -- a mobile URL bar fires `resize` DURING a scroll, so zeroing the peak let the
   thread un-draw itself every time a reader scrolled back up. A proportion survives a layout change;
   an absolute length does not. */
export function createDrawRatchet(): {
  advance: (drawn: number) => number;
  rebase: (oldTotal: number, newTotal: number) => void;
} {
  let peak = 0;
  return {
    advance(drawn: number): number {
      if (drawn > peak) peak = drawn;
      return peak;
    },
    rebase(oldTotal: number, newTotal: number): void {
      /* No old total means nothing has been measured yet, so there is no proportion to carry and
         any ratio would be Infinity. */
      peak = oldTotal > 0 ? (peak / oldTotal) * newTotal : 0;
    },
  };
}

/* The thread's total drawn length is the last range's end -- the same quantity a ratchet's peak is
   expressed in, which is what makes the two commensurable across a re-measure. */
export function totalLength(ranges: readonly SectionRange[]): number {
  return ranges[ranges.length - 1]?.end ?? 0;
}
