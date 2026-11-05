/* Builds `components/thread/thread-paths.ts` from the owner's three drawn sheets.
 *
 * Ports the original `fit-motifs.mjs`'s rotation/centre fit, run fresh against each band's
 * CURRENT `connectors.json` (post type-relax), and additionally: converts every connector's drawn
 * polyline from page pixels into the section's own LOCAL pixel box (matching `thread-boxes.ts`'s
 * `sectionBox`), and fits a cubic-Bezier `d` string through it with `splinePath`, meeting a motif
 * on its own fitted heading.
 *
 * A connector that crosses a section boundary is fit ONCE, whole, in the page's global pixels —
 * never as two independently-fit halves meeting at a shared tangent, and never forced onto a vertical
 * tangent. The owner draws one continuous stroke down the page,
 * so the fitted curve already agrees with itself at the boundary; it is SLICED there afterwards
 * (`sliceFittedPath`), never re-fit, so both halves stay exactly what one curve already was. A free
 * page-end (before the first motif, after the last) is left with no forced tangent at all, which
 * the drawn sheet leaves loose on purpose.
 *
 * The owner drew the route once, on the page with every ritual's photo strip showing. The page can
 * ship with any of those strips missing, so the band is built once per combination of photographed
 * rituals (`adapt-photo-states.mjs` re-shapes the Celebrations stretch for each), and only the
 * sections that differ between combinations are emitted per combination.
 *
 * RUN ONCE PER DRAWING UPDATE. Its sources are `assets/thread/{wide,tall,upright}/`; the owner's
 * drawn sheets stay out of the repo (about 18MB of PNG) and the extracted JSON is what this reads.
 * A band's `retouch.json`, when it has one, holds the owner's nudges made on the rendered page
 * (`retouch.mjs`); they are applied to each section's piece of line before it is fit.
 *
 *   node scripts/thread/build-thread-paths.mjs    # -> components/thread/thread-paths.ts
 *
 * Regenerate into `tmp/` first, diff, then copy — `rules/generated-artifacts.md`. Diff the two
 * sides AFTER the formatter has run on both, or the raw output reads as hundreds of changed lines.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { THREAD_BANDS } from "../../components/thread/thread-bands.ts";
import {
  motifEnds,
  ringSquareCentre,
} from "../../components/thread/thread-line.ts";
import { MOTIFS } from "../../components/thread/thread-motifs.ts";
import { adaptCelebrations, BAND_SMOOTHING } from "./adapt-photo-states.mjs";
import { applyMoves, applyPen, checkPen, toState } from "./pen-marks.mjs";
import { checkEdits, editsFor, retouchPiece } from "./retouch.mjs";
import { boundSpans, MAX_SPAN, splinePath } from "./thread-spline.ts";

/**
 * @import { BandId } from "../../components/thread/thread-bands.ts"
 * @import { MotifId, Tangent } from "../../components/thread/thread-geometry.ts"
 * @import { EndTangents } from "./thread-spline.ts"
 * @import { Edit } from "./retouch.mjs"
 * @import { Pen } from "./pen-marks.mjs"
 * @typedef {{ x: number, y: number }} Point
 * @typedef {{ motif: string, x: number, y: number, scale: number, turn: number, mirror?: true }} Placement
 * @typedef {{ section: string, motifId: MotifId, mirror: boolean, turn: number, x: number, y: number, entryHeadingVector: Point, exitHeadingVector: Point, drawnEntryHeading: number, drawnExitHeading: number, entryPointGlobal: Point, exitPointGlobal: Point }} Fitted
 * @typedef {{ paths: Record<string, { d: string }[]>, placements: Record<string, Placement[]>, fitted: Fitted[] }} BandResult
 */

/* The five sections, in page order: what the owner drew against. */
const SECTION_ORDER = [
  "invite",
  "event-info",
  "family",
  "celebrations",
  "wishes",
];

/* Motifs the sheets showed reflected left to right, which the owner drew against (their sheet edit,
   2026-11-01: the heart mirrored). Fitted unreflected, the heart turned some 140 degrees to meet a
   line drawn for its reflection, and sat upside down. */
const DRAWN_MIRRORED = new Set(["heart"]);

/* The drawn line meets a motif some degrees off the motif's own tangent, which the spline would
   turn through within a pixel or two of the join. The last JOIN_EASE px of drawn line before a join
   give way to one gentle curve instead: it leaves the drawing along the drawing's own heading and
   arrives on the motif along the motif's tangent, so the turn is spread over the whole stretch.
   Never more than a third of a connector at either end. */
const JOIN_EASE = 60;

/**
 * A curve from `from`, heading `leave`, to `to`, heading `arrive`, sampled every few pixels.
 * @param {Point} from
 * @param {Point} leave unit vector
 * @param {Point} to
 * @param {Point} arrive unit vector
 */
function gentleCurve(from, leave, to, arrive) {
  const span = Math.hypot(to.x - from.x, to.y - from.y);
  const steps = Math.max(2, Math.ceil(span / 6));
  /** @type {Point[]} */
  const out = [];
  for (let k = 0; k <= steps; k += 1) {
    const t = k / steps;
    const h00 = 2 * t ** 3 - 3 * t ** 2 + 1;
    const h10 = t ** 3 - 2 * t ** 2 + t;
    const h01 = -2 * t ** 3 + 3 * t ** 2;
    const h11 = t ** 3 - t ** 2;
    out.push({
      x:
        h00 * from.x +
        h10 * leave.x * span +
        h01 * to.x +
        h11 * arrive.x * span,
      y:
        h00 * from.y +
        h10 * leave.y * span +
        h01 * to.y +
        h11 * arrive.y * span,
    });
  }
  return out;
}

/**
 * @param {Point[]} points the connector, its joined ends already on the motifs
 * @param {Point | undefined} startHeading the motif's exit tangent, where the connector leaves one
 * @param {Point | undefined} endHeading the motif's entry tangent, where it meets one
 */
