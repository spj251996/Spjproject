/* THE THREAD'S PAINTERS — what turns the arithmetic into the DOM: each piece's dash, and the
   elements of the drawing head, the re-trace and the tapered ends. `PageThread` and `CardThread`
   each build their own painters; `cardRetraces` is the one registry both share. */

import {
  HEAD_STEP_OVERLAP,
  type HeadOptions,
  type HeadSegment,
  headSegments,
} from "./thread-head.ts";
import type { ThreadPiece } from "./thread-line.ts";
import { dashForPiece, pieceProgress } from "./thread-progress.ts";
import { retraceFade, retraceGlow, retraceSegments } from "./thread-retrace.ts";
import {
  type PieceSamples,
  polylineBetween,
  samplePath,
} from "./thread-samples.ts";
import {
  TAPER_STEPS,
  type TaperSegment,
  taperCut,
  taperReached,
  taperSegments,
} from "./thread-taper.ts";
import type { TaperOptionsResolved } from "./thread-tokens.ts";

function applyDash(path: SVGPathElement, length: number, progress: number) {
  const { dasharray, dashoffset } = dashForPiece(length, progress);
  path.style.strokeDasharray = String(dasharray);
  path.style.strokeDashoffset = String(dashoffset);
}

function clearDash(path: SVGPathElement) {
  path.style.strokeDasharray = "";
  path.style.strokeDashoffset = "";
}

/* Drives every piece's own `<path>` from the ONE page-level `drawn` scalar -- `pieceProgress`
   (`thread-progress.ts`) is what makes "exactly one piece mid-draw" hold, by construction, from here:
   `pieces[k]` and `paths[k]` are index-aligned (`splitSubpaths(d)` emits one subpath per piece, in
   the same connection order `pieces` is built in -- proven at every band in
   `thread-line.test.ts`), so this loop never has to match them up by name. */
export function applyPieceDashes(
  paths: readonly (SVGPathElement | null)[],
  pieces: readonly ThreadPiece[],
  drawn: number,
) {
  pieces.forEach((piece, index) => {
    const path = paths[index];
    if (path === null || path === undefined) return;
    const length = piece.end - piece.start;
    applyDash(path, length, pieceProgress(drawn, piece));
  });
}

export function clearPieceDashes(paths: readonly (SVGPathElement | null)[]) {
  for (const path of paths) {
    if (path !== null) clearDash(path);
  }
}

/* ---------------------------------------------------------------------------------------------
   THE DRAWING HEAD — light laid over the leading end of the ink while a piece draws. The arithmetic
   is `thread-head.ts`'s and has no DOM; what is here is what needs one: keeping a pool of
   `<path>`s (the tokens are read in `thread-tokens.ts`).

   Each step of the head is a polyline through only its own run of the piece, never a dash on a copy
   of the whole piece. Measured: at equal radius and one grouped filter, dashed copies of whole pieces
   cost 54 dropped frames against 10 for the polylines. Inferred, not observed: that a dashed path's
   bounding box is the whole piece however short the visible dash is, so the head's halo filter
   processes far more than the head. A piece's points are computed from its own `d` (`samplePath`),
   once, the first time the head reaches it, and a frame slices those numbers. */

const SVG_NS = "http://www.w3.org/2000/svg";

/* How close to a piece's own end counts as being at it: a run is clipped to the piece's length, so
   this only absorbs floating-point rounding. */
const END_TOLERANCE = 0.01;

/* Writes an attribute only when it changed: the head repaints every frame, and re-setting an
   identical attribute still costs a call. */
function setAttribute(element: Element, name: string, value: string) {
  if (element.getAttribute(name) !== value) element.setAttribute(name, value);
}

/* One painter per `<svg>` that carries a share of the head. `pathOf` maps a piece's index in the
   WHOLE chain to that piece's `d` in this `<svg>`, or nothing when the piece lives in another
   one — so the trunk and the card thread call `paint` with the same chain and each draws its own runs,
   which is what lets the head cross the join between them. */
