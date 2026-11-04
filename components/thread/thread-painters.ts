/* THE THREAD'S PAINTERS — what turns the arithmetic into the DOM: each piece's dash, and the
   elements of the drawing head, the frayed ends and the crossings. `PageThread` and `CardThread` each build their
   own painters. */

import {
  CROSSING_REACH,
  crossingRegion,
  LIFT_REACH,
  type OrderedCrossing,
} from "./thread-crossings.ts";
import { endCut, type FrayShape, placeFray } from "./thread-fray.ts";
import {
  HEAD_STEP_OVERLAP,
  type HeadOptions,
  type HeadSegment,
  headSegments,
  NEGLIGIBLE,
} from "./thread-head.ts";
import type { ThreadPiece } from "./thread-line.ts";
import { dashForPiece, pieceProgress } from "./thread-progress.ts";
import {
  frameAt,
  type PieceSamples,
  polylineBetween,
  samplePath,
} from "./thread-samples.ts";
import { reachOf } from "./thread-shadow-regions.ts";
import { CROSSING_LIFT } from "./thread-shadows.ts";
import { gapWidth, ropeGaps } from "./thread-twist.ts";

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
    /* A re-measure replaces every piece's `d`, so what was sampled describes a path that is gone. */
    reset() {
      samples.clear();
      hide();
    },
  };
}

export type HeadPainter = ReturnType<typeof createHeadPainter>;

/* ---------------------------------------------------------------------------------------------
   THE FRAYED ENDS — the cut cord and its fibres (`thread-fray.ts`; DESIGN.md -> Thread -> The frayed
   ends). An end at rest is built once, when the page is measured: the ink is cut back under the fray
   and the fibres wait at the cut. The moving tip
   is the same fibres, laid at the cord's end every frame.

   The cut is a `<mask>` on the piece's own `<path>`, and deliberately not a change to the piece: its
   `d` and its dash are what the draw-order gate reads, and "the light must not move the line" holds
   only while they stay exactly as `applyPieceDashes` writes them. */