function easedIntoMotifs(points, startHeading, endHeading) {
  const along = [0];
  for (let i = 1; i < points.length; i += 1)
    along.push(
      along[i - 1] +
        Math.hypot(
          points[i].x - points[i - 1].x,
          points[i].y - points[i - 1].y,
        ),
    );
  const length = along[along.length - 1];
  const reach = Math.min(JOIN_EASE, length / 3);
  const unit = (/** @type {Point} */ a, /** @type {Point} */ b) => {
    const d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    return { x: (b.x - a.x) / d, y: (b.y - a.y) / d };
  };
  let out = points;
  /* A join that must turn further needs longer to turn smoothly: a degree of turn adds a pixel of
     ease, up to half the connector. */
  const turnAt = (/** @type {Point} */ a, /** @type {Point} */ b) =>
    Math.acos(Math.max(-1, Math.min(1, a.x * b.x + a.y * b.y))) *
    (180 / Math.PI);
  if (endHeading) {
    const near = along.findLastIndex((s) => length - s >= reach);
    const approach =
      near > 0 ? unit(points[near], points[points.length - 1]) : endHeading;
    const k = along.findLastIndex(
      (s) =>
        length - s >=
        Math.min(length / 2, reach + turnAt(approach, endHeading)),
    );
    if (k > 0) {
      const curve = gentleCurve(
        out[k],
        unit(out[k - 1], out[k]),
        out[out.length - 1],
        endHeading,
      );
      out = [...out.slice(0, k), ...curve];
    }
  }
  if (startHeading) {
    const near = along.findIndex((s) => s >= reach);
    const departure = near > 0 ? unit(points[0], points[near]) : startHeading;
    const k = along.findIndex(
      (s) => s >= Math.min(length / 2, reach + turnAt(startHeading, departure)),
    );
    if (k > 0 && k < points.length - 1) {
      const target = points[k];
      const curve = gentleCurve(
        out[0],
        startHeading,
        target,
        unit(target, points[k + 1]),
      );
      const at = out.indexOf(target);
      if (at > 0) out = [...curve, ...out.slice(at + 1)];
    }
  }
  return out;
}

/* No drawn vertex is kept nearer a section boundary than this. */
const SPLIT_CLEARANCE = 4;

export const DIRS = {
  wide: "assets/thread/wide",
  tall: "assets/thread/tall",
  upright: "assets/thread/upright",
};

/* The owner's own tuned value, per band, set on a render and never derived. A first version of this
   script derived a motif's field size from the drawn ends' own separation instead of holding this
   fixed, which silently rescaled every
   motif by a different factor (heart 1.13x, rings 1.57x, bow 0.40x, …) — the drawn ends sit 4-30px
   off the authored attachment points, which is expected and fine for FITTING TURN AND CENTRE, but
   wrong for recovering a size that was never carried by that separation in the first place. `scale`
   is an INPUT to the fit, never an output of it.

   A motif/band cell with no `scale` in the source table is `undefined` here and takes
   `DEFAULT_SCALE`, named once below. */
/** @type {Record<BandId, Partial<Record<MotifId, number | undefined>>>} */
const SCALE = {
  tall: {
    heart: 0.2,
    rings: 0.25,
    knot: 0.25,
    portraitLoop: 0.35,
    bow: undefined,
  },
  wide: {
    heart: 0.3,
    rings: 0.28,
    knot: 0.2,
    portraitLoop: 0.2,
    bow: undefined,
  },
  upright: {
    heart: 0.2,
    rings: 0.25,
    knot: 0.25,
    portraitLoop: 0.25,
    bow: undefined,
  },
};

const DEFAULT_SCALE = 0.3;

/* `scale` multiplies `100svmin` of the band's OWN nominal viewport (`thread-bands.ts`'s `box`) —
   the field basis the drawn sheets were rendered against, in CSS px: `min(box.width, box.height)`.
   Confirmed against the coordinator's own expected renders (wide/heart 0.3 x 695 = 208.5,
   wide/rings 0.28 x 695 = 194.6). */
const SVMIN_BY_BAND = Object.fromEntries(
  THREAD_BANDS.map((band) => [
    band.id,
    Math.min(band.box.width, band.box.height),
  ]),
);

/** @param {number} r */
const deg = (r) => (r * 180) / Math.PI;
/** @param {number} d */
const rad = (d) => (d * Math.PI) / 180;
/** @param {number} n @param {number} [places] */
const round = (n, places = 2) => Math.round(n * 10 ** places) / 10 ** places;

/* A reflection about the drawing's own vertical axis: entry stays entry, but the direction of
   travel flips sign on x, which is `angle -> 180 - angle`, and the offset from the square's centre
   flips on x too. */
/** @param {Tangent} t */
function mirrorTangent(t) {
  return { x: 1 - t.x, y: t.y, angle: 180 - t.angle };
}

/** @param {number[]} anglesRad */
function circularMeanDegrees(anglesRad) {
  const s = anglesRad.reduce((sum, a) => sum + Math.sin(a), 0);
  const c = anglesRad.reduce((sum, a) => sum + Math.cos(a), 0);
  return deg(Math.atan2(s, c));
}

/* The direction of travel over a fixed reach from a stroke's own terminal — never the last segment
   alone, which can be a few pixels of skeleton noise. Matches `import-thread-drawing.mjs`'s own
   `headingAt`. */
/**
 * @param {Point[]} stroke
 * @param {"from" | "to"} which
 * @param {number} reach
 */
function headingAt(stroke, which, reach) {
  const anchor = /** @type {Point} */ (
    which === "from" ? stroke[0] : stroke.at(-1)
  );
  const order = which === "from" ? stroke : [...stroke].reverse();
  const away = /** @type {Point} */ (
    order.find((p) => Math.hypot(p.x - anchor.x, p.y - anchor.y) >= reach) ??
      order.at(-1)
  );
  return which === "from"
    ? deg(Math.atan2(away.y - anchor.y, away.x - anchor.x))
    : deg(Math.atan2(anchor.y - away.y, anchor.x - away.x));
}

/** @param {number} degrees */
function headingVector(degrees) {
  return { x: Math.cos(rad(degrees)), y: Math.sin(rad(degrees)) };
}

/* `p[i]` and `p[i+1]` bracket the boundary in y; linear interpolation is exact enough for a split
   point that then gets its own fitted spline either side of it. */
/**
 * @param {Point[]} points
 * @param {number} boundaryY
 */
function splitAtY(points, boundaryY) {
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    const above = a.y - boundaryY;
    const below = b.y - boundaryY;
    if ((above <= 0 && below >= 0) || (above >= 0 && below <= 0)) {
      const span = b.y - a.y;
      const t = span === 0 ? 0 : (boundaryY - a.y) / span;
      const split = { x: a.x + t * (b.x - a.x), y: boundaryY };
      return {
        before: [...points.slice(0, i + 1), split],
        after: [split, ...points.slice(i + 1)],
      };
    }
  }
  throw new Error(
    `connector never reaches y=${boundaryY} (range ${points[0].y}..${/** @type {Point} */ (points.at(-1)).y})`,
  );
}