export function createHeadPainter(
  group: SVGGElement,
  pathOf: (piece: number) => string | undefined,
  samples: Map<number, PieceSamples> = new Map(),
) {
  const pool = new Map<string, SVGPathElement>();
  let shown = new Set<SVGPathElement>();

  /* Elements are kept in rank order as they are created, so paint order is the DOM order. A tight
     loop crosses itself, and the tip's step has to lie over the tail steps beneath it. */
  function elementFor(segment: HeadSegment): SVGPathElement {
    const key = `${segment.piece}:${segment.step}:${segment.cap}`;
    const existing = pool.get(key);
    if (existing !== undefined) return existing;
    const element = document.createElementNS(SVG_NS, "path");
    element.dataset.rank = String(segment.rank);
    element.setAttribute("stroke-linecap", segment.cap);
    const above = Array.from(group.children).find(
      (child) => Number((child as SVGElement).dataset.rank) > segment.rank,
    );
    group.insertBefore(element, above ?? null);
    pool.set(key, element);
    return element;
  }

  function hide() {
    for (const element of shown) element.style.display = "none";
    shown = new Set();
    group.style.display = "none";
  }

  function paintSegments(
    segments: readonly HeadSegment[],
    pieces: readonly ThreadPiece[],
  ) {
    const used = new Set<SVGPathElement>();
    for (const segment of segments) {
      const d = pathOf(segment.piece);
      if (d === undefined) continue;
      const piece = pieces[segment.piece];
      const length = piece.end - piece.start;
      let sampled = samples.get(segment.piece);
      if (sampled === undefined) {
        sampled = samplePath(d, length);
        samples.set(segment.piece, sampled);
      }
      const element = elementFor(segment);
      const continuesElsewhere =
        segment.piece + 1 < pieces.length &&
        pathOf(segment.piece + 1) === undefined &&
        segment.end >= length - END_TOLERANCE;
      setAttribute(
        element,
        "d",
        polylineBetween(
          sampled,
          segment.start,
          segment.end + (continuesElsewhere ? HEAD_STEP_OVERLAP : 0),
        ),
      );
      setAttribute(element, "stroke", segment.stroke);
      setAttribute(element, "stroke-width", segment.width.toFixed(3));
      if (element.style.display !== "") element.style.display = "";
      used.add(element);
    }
    for (const element of shown) {
      if (!used.has(element)) element.style.display = "none";
    }
    shown = used;
    group.style.display = used.size === 0 ? "none" : "";
  }

  return {
    paint(drawn: number, pieces: readonly ThreadPiece[], options: HeadOptions) {
      paintSegments(headSegments(drawn, pieces, options), pieces);
    },
    paintSegments,
    /* A re-measure replaces every piece's `d`, so what was sampled describes a path that is gone. */
    reset() {
      samples.clear();
      hide();
    },
    hide,
  };
}

export type HeadPainter = ReturnType<typeof createHeadPainter>;

/* ---------------------------------------------------------------------------------------------
   THE RE-TRACE — a lit segment that runs a stretch of the thread once it is already drawn
   (`thread-retrace.ts`; DESIGN.md -> Thread -> The re-trace). The arithmetic is `thread-retrace.ts`'s;
   what is here is what needs a DOM: the painters. The loop that drives them is `PageThread`'s, and
   the tokens are `thread-tokens.ts`'s.

   It is the head's own stack, laid again, so each stretch that is animating gets a `<g>` and the head's
   painter inside it. The painters share the head's samples, so a piece is sampled once whichever
   layer reaches it first. A second `<g>` per stretch, beneath it, holds the glow as translucent strokes
   (`thread-retrace.ts`); there is no filter on either. */

export interface RetraceFrame {
  readonly tail: number;
  readonly tip: number;
}

export function createRetracePainter(
  container: SVGGElement,
  glowContainer: SVGGElement,
  pathOf: (piece: number) => string | undefined,
  samples: Map<number, PieceSamples>,
) {
  const stretches = new Map<
    number,
    {
      element: SVGGElement;
      painter: HeadPainter;
      glowElement: SVGGElement;
      glowPainter: HeadPainter;
    }
  >();

  function stretchFor(index: number) {
    const existing = stretches.get(index);
    if (existing !== undefined) return existing;
    const element = document.createElementNS(SVG_NS, "g");
    element.dataset.threadRetraceGroup = String(index);
    container.append(element);
    const glowElement = document.createElementNS(SVG_NS, "g");
    glowElement.dataset.threadRetraceGlow = String(index);
    glowContainer.append(glowElement);
    const made = {
      element,
      painter: createHeadPainter(element, pathOf, samples),
      glowElement,
      glowPainter: createHeadPainter(glowElement, pathOf, samples),
    };
    stretches.set(index, made);
    return made;
  }

  return {
    /* One frame: the segment of each animating stretch, and every other stretch hidden. A stretch
       with no piece in THIS `<svg>` is hidden too and built nowhere: the trunk and the card thread are
       handed the same frames and each paints the share that lies in its own pieces, which is how the
       terminal's stretch reaches the card thread and the others reach the trunk. */
    paint(
      frames: ReadonlyMap<number, RetraceFrame>,
      pieces: readonly ThreadPiece[],
      options: HeadOptions,
    ) {
      const painted = new Set<number>();
      for (const [index, { tail, tip }] of frames) {
        const holdsAPiece = pieces.some(
          (piece, at) =>
            piece.end > tail && piece.start < tip && pathOf(at) !== undefined,
        );
        if (!holdsAPiece) continue;
        painted.add(index);
        const { element, painter, glowElement, glowPainter } =
          stretchFor(index);
        painter.paintSegments(
          retraceSegments(tail, tip, pieces, options),
          pieces,
        );
        glowPainter.paintSegments(
          retraceGlow(tail, tip, pieces, options.midColor),
          pieces,
        );
        const opacity = retraceFade(tip - tail, options.length);
        const value = opacity >= 1 ? "" : opacity.toFixed(3);
        if (element.style.opacity !== value) element.style.opacity = value;
        if (glowElement.style.opacity !== value) {
          glowElement.style.opacity = value;
        }
      }
      for (const [index, { painter, glowPainter }] of stretches) {
        if (painted.has(index)) continue;
        painter.hide();
        glowPainter.hide();
      }
    },
    hide() {
      for (const { painter, glowPainter } of stretches.values()) {
        painter.hide();
        glowPainter.hide();
      }
    },
  };
}