interface FreeEnd {
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

function createFibres(group: SVGGElement, shape: FrayShape): SVGPathElement[] {
  return shape.fibres.map((fibre) => {
    const element = document.createElementNS(SVG_NS, "path");
    element.setAttribute("stroke-width", fibre.width.toFixed(3));
    group.append(element);
    return element;
  });
}

export function createEndFrayPainter(group: SVGGElement, cut: SVGPathElement) {
  /* The arc along the piece the ink has to reach before the fibres show: the cut for the invite's
     end, which the cord grows away from, and the piece's end for Wishes', which the cord reaches
     last. */
  let showFrom = Number.POSITIVE_INFINITY;

  return {
    set(end: FreeEnd | undefined, shape: FrayShape) {
      group.replaceChildren();
      cut.removeAttribute("d");
      group.style.display = "none";
      showFrom = Number.POSITIVE_INFINITY;
      if (end === undefined) return;
      const samples = samplePath(end.d, end.length);
      fitMaskRegion(cut, samples);
      if (!(shape.length > 0)) return;
      const span = endCut(end.endAt, end.length, end.direction, shape.length);
      cut.setAttribute("d", polylineBetween(samples, span.from, span.to));
      const cutAt = end.direction === 1 ? span.from : span.to;
      const frame = frameAt(samples, cutAt);
      const pointing = {
        x: frame.x + frame.tx * (cutAt - Math.floor(cutAt)),
        y: frame.y + frame.ty * (cutAt - Math.floor(cutAt)),
        tx: end.direction * frame.tx,
        ty: end.direction * frame.ty,
      };
      const ds = placeFray(shape, pointing);
      createFibres(group, shape).forEach((element, index) => {
        element.setAttribute("d", ds[index]);
      });
      showFrom = end.direction === 1 ? end.length : cutAt;
    },
    /* `painted` is how far along the end's piece the cord has reached. */
    paint(painted: number) {
      const display = painted >= showFrom - NEGLIGIBLE ? "" : "none";
      if (group.style.display !== display) group.style.display = display;
    },
  };
}

export type EndFrayPainter = ReturnType<typeof createEndFrayPainter>;

/* One per `<svg>`: draws the tip only while the cord's end lies in a piece this `<svg>` holds
   (`pathOf`), so the tip crosses the trunk's join with the card thread as the head does. */
export function createTipFrayPainter(
  group: SVGGElement,
  pathOf: (piece: number) => string | undefined,
  samples: Map<number, PieceSamples>,
) {
  let fibres: SVGPathElement[] = [];
  let built: FrayShape | undefined;

  function hide() {
    if (group.style.display !== "none") group.style.display = "none";
  }

  return {
    /* `cord` and `drawn` are on the chain's scale. Hidden once the line is whole, where the end at rest
       takes over, and while the cord is still inside the invite's own cut. */
    paint(
      cord: number,
      drawn: number,
      chain: readonly ThreadPiece[],
      shape: FrayShape,
      colour: string,
    ) {
      const total = chain[chain.length - 1]?.end ?? 0;
      if (drawn >= total - NEGLIGIBLE || cord <= shape.length) return hide();
      let index = chain.findIndex((piece) => cord <= piece.end);
      if (index === -1) index = chain.length - 1;
      const d = pathOf(index);
      if (d === undefined) return hide();
      const piece = chain[index];
      const length = piece.end - piece.start;
      let sampled = samples.get(index);
      if (sampled === undefined) {
        sampled = samplePath(d, length);
        samples.set(index, sampled);
      }
      if (built !== shape) {
        group.replaceChildren();
        fibres = createFibres(group, shape);
        built = shape;
      }
      const at = Math.min(length, cord - piece.start);
      const frame = frameAt(sampled, at);
      const step =
        at - Math.max(0, Math.min(Math.floor(at), Math.floor(length) - 1));
      const ds = placeFray(shape, {
        x: frame.x + frame.tx * step,
        y: frame.y + frame.ty * step,
        tx: frame.tx,
        ty: frame.ty,
      });
      fibres.forEach((element, fibre) => {
        setAttribute(element, "d", ds[fibre]);
        setAttribute(element, "stroke", colour);
      });
      if (group.style.display !== "") group.style.display = "";
    },
    /* A re-measure replaces every piece's `d`. */
    reset() {
      samples.clear();
      hide();
    },
  };
}

export type TipFrayPainter = ReturnType<typeof createTipFrayPainter>;

/* ---------------------------------------------------------------------------------------------
   CROSSINGS — where the line crosses itself, the upper strand is redrawn over the lower, with its
   own twist and a lift shadow that falls on the lower strand only (`thread-crossings.ts`; DESIGN.md ->
   Thread -> Crossings). Built once per measure, every element a `<path>` so the sway carries it with
   the line; a frame only shows the overlays whose passes are drawn. An overlay whose upper strand is
   the earlier pass lies over the head, so the tip passes under it; the rest lie under the head. */

export function createCrossingPainter(
  defs: SVGDefsElement,
  underHead: SVGGElement,
  overHead: SVGGElement,
) {
  let built: { group: SVGGElement; piece: number; from: number }[] = [];
  let made = 0;

  return {
    /* `own` says which chain pieces this `<svg>` holds; `local` maps a chain piece to its index here.
       `half` is half the cord's width and `sway` the most the sway moves a point. */
    measured(
      crossings: readonly OrderedCrossing[],
      samplesOf: (piece: number) => PieceSamples | undefined,
      local: (piece: number) => number | undefined,
      half: number,
      sway: number,
    ) {
      underHead.replaceChildren();
      overHead.replaceChildren();
      for (const element of defs.querySelectorAll(
        "[data-thread-crossing-defs]",
      ))
        element.remove();
      built = [];
      const source = document.getElementById(CROSSING_LIFT.id);
      const width = 2 * half;
      const reach = CROSSING_REACH * width;
      const lift = LIFT_REACH * width;
      for (const crossing of crossings) {
        const [upper, lower] =
          crossing.over === "first"
            ? [crossing.first, crossing.second]
            : [crossing.second, crossing.first];
        const upperSamples = samplesOf(upper.piece);
        const lowerSamples = samplesOf(lower.piece);
        const showPiece = local(crossing.second.piece);
        if (
          upperSamples === undefined ||
          lowerSamples === undefined ||
          showPiece === undefined ||
          local(crossing.first.piece) === undefined
        )
          continue;
        made += 1;
        const region = crossingRegion(
          crossing,
          reach,
          reachOf(CROSSING_LIFT) + sway,
        );
        const box = (element: Element) => {
          element.setAttribute("x", region.x.toFixed(1));
          element.setAttribute("y", region.y.toFixed(1));
          element.setAttribute("width", region.width.toFixed(1));
          element.setAttribute("height", region.height.toFixed(1));
        };
        const mask = document.createElementNS(SVG_NS, "mask");
        mask.id = `thread-crossing-mask-${made}`;
        mask.dataset.threadCrossingDefs = "";
        mask.setAttribute("maskUnits", "userSpaceOnUse");
        box(mask);
        const beneath = document.createElementNS(SVG_NS, "path");
        beneath.setAttribute(
          "d",
          polylineBetween(lowerSamples, lower.at - reach, lower.at + reach),
        );
        beneath.setAttribute("stroke", "white");
        beneath.setAttribute("stroke-width", width.toFixed(2));
        beneath.setAttribute("fill", "none");
        mask.append(beneath);
        defs.append(mask);
        let filterId = CROSSING_LIFT.id;
        if (source instanceof SVGFilterElement) {
          const copy = source.cloneNode(true) as SVGFilterElement;
          copy.id = `${source.id}-fit-${made}`;
          copy.dataset.threadCrossingDefs = "";
          copy.setAttribute("filterUnits", "userSpaceOnUse");
          box(copy);
          defs.append(copy);
          filterId = copy.id;
        }

        const group = document.createElementNS(SVG_NS, "g");
        group.dataset.threadCrossing = "";
        group.dataset.over = crossing.over;
        group.dataset.woven = String(crossing.woven);
        group.dataset.x = crossing.x.toFixed(1);
        group.dataset.y = crossing.y.toFixed(1);
        /* The earlier pass on top shows as the later pass reaches it, so the tip passes under it; the later
           pass on top shows once it has been drawn across the whole overlay, never ahead of its ink. */
        const from =
          crossing.over === "first"
            ? crossing.second.at - reach
            : crossing.second.at + reach;
        group.dataset.showPiece = String(showPiece);
        group.dataset.laterAt = crossing.second.at.toFixed(1);
        group.dataset.showFrom = from.toFixed(1);
        group.style.display = "none";
        const shade = document.createElementNS(SVG_NS, "g");
        shade.setAttribute("mask", `url(#${mask.id})`);
        const caster = document.createElementNS(SVG_NS, "path");
        caster.setAttribute(
          "d",
          polylineBetween(upperSamples, upper.at - lift, upper.at + lift),
        );
        caster.style.filter = `url(#${filterId})`;
        shade.append(caster);
        const strand = document.createElementNS(SVG_NS, "path");
        strand.setAttribute(
          "d",
          polylineBetween(upperSamples, upper.at - reach, upper.at + reach),
        );
        const gaps = document.createElementNS(SVG_NS, "path");
        gaps.setAttribute(
          "d",
          ropeGaps(
            upperSamples,
            upper.at - reach,
            upper.at + reach,
            upperSamples.length,
            half,
          ),
        );
        gaps.style.strokeWidth = `${gapWidth(half).toFixed(2)}px`;
        gaps.dataset.threadCrossingGaps = "";
        group.append(shade, strand, gaps);
        (crossing.over === "first" ? overHead : underHead).append(group);
        built.push({ group, piece: crossing.second.piece, from });
      }
    },
    /* `painted(piece)` is how far along a chain piece the cord has reached. */
    painted(painted: (piece: number) => number) {
      for (const { group, piece, from } of built) {
        const display = painted(piece) >= from - NEGLIGIBLE ? "" : "none";
        if (group.style.display !== display) group.style.display = display;
      }
    },
  };
}

export type CrossingPainter = ReturnType<typeof createCrossingPainter>;