/**
 * @param {Point[]} points
 * @param {EndTangents} ends
 */
function formatPath(points, ends) {
  const rounded = points.map((p) => ({ x: round(p.x), y: round(p.y) }));
  return splinePath(rounded, { ends });
}

/* `d`'s own numbers, in order: `M x y (C c1x c1y c2x c2y x y)*`. */
/** @param {string} d */
function numbersOf(d) {
  return [...d.matchAll(/-?\d+(?:\.\d+)?(?:e-?\d+)?/g)].map((m) =>
    Number(m[0]),
  );
}

/* Cuts a fitted `d` string into two, at the boundary between cubic segment `beforeCount - 1` and
   the next — WITHOUT re-fitting either half. This is what makes the two halves agree exactly: they
   are the same curve `splinePath` already produced for the FULL boundary-crossing stroke, merely
   split into two `<path>`s at a point that was already one of its own fitted vertices. Re-fitting
   each half on its own (the first version of this script did) gives each side its own Catmull-Rom
   arm length, sized from that side's OWN adjacent span — so even with an identical tangent forced
   at the shared point, the two curves peel away from it at different rates and the join still
   reads as a small kink a few pixels in. Slicing one curve has no such seam to begin with. */
/**
 * @param {string} d
 * @param {number} beforeCount
 */
function sliceFittedPath(d, beforeCount) {
  const n = numbersOf(d);
  const beforeNumbers = n.slice(0, 2 + beforeCount * 6);
  const afterNumbers = [
    n[2 + beforeCount * 6 - 2],
    n[2 + beforeCount * 6 - 1],
    ...n.slice(2 + beforeCount * 6),
  ];
  /** @param {number[]} nums */
  const toPath = (nums) => {
    const segments = [`M ${nums[0]} ${nums[1]}`];
    for (let i = 2; i + 5 < nums.length; i += 6) {
      segments.push(
        `C ${nums[i]} ${nums[i + 1]} ${nums[i + 2]} ${nums[i + 3]} ${nums[i + 4]} ${nums[i + 5]}`,
      );
    }
    return segments.join(" ");
  };
  return { before: toPath(beforeNumbers), after: toPath(afterNumbers) };
}

/* Every Y number in a `d` string (the odd-indexed ones, `x y` pairs throughout) shifted by a
   constant — converting a curve fit in GLOBAL page pixels into a section's own LOCAL box, which
   only ever differs from the page by how far down it starts. X needs no such shift: every
   section's box shares the page's own left edge and full width. */
/**
 * @param {string} d
 * @param {number} dy
 */
function shiftPathY(d, dy) {
  const n = numbersOf(d);
  const shifted = n.map((v, i) => (i % 2 === 1 ? round(v + dy) : round(v)));
  const segments = [`M ${shifted[0]} ${shifted[1]}`];
  for (let i = 2; i + 5 < shifted.length; i += 6) {
    segments.push(
      `C ${shifted[i]} ${shifted[i + 1]} ${shifted[i + 2]} ${shifted[i + 3]} ${shifted[i + 4]} ${shifted[i + 5]}`,
    );
  }
  return segments.join(" ");
}

/**
 * @typedef {{ section: string, motif: string, which: string, x: number, y: number, heading: number }} Attachment
 * @typedef {{ width: number, sections: { top: number, height: number }[] }} Geometry
 * @typedef {{ geometry: Geometry, attachments: Attachment[], connectors: { points: Point[] }[] }} BandData
 */

/**
 * `centre` is the ring drawing's square centre, placed so its loop sits on the portrait.
 * @typedef {{ centre: Point, turn: number, mirror: boolean }} Ring
 */

/* How far a ring's ends may sit off the drawn line, against how far its tangents may turn from the
   line's heading there: a degree of heading costs as much as half a pixel of distance. */
const RING_HEADING_WEIGHT = 0.5;
/* A pen stroke passes a ring when it comes this near the drawn line's end at the ring (page px). */
const RING_STROKE_REACH = 80;
/* Family's floor off type (`import-thread-drawing.mjs`), which a ring and its eased joins keep too. */
const RING_TYPE_FLOOR = 5;
const TYPE_PENALTY = 100;

/**
 * The nearest any type comes to the straight run from a to b.
 * @param {Point} a
 * @param {Point} b
 * @param {{ left: number, right: number, top: number, bottom: number }[]} glyphs
 */
function nearestTypeAlong(a, b, glyphs) {
  const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 2));
  let nearest = Infinity;
  for (let k = 0; k <= steps; k += 1) {
    const x = a.x + ((b.x - a.x) * k) / steps;
    const y = a.y + ((b.y - a.y) * k) / steps;
    for (const g of glyphs)
      nearest = Math.min(
        nearest,
        Math.hypot(
          Math.max(g.left - x, 0, x - g.right),
          Math.max(g.top - y, 0, y - g.bottom),
        ),
      );
  }
  return nearest;
}

/**
 * Fit every portrait ring as the page will place it — its loop centred on its portrait — and cut the drawn
 * line to it. The ring enters on one side of the portrait and leaves on the other; every turn and
 * both windings are tried, and the one whose two ends land nearest the line, heading the way the
 * line heads there, is kept. The line is then trimmed to end at the first and start again at the
 * second, so the connectors meet the ring where it really is.
 * @param {BandId} band
 * @param {Attachment[]} attachments
 * @param {Point[][]} lines one per connector, trimmed in place
 * @param {Point[]} portraits portrait centres, page pixels
 * @param {{ left: number, right: number, top: number, bottom: number }[]} glyphs line boxes of type
 * @returns {Map<number, Ring>} by motif index
 */