export type RetracePainter = ReturnType<typeof createRetracePainter>;

/* The re-trace is one loop for the whole page, driven by `PageThread`, but Wishes' stretch is drawn in
   `CardThread`'s own `<svg>`, whose pieces `PageThread`'s painter cannot reach. The card thread registers its
   painter here and the loop hands every registered painter the same frames: one clock, one budget and
   one thing to stop. */
export const cardRetraces = new Set<RetracePainter>();

/* ---------------------------------------------------------------------------------------------
   THE TAPERED ENDS — the invite's top terminal and Wishes' close come to a point. The arithmetic is
   `thread-taper.ts`'s; what is here is the DOM it needs.

   A taper is a stack of narrowing runs laid over a stretch of ink that has been cut away beneath
   them (a stroke cannot be thinned by drawing a narrower one over it). The cut is a `<mask>` on the
   piece's own `<path>`, and deliberately not a change to the piece: its `d` and its dash are what
   the draw-order gate reads, and "the light must not move the line" holds only while they stay
   exactly as `applyPieceDashes` writes them. The runs and the cut are built once, when the page is
   measured; a frame only shows the runs the ink has reached. */

interface TaperEnd {
  /* The `d` of the piece the end sits on, and its length from the model. */
  readonly d: string;
  readonly length: number;
  readonly endAt: number;
  readonly direction: -1 | 1;
}

/* The mask's region is the piece's own bounding box and a margin for the cap, not the whole svg:
   outside its region the masked ink is not painted at all, so the region must cover the piece, and
   it must be no larger than that. A region that covered every page the thread could span (100000px
   either way) made the page cost 27.1ms mean frame time and 116 dropped frames over the scrub
   against 17.0 and 6, although only three pieces carry a mask. */
const MASK_MARGIN = 4;

function fitMaskRegion(cut: SVGPathElement, { xy }: PieceSamples) {
  const mask = cut.parentElement;
  if (mask === null) return;
  let [left, top, right, bottom] = [xy[0], xy[1], xy[0], xy[1]];
  for (let i = 2; i < xy.length; i += 2) {
    left = Math.min(left, xy[i]);
    right = Math.max(right, xy[i]);
    top = Math.min(top, xy[i + 1]);
    bottom = Math.max(bottom, xy[i + 1]);
  }
  mask.setAttribute("x", String(left - MASK_MARGIN));
  mask.setAttribute("y", String(top - MASK_MARGIN));
  mask.setAttribute("width", String(right - left + 2 * MASK_MARGIN));
  mask.setAttribute("height", String(bottom - top + 2 * MASK_MARGIN));
}

export function createTaperPainter(group: SVGGElement, cut: SVGPathElement) {
  let runs: { element: SVGPathElement; segment: TaperSegment }[] = [];

  return {
    /* Replaces the taper for a new `d`: every run is built here, hidden until `paint` shows it. */
    set(
      end: TaperEnd | undefined,
      { taperLength, strokeWidth }: TaperOptionsResolved,
    ) {
      group.replaceChildren();
      runs = [];
      cut.removeAttribute("d");
      group.style.display = "none";
      if (end === undefined) return;
      const samples = samplePath(end.d, end.length);
      /* Fitted even when no taper is built below it (an unresolved length or width). The early return
         above is the one case that keeps the unmeasured region, and it cannot happen: both ends
         always exist. */
      fitMaskRegion(cut, samples);
      if (!(taperLength > 0) || !(strokeWidth > 0)) return;
      const span = taperCut(end.endAt, end.length, end.direction, taperLength);
      cut.setAttribute("d", polylineBetween(samples, span.from, span.to));
      for (const segment of taperSegments(
        end.endAt,
        end.length,
        end.direction,
        {
          steps: TAPER_STEPS,
          taperLength,
          strokeWidth,
        },
      )) {
        const element = document.createElementNS(SVG_NS, "path");
        element.setAttribute(
          "d",
          polylineBetween(samples, segment.start, segment.end),
        );
        element.setAttribute("stroke-width", segment.width.toFixed(3));
        element.style.display = "none";
        group.append(element);
        runs.push({ element, segment });
      }
    },
    /* `painted` is how far along the piece the ink has reached. */
    paint(painted: number) {
      let shown = 0;
      for (const { element, segment } of runs) {
        const visible = taperReached(segment, painted);
        const display = visible ? "" : "none";
        if (element.style.display !== display) element.style.display = display;
        if (visible) shown += 1;
      }
      const groupDisplay = shown === 0 ? "none" : "";
      if (group.style.display !== groupDisplay)
        group.style.display = groupDisplay;
    },
  };
}

export type TaperPainter = ReturnType<typeof createTaperPainter>;