function fitRings(
  band,
  attachments,
  lines,
  portraits,
  glyphs,
  /** @type {Map<number, { turn: number, mirror: boolean }>} */ forced = new Map(),
) {
  /** @type {Map<number, Ring>} */
  const rings = new Map();
  const motif = MOTIFS.portraitLoop;
  const size =
    (SCALE[band].portraitLoop ?? DEFAULT_SCALE) * SVMIN_BY_BAND[band];
  /* The ring's own drawing, in its unit square, sampled along each cubic. */
  const n = numbersOf(motif.d);
  /** @type {Point[]} */
  const drawing = [{ x: n[0] / 100, y: n[1] / 100 }];
  for (let k = 2; k + 5 < n.length; k += 6) {
    const p0 = drawing[drawing.length - 1];
    for (let t = 1; t <= 6; t += 1) {
      const u = t / 6;
      const w = [
        (1 - u) ** 3,
        3 * (1 - u) ** 2 * u,
        3 * (1 - u) * u * u,
        u ** 3,
      ];
      drawing.push({
        x:
          (w[0] * p0.x * 100 +
            w[1] * n[k] +
            w[2] * n[k + 2] +
            w[3] * n[k + 4]) /
          100,
        y:
          (w[0] * p0.y * 100 +
            w[1] * n[k + 1] +
            w[2] * n[k + 3] +
            w[3] * n[k + 5]) /
          100,
      });
    }
  }
  const distance = (/** @type {Point} */ a, /** @type {Point} */ b) =>
    Math.hypot(a.x - b.x, a.y - b.y);
  /** @param {number} a @param {number} b */
  const apart = (a, b) => Math.abs(((((a - b) % 360) + 540) % 360) - 180);
  for (let i = 0; i < attachments.length; i += 2) {
    if (attachments[i].motif !== "portraitLoop") continue;
    const index = i / 2;
    const centre = portraits.reduce((a, b) =>
      distance(a, attachments[i]) <= distance(b, attachments[i]) ? a : b,
    );
    const line = [...lines[index], ...lines[index + 1]];
    /** @type {{ cost: number, ring: Ring, cutIn: number, cutOut: number } | null} */
    let best = null;
    const held = forced.get(index);
    for (const mirror of held ? [held.mirror] : [false, true]) {
      /* The ring's ends as the page draws them — trimmed at its tails — so a connector is joined
         where it will actually meet the ring. */
      const ends = motifEnds("portraitLoop");
      const entryTangent = mirror ? mirrorTangent(ends.entry) : ends.entry;
      const exitTangent = mirror ? mirrorTangent(ends.exit) : ends.exit;
      for (
        let turn = held ? held.turn : -180;
        held ? turn === held.turn : turn < 180;
        turn += 1
      ) {
        /* The ring's loop, not its drawing's square, sits on the photo. */
        const square = ringSquareCentre(centre, { turn, mirror }, size);
        /** @param {Tangent} t */
        const at = (t) => {
          const dx = t.x - 0.5;
          const dy = t.y - 0.5;
          const c = Math.cos(rad(turn));
          const si = Math.sin(rad(turn));
          return {
            x: square.x + (dx * c - dy * si) * size,
            y: square.y + (dx * si + dy * c) * size,
          };
        };
        const entry = at(entryTangent);
        const exit = at(exitTangent);
        let cutIn = 0;
        for (let k = 1; k < line.length; k += 1)
          if (distance(line[k], entry) < distance(line[cutIn], entry))
            cutIn = k;
        let cutOut = -1;
        for (let k = cutIn + 1; k < line.length; k += 1)
          if (
            cutOut === -1 ||
            distance(line[k], exit) < distance(line[cutOut], exit)
          )
            cutOut = k;
        if (cutOut === -1) continue;
        /* The connector eases from the ring's end to the drawn line JOIN_EASE further on; that run
           must keep off type like the rest of the line. */
        const easedTo = (
          /** @type {number} */ from,
          /** @type {number} */ step,
        ) => {
          let k = from;
          for (
            let run = 0;
            k + step >= 0 && k + step < line.length && run < JOIN_EASE;
            k += step
          )
            run += distance(line[k], line[k + step]);
          return line[k];
        };
        /* Where the portraits sit close, no turn keeps the whole ring off its neighbours' names, so
           touching type is a cost rather than a refusal: each sample of the ring or its eased joins
           under the floor costs TYPE_PENALTY px, and the turn that touches least wins. */
        const ringOnType = drawing.filter((q) => {
          const p = at({ x: mirror ? 1 - q.x : q.x, y: q.y, angle: 0 });
          return nearestTypeAlong(p, p, glyphs) < RING_TYPE_FLOOR;
        }).length;
        const joinsOnType =
          Number(
            nearestTypeAlong(entry, easedTo(cutIn, -1), glyphs) <
              RING_TYPE_FLOOR,
          ) +
          Number(
            nearestTypeAlong(exit, easedTo(cutOut, 1), glyphs) <
              RING_TYPE_FLOOR,
          );
        /* The join is eased over the JOIN_EASE px before and after the ring, so what the ring's
           tangents must agree with is the line's heading across that stretch, not at the cut. */
        const from = easedTo(cutIn, -1);
        const to = easedTo(cutOut, 1);
        const approach = deg(
          Math.atan2(line[cutIn].y - from.y, line[cutIn].x - from.x),
        );
        const departure = deg(
          Math.atan2(to.y - line[cutOut].y, to.x - line[cutOut].x),
        );
        const cost =
          TYPE_PENALTY * (ringOnType + 10 * joinsOnType) +
          distance(line[cutIn], entry) +
          distance(line[cutOut], exit) +
          RING_HEADING_WEIGHT *
            (apart(approach, entryTangent.angle + turn) +
              apart(departure, exitTangent.angle + turn));
        if (best === null || cost < best.cost)
          best = {
            cost,
            ring: { centre: square, turn, mirror },
            cutIn,
            cutOut,
          };
      }
    }
    if (best === null)
      throw new Error(`${band}: no ring fits portrait ${index}`);
    lines[index] = line.slice(0, best.cutIn + 1);
    lines[index + 1] = line.slice(best.cutOut);
    rings.set(index, best.ring);
  }
  return rings;
}

/**
 * Fit every motif to the drawing and every connector to a spline, per section.
 * @param {BandId} band
 * @param {BandData} data
 * @param {Fitted[] | null} [fits] motifs already fitted, used as they are
 * @param {Map<number, Ring>} [rings] portrait rings already fitted, by motif index
 * @returns {BandResult}
 */
function buildBand(
  band,
  { geometry, attachments, connectors },
  fits = null,
  rings = new Map(),
  /** @type {Edit[]} */ retouch = [],
  /** @type {{ pen: Pen, combination: string, place: (p: Point) => Point } | null} */ marks = null,
) {
  const sections = geometry.sections;
  if (sections.length !== SECTION_ORDER.length)
    throw new Error(
      `${band}: ${sections.length} sections, expected ${SECTION_ORDER.length}`,
    );
  const reach = Math.max(20, Math.round(geometry.width / 34));

  /* Each motif INSTANCE, in page order — family's two `portraitLoop`s are two separate instances,
     not two readings of one. */
  /** @type {{ entry: Attachment, exit: Attachment, section: string, motifId: MotifId }[]} */
  const motifs = [];
  for (let i = 0; i < attachments.length; i += 2) {
    const entry = attachments[i];
    const exit = attachments[i + 1];
    if (
      entry.which !== "entry" ||
      exit.which !== "exit" ||
      entry.motif !== exit.motif
    ) {
      throw new Error(`attachments.json is not entry/exit pairs at index ${i}`);
    }
    motifs.push({
      entry,
      exit,
      section: entry.section,
      motifId: /** @type {MotifId} */ (entry.motif),
    });
  }

  const fitted =
    fits ??
    motifs.map((m, index) => {
      const arriving = connectors[index]?.points;
      const leaving = connectors[index + 1]?.points;
      if (!arriving || !leaving) {
        throw new Error(
          `${band}/${m.section}/${m.motifId}: missing adjoining connector`,
        );
      }
      const drawnEntryHeading = headingAt(arriving, "to", reach);
      const drawnExitHeading = headingAt(leaving, "from", reach);

      /* The turn that fits is the circular mean of what each end asks for. A portrait ring may also be
       reflected (entry stays entry; every tangent t -> 180 - t), which reverses which way round it
       winds: the drawn line passes a ring one way or the other, and no rotation turns one into the
       other, so the ring takes whichever winding the line's two ends agree on. */
      /** @param {boolean} reflect */
      const fit = (reflect) => {
        const ends = motifEnds(m.motifId);
        const entryTangent = reflect ? mirrorTangent(ends.entry) : ends.entry;
        const exitTangent = reflect ? mirrorTangent(ends.exit) : ends.exit;
        const atEntry = rad(drawnEntryHeading - entryTangent.angle);
        const atExit = rad(drawnExitHeading - exitTangent.angle);
        const disagreement = Math.abs(
          Math.atan2(Math.sin(atEntry - atExit), Math.cos(atEntry - atExit)),
        );
        return {
          reflect,
          entryTangent,
          exitTangent,
          turn: circularMeanDegrees([atEntry, atExit]),
          disagreement,
        };
      };
      const ring = rings.get(index);
      const candidates = ring
        ? [{ ...fit(ring.mirror), turn: ring.turn }]
        : m.motifId === "portraitLoop"
          ? [fit(false), fit(true)]
          : [fit(DRAWN_MIRRORED.has(m.motifId))];
      const {
        reflect: mirror,
        entryTangent,
        exitTangent,
        turn,
      } = candidates.reduce((a, b) =>
        b.disagreement < a.disagreement ? b : a,
      );

      /* HELD FIXED — an input to the fit, never solved for. See `SCALE`'s own comment for why
       deriving it from the drawn ends' separation was wrong. */
      const size =
        (SCALE[band][m.motifId] ?? DEFAULT_SCALE) * SVMIN_BY_BAND[band];

      /** @param {Tangent} tangent */
      const place = (tangent) => {
        const dx = tangent.x - 0.5;
        const dy = tangent.y - 0.5;
        const c = Math.cos(rad(turn));
        const si = Math.sin(rad(turn));
        return { x: (dx * c - dy * si) * size, y: (dx * si + dy * c) * size };
      };
      const offEntry = place(entryTangent);
      const offExit = place(exitTangent);
      const endA = /** @type {Point} */ (arriving.at(-1));
      const endB = leaving[0];
      const globalCx = ring
        ? ring.centre.x
        : (endA.x - offEntry.x + (endB.x - offExit.x)) / 2;
      const globalCy = ring
        ? ring.centre.y
        : (endA.y - offEntry.y + (endB.y - offExit.y)) / 2;
      const sectionIndex = SECTION_ORDER.indexOf(m.section);

      return {
        section: m.section,
        motifId: m.motifId,
        mirror,
        turn,
        x: globalCx,
        y: globalCy - sections[sectionIndex].top,
        entryHeadingVector: headingVector(entryTangent.angle + turn),
        exitHeadingVector: headingVector(exitTangent.angle + turn),
        drawnEntryHeading,
        drawnExitHeading,
        /* The point the fit actually solved for, at the AUTHORED size — not `endA`/`endB`, which sit
         a few pixels off it (the drawn stroke's own imprecision). A connector's end is snapped onto
         this before it is fit, which is what closes that residual. */
        entryPointGlobal: {
          x: globalCx + offEntry.x,
          y: globalCy + offEntry.y,
        },
        exitPointGlobal: { x: globalCx + offExit.x, y: globalCy + offExit.y },
      };
    });

  /* One global chain of `motifs.length + 1` connectors: a free run before the first motif, one
     between every consecutive pair, and a free run after the last. A connector whose ends sit in
     different sections is the SAME drawn stroke crossing every boundary between them, so it is fit
     once, whole, and sliced at each boundary's exact y rather than assigned to either side. */
  /** @type {Record<string, { d: string }[]>} */
  const bySectionConnectors = {};
  for (const id of SECTION_ORDER) bySectionConnectors[id] = [];
  const sectionAt = (/** @type {number} */ y) =>
    Math.max(
      0,
      sections.findIndex((x) => y >= x.top && y < x.top + x.height),
    );

  /* Snapped onto the fit's own attachment point, not the raw drawn end, and eased into the motif. A
     free page-end has nothing to snap to and keeps its raw point. */
  const eased = connectors.map((connector, k) => {
    const before = k > 0 ? fitted[k - 1] : null;
    const after = k < fitted.length ? fitted[k] : null;
    const snapped = connector.points.map((p, i, arr) => {
      if (i === 0 && before) return before.exitPointGlobal;
      if (i === arr.length - 1 && after) return after.entryPointGlobal;
      return p;
    });
    return {
      points: easedIntoMotifs(
        snapped,
        before?.exitHeadingVector,
        after?.entryHeadingVector,
      ),
    };
  });
  /* The owner's pen marks were drawn on this line, eased into its motifs, so they land here. */
  const marked = marks
    ? applyPen(eased, marks.pen, marks.combination, marks.place)
    : eased;

  /** @type {Set<Edit>} */
  const applied = new Set();
  for (let k = 0; k < connectors.length; k += 1) {
    const before = k > 0 ? fitted[k - 1] : null;
    const after = k < fitted.length ? fitted[k] : null;
    const { points } = marked[k];
    const first = before
      ? SECTION_ORDER.indexOf(before.section)
      : sectionAt(points[0].y);
    const last = after
      ? SECTION_ORDER.indexOf(after.section)
      : sectionAt(/** @type {Point} */ (points.at(-1)).y);

    /** @type {Point[][]} one run of points per section the connector passes through */
    const pieces = [];
    let rest = points;
    for (let i = first + 1; i <= last; i += 1) {
      const split = splitAtY(rest, sections[i].top);
      /* A vertex crowding the split leaves a span of a pixel or two beside the boundary, whose
         control points, rounded to hundredths, tilt the tangent there by most of a degree. */
      const clear = (/** @type {Point} */ p) =>
        Math.hypot(p.x - split.after[0].x, p.y - split.after[0].y) >=
        SPLIT_CLEARANCE;
      pieces.push([...split.before.slice(0, -1).filter(clear), split.after[0]]);
      rest = [split.after[0], ...split.after.slice(1).filter(clear)];
    }
    pieces.push(rest);

    /* The owner's retouch lands on each piece by its index in its section's list — the index the
       piece is about to take there, since a connector leaves at most one piece in a section. */
    for (let i = 0; i < pieces.length; i += 1) {
      const id = SECTION_ORDER[first + i];
      const edits = editsFor(retouch, id, bySectionConnectors[id].length);
      for (const edit of edits) applied.add(edit);
      pieces[i] = retouchPiece(pieces[i], edits);
    }

    /* Fit the WHOLE stroke once and slice at each join (see the emitted header): pieces fitted
       separately each size their Catmull-Rom arm from their own adjacent span, which reads as a
       small kink even with a shared tangent. The slice index counts CUBICS in the fitted path, one
       per span of the BOUNDED point list, which is the pieces' bounded lists concatenated. */
    const combined = pieces.flatMap((piece, i) =>
      i === 0 ? piece : piece.slice(1),
    );
    let d = formatPath(combined, {
      start: before ? before.exitHeadingVector : undefined,
      end: after ? after.entryHeadingVector : undefined,
    });
    for (let i = 0; i < pieces.length; i += 1) {
      const id = SECTION_ORDER[first + i];
      const top = sections[first + i].top;
      if (i === pieces.length - 1) {
        bySectionConnectors[id].push({ d: shiftPathY(d, -top) });
        break;
      }
      const sliced = sliceFittedPath(
        d,
        boundSpans(pieces[i], MAX_SPAN).length - 1,
      );
      bySectionConnectors[id].push({ d: shiftPathY(sliced.before, -top) });
      d = sliced.after;
    }
  }

  retouch.forEach((edit, i) => {
    if (!applied.has(edit))
      throw new Error(
        `${band}: retouch edit ${i} names ${edit.section} piece ${edit.piece}, which this band does not have`,
      );
  });

  /** @type {Record<string, { d: string }[]>} */
  const paths = {};
  /** @type {Record<string, Placement[]>} */
  const placements = {};
  for (const id of SECTION_ORDER) {
    paths[id] = bySectionConnectors[id];
    placements[id] = fitted
      .filter((f) => f.section === id)
      .map((f) => ({
        motif: f.motifId,
        x: round(f.x),
        y: round(f.y),
        scale: SCALE[band][f.motifId] ?? DEFAULT_SCALE,
        turn: round(f.turn),
        ...(f.mirror ? { mirror: /** @type {const} */ (true) } : {}),
      }));
  }

  return { paths, placements, fitted };
}

/* The rituals in page order; a combination is written one character per ritual, "1" where it has
   photographs: "1111" is the page the owner drew on, "0000" the page with none. */
const RITUALS = 4;
const COMBINATIONS = Array.from({ length: 2 ** RITUALS }, (_, n) =>
  n.toString(2).padStart(RITUALS, "0"),
);

/**
 * The band built for every combination of photographed rituals. The connector through Celebrations
 * is re-shaped for the page without the missing strips; everything below Celebrations rises with
 * it, so every other section's own local geometry is unchanged.
 * @param {BandId} band
 * @param {string} dir
 */
/**
 * Everything about a band's photo states that the owner's retouch cannot change, worked out once:
 * the portrait rings, and each combination's page with Celebrations re-shaped — which is nearly all
 * of the build's time, so the retouch helper keeps this and rebuilds only from here on.
 * @param {BandId} band @param {string} dir
 * @param {Pen} [pen] read only for `refitRings`: the strokes past each ring turn it
 */
export function preparePhotoStates(band, dir, pen = {}) {
  const read = (/** @type {string} */ name) =>
    JSON.parse(readFileSync(`${dir}/${name}`, "utf8"));
  /** @type {Geometry} */
  const geometry = read("geometry.json");
  /** @type {Attachment[]} */
  const attachments = read("attachments.json");
  /** @type {{ points: Point[] }[]} */
  const connectors = read("connectors.json");
  const layout = read("photo-layout.json");
  /* The rings are fitted once, on the drawn page; Family is the same page in every combination. */
  const lines = connectors.map((c) => c.points.slice());
  /* Where the owner asked for the rings to be refitted, each ring is turned to fit the owner's
     stroke past it — scored as the drawn line is, with the stroke standing in for the line — and the
     drawn line is then cut against that turn. The stroke itself still lands on the eased line. */
  /** @type {Map<number, { turn: number, mirror: boolean }>} */
  const forced = new Map();
  if (pen.refitRings)
    for (let i = 0; i < attachments.length; i += 2) {
      if (attachments[i].motif !== "portraitLoop") continue;
      const index = i / 2;
      const into = /** @type {Point} */ (lines[index].at(-1));
      const past = (pen.strokes ?? [])
        .filter((s) => s.states.includes(COMBINATIONS[COMBINATIONS.length - 1]))
        .map((s) => ({
          s,
          d: Math.min(
            ...s.points.map((p) => Math.hypot(p.x - into.x, p.y - into.y)),
          ),
        }))
        .filter((c) => c.d < RING_STROKE_REACH)
        .sort((a, b) => a.d - b.d)[0];
      if (!past) continue;
      const fromEnd = (/** @type {Point} */ p) =>
        Math.min(...lines[index].map((q) => Math.hypot(q.x - p.x, q.y - p.y)));
      const stroke =
        fromEnd(past.s.points[0]) <=
        fromEnd(/** @type {Point} */ (past.s.points.at(-1)))
          ? past.s.points
          : past.s.points.slice().reverse();
      const alone = lines.map((l) => l.slice());
      alone[index] = stroke.slice();
      alone[index + 1] = [/** @type {Point} */ (stroke.at(-1))];
      const fitted = fitRings(
        band,
        attachments,
        alone,
        layout.portraits,
        layout.glyphs,
      ).get(index);
      if (fitted)
        forced.set(index, { turn: fitted.turn, mirror: fitted.mirror });
    }
  const rings = fitRings(
    band,
    attachments,
    lines,
    layout.portraits,
    layout.glyphs,
    forced,
  );
  const ringed = lines.map((points) => ({ points }));
  const celebrations = geometry.sections[SECTION_ORDER.indexOf("celebrations")];
  const through = ringed.findIndex(
    (c) =>
      c.points[0].y < celebrations.top &&
      /** @type {Point} */ (c.points.at(-1)).y >
        celebrations.top + celebrations.height,
  );
  if (through === -1)
    throw new Error(`${band}: no connector runs through Celebrations`);

  /* Only the stretch inside Celebrations is re-shaped: cut at the section's top and bottom, adapted
     with its ends pinned, and put back, so every other section keeps the drawing's own line. The
     adapted stretch comes back in the target page's pixels, above the old bottom, so the lift
     below moves only what follows it. */
  const bottom = celebrations.top + celebrations.height;
  /** @param {Point[]} points @param {number[]} removed */
  const reshaped = (points, removed) => {
    const upper = splitAtY(points, celebrations.top);
    const lower = splitAtY(upper.after, bottom);
    const inside = adaptCelebrations(
      lower.before,
      layout,
      removed,
      BAND_SMOOTHING[band],
    ).points;
    /* The boundary points themselves are dropped: the build splits at each boundary again, and a
       vertex lying exactly on one would leave a zero-length span there, whose heading is noise. */
    return [
      ...upper.before.slice(0, -1),
      ...inside.slice(1, -1),
      ...lower.after.slice(1),
    ];
  };

  const inputs = [...COMBINATIONS].reverse().map((combination) => {
    const removed = [...combination].flatMap((c, k) => (c === "0" ? [k] : []));
    const total = removed.length * layout.strip;
    const below = (/** @type {number} */ y) =>
      y >= celebrations.top + celebrations.height;
    /** @template {Point} P @param {P} p @returns {P} */
    const rise = (p) => ({ ...p, y: below(p.y) ? p.y - total : p.y });
    return {
      combination,
      removed,
      rise,
      geometry: {
        width: geometry.width,
        sections: geometry.sections.map((s, i) => {
          const id = SECTION_ORDER[i];
          if (id === "celebrations") return { ...s, height: s.height - total };
          return below(s.top) ? { ...s, top: s.top - total } : s;
        }),
      },
      attachments: attachments.map((a) => rise(a)),
      connectors: ringed.map((c, k) => ({
        points: (k === through ? reshaped(c.points, removed) : c.points).map(
          rise,
        ),
      })),
    };
  });
  return {
    band,
    rings,
    inputs,
    strip: layout.strip,
    layout,
  };
}

/**
 * Every combination's band, built from the prepared pages with the owner's pen marks and retouch
 * applied. The pen's marks sit on the drawn page; each combination takes them through its own
 * close-up of Celebrations.
 * @param {ReturnType<typeof preparePhotoStates>} prepared @param {Edit[]} retouch
 * @param {Pen} [pen]
 */
export function buildPhotoStates(
  { band, rings, inputs, strip, layout },
  retouch,
  pen = {},
) {
  /** @type {Record<string, BandResult>} */
  const states = {};
  /* Motifs are fitted once, on the page the owner drew; a combination only re-shapes Celebrations,
     which holds none, and raises everything below it. */
  /** @type {Fitted[] | null} */
  let drawnFits = null;
  for (const {
    combination,
    removed,
    rise,
    geometry,
    attachments: drawnAttachments,
    connectors: drawnConnectors,
  } of inputs) {
    const place = (/** @type {Point} */ p) => toState(p, layout, removed);
    const { connectors, attachments } = applyMoves(
      drawnConnectors,
      drawnAttachments,
      pen.moves,
      place,
    );
    const fits =
      drawnFits?.map((f) =>
        SECTION_ORDER.indexOf(f.section) > SECTION_ORDER.indexOf("celebrations")
          ? {
              ...f,
              entryPointGlobal: rise(f.entryPointGlobal),
              exitPointGlobal: rise(f.exitPointGlobal),
            }
          : f,
      ) ?? null;
    states[combination] = buildBand(
      band,
      { geometry, attachments, connectors },
      fits,
      rings,
      retouch,
      { pen, combination, place },
    );
    drawnFits ??= states[combination].fitted;
  }
  return { states, strip };
}

/**
 * The band's retouch file, or no edits when it has none.
 * @param {BandId} band @param {string} dir @returns {Edit[]}
 */
export function readRetouch(band, dir) {
  const file = `${dir}/retouch.json`;
  if (!existsSync(file)) return [];
  const edits = JSON.parse(readFileSync(file, "utf8"));
  checkEdits(band, edits, SECTION_ORDER);
  return edits;
}

/**
 * The band's pen marks, or none when it has no pen file.
 * @param {BandId} band @param {string} dir @returns {Pen}
 */
export function readPen(band, dir) {
  const file = `${dir}/pen.json`;
  if (!existsSync(file)) return {};
  const pen = JSON.parse(readFileSync(file, "utf8"));
  checkPen(band, pen);
  return pen;
}

/** @param {Record<string, { states: Record<string, BandResult>, strip: number }>} results */
export function emit(results) {
  const bandOrder = ["tall", "upright", "wide"];
  const DRAWN = COMBINATIONS[COMBINATIONS.length - 1];
  /* A section is emitted per combination only where some combination changes it; placements never
     may, since only Celebrations, which holds no motif, is re-shaped. */
  /** @type {Record<string, string[]>} */
  const varying = {};
  for (const band of bandOrder) {
    const { states } = results[band];
    varying[band] = SECTION_ORDER.filter((id) =>
      COMBINATIONS.some(
        (c) =>
          JSON.stringify(states[c].paths[id]) !==
          JSON.stringify(states[DRAWN].paths[id]),
      ),
    );
    for (const c of COMBINATIONS)
      if (
        JSON.stringify(states[c].placements) !==
        JSON.stringify(states[DRAWN].placements)
      )
        throw new Error(
          `${band}/${c}: a motif placement moved with the photo strips`,
        );
  }
  /** @param {unknown} v */
  const jsonPath = (v) => JSON.stringify(v);

  /** @param {string} id @param {{ d: string }[]} list */
  const connectorEntry = (id, list) =>
    `      ${jsonPath(id)}: [\n${list.map((c) => `        { d: ${jsonPath(c.d)} },`).join("\n")}\n      ],`;
  /** @param {string} id @param {Placement[]} list */
  const placementEntry = (id, list) =>
    `      ${jsonPath(id)}: [\n${list
      .map(
        (p) =>
          `        { motif: ${jsonPath(p.motif)}, x: ${p.x}, y: ${p.y}, scale: ${p.scale}, turn: ${p.turn}${
            p.mirror ? ", mirror: true" : ""
          } },`,
      )
      .join("\n")}\n      ],`;

  const pathsBody = bandOrder
    .map(
      (band) =>
        `    ${band}: {\n${SECTION_ORDER.map((id) => connectorEntry(id, results[band].states[DRAWN].paths[id])).join("\n")}\n    },`,
    )
    .join("\n");
  const placementsBody = bandOrder
    .map(
      (band) =>
        `    ${band}: {\n${SECTION_ORDER.map((id) => placementEntry(id, results[band].states[DRAWN].placements[id])).join("\n")}\n    },`,
    )
    .join("\n");

  const statesBody = bandOrder
    .map(
      (band) =>
        `    ${band}: {\n${COMBINATIONS.map(
          (c) =>
            `      ${jsonPath(c)}: {\n${varying[band]
              .map((id) =>
                connectorEntry(id, results[band].states[c].paths[id]).replace(
                  /^ {6}/gm,
                  "        ",
                ),
              )
              .join("\n")}\n      },`,
        ).join("\n")}\n    },`,
    )
    .join("\n");
  const perBand = (/** @type {(band: string) => number} */ value) =>
    bandOrder.map((band) => `  ${band}: ${value(band)},`).join("\n");

  return `/* Generated by \`scripts/thread/build-thread-paths.mjs\` from the authored geometry in
   \`assets/thread/{wide,tall,upright}/\` — see that script for the fit and the boundary split.
   That JSON was extracted from the owner's three drawn sheets, which are ~18MB of PNG and are
   held outside the repo; the JSON is the source of record here. Re-run the generator after any
   re-drawing; do not hand-edit the numbers below.

   Every connector's \`d\` and every placement's \`x\`/\`y\` are in the SAME per-section pixel box
   \`thread-boxes.ts\`'s \`sectionBox\` describes: x from the section's left edge, y from the
   section's own top. A motif is met on its own tangent turned by \`turn\`, the fitted absolute
   angle described below. A SECTION BOUNDARY is not met on any authored tangent at all. The owner
   draws one continuous stroke down the page, so a
   boundary-crossing connector is fit ONCE, whole, then sliced at the join it already passes
   through; both halves below are exactly what one curve already was, never two curves independently
   aimed at the same point. A free page-end (before the very first motif, after the very last)
   carries no forced tangent either — the drawn sheet leaves it loose, not resting on the page's own
   top or bottom edge.

   \`turn\` is an ABSOLUTE authored angle in the section's own pixels, not \`nudge + splineDirection\`
   — deriving it from the route drifted the moment a section's own layout changed under it, which is
   the drift the owner reported. It and the motif's centre are FITTED to the drawing: a motif's two
   attachment points are fixed offsets from its centre and each carries a tangent, so turning the
   motif turns both together, and the turn that fits is the circular mean of (drawn heading minus
   the motif's own declared angle) at both ends. Scale is NOT fitted — it is the owner's own tuned
   value, carried forward unchanged.

   A \`portraitLoop\` carries \`mirror: true\` where the drawn line passes its ring the other way
   round: a reflection (entry stays entry; every tangent \`t -> 180-t\`) reverses which way the
   ring winds, which no rotation can, and each ring takes the winding its two drawn ends agree on. */
import type { BandId } from "./thread-bands.ts";
import type { MotifId, ThreadId } from "./thread-geometry.ts";

/* The five sections, in page order. \`thread-line.ts\` composes in this order and
   \`thread-measure.ts\`'s \`measureSections\`, called by \`PageThread\`, measures one section per entry,
   so a route rendering a different count draws no thread. */
export const THREAD_IDS: readonly ThreadId[] = [
${SECTION_ORDER.map((id) => `  ${JSON.stringify(id)},`).join("\n")}
];

export type Connector = { d: string };

export type Placement = {
  motif: MotifId;
  x: number;
  y: number;
  scale: number;
  turn: number;
  mirror?: boolean;
};

type BySection<T> = Record<ThreadId, T>;

export const THREAD_PATHS: Record<BandId, BySection<Connector[]>> = {
${pathsBody}
};

export const MOTIF_PLACEMENTS: Record<BandId, BySection<Placement[]>> = {
${placementsBody}
};

/* \`THREAD_PATHS\` is the page the owner drew on, every ritual photographed. A combination of
   photographed rituals — one character per ritual in page order, "1" where it has photographs —
   replaces only the sections it changes; \`PHOTO_STRIP\` is the height one ritual's strip adds to
   Celebrations. */
export type PhotoCombination = string;

export const PHOTO_STATE_PATHS: Record<
  BandId,
  Record<PhotoCombination, Partial<BySection<Connector[]>>>
> = {
${statesBody}
};

export const PHOTO_STRIP: Record<BandId, number> = {
${perBand((band) => results[band].strip)}
};
`;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  /** @type {Record<string, { states: Record<string, BandResult>, strip: number }>} */
  const results = {};
  for (const [band, dir] of Object.entries(DIRS)) {
    const id = /** @type {BandId} */ (band);
    const pen = readPen(id, dir);
    results[band] = buildPhotoStates(
      preparePhotoStates(id, dir, pen),
      readRetouch(id, dir),
      pen,
    );
  }

  writeFileSync("components/thread/thread-paths.ts", emit(results));

  console.log(
    `\n=== fitted turn, all ${Object.keys(MOTIFS).length} motifs x 3 bands ===`,
  );
  for (const band of Object.keys(DIRS)) {
    console.log(`\n-- ${band} --`);
    for (const f of results[band].states[COMBINATIONS[COMBINATIONS.length - 1]]
      .fitted) {
      console.log(
        `  ${f.section.padEnd(13)} ${f.motifId.padEnd(13)} turn ${f.turn.toFixed(2).padStart(8)}` +
          `${f.mirror ? "  (mirrored)" : ""}`,
      );
    }
  }
}
