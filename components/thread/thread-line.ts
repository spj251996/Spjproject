/* Bakes the whole page's thread — every section's connectors and motifs, in the order the owner
   drew them — into ONE `d`, so a later component can drive the reveal from a single
   `stroke-dashoffset` and the line reads as one continuous stroke growing from the invite's free
   start to the wishes' exit (the owner's review, `session.md`'s "ONE line ... only ONE thing
   drawing at any moment"). Pure arithmetic on top of `thread-warp.ts`'s per-section warp: no DOM, no
   React, so it needs no render to test.

   CONNECTION ORDER is read from the data, not assumed: `thread-paths.ts`'s `THREAD_IDS` is the
   section order down the page — confirmed against `app/page.tsx`, whose `<InviteSection />
   <EventInfoSection /> <ContactSection /> <FamilySection /> <CelebrationsSection />
   <WishesSection />` renders in exactly that order. Within a section, N motifs give N+1 connectors
   (`thread-paths.ts`'s own per-section arrays are already sized this way): connector 0 runs from the
   section's own top (or the page's free start, for invite's very first connector) to motif 0's
   entry, connector k runs from motif k-1's exit to motif k's entry, and the last connector runs from
   the last motif's exit to the section's own bottom (or the next section's first motif, since a
   boundary-crossing connector is authored as one curve already sliced at the join —
   `thread-paths.ts`'s header). So the section's own `[connector, motif, connector, motif, ...,
   connector]` interleaving, repeated down `THREAD_IDS`, is already one connected path — but warping
   each stretch independently is not enough to keep it connected: a motif warps with a single uniform
   factor (to hold its own shape) while a connector warps per axis, and the authored data itself
   carries a small fitting residual at a section's own boundary, so BOTH kinds of join need the
   flexible side snapped onto the authoritative one after warping, not trusted as two independent
   copies of the same point (see the comments on `bakeMotif`'s neighbours and on the boundary loop in
   `threadLine` below for which side is authoritative and why). */

import { authoredCard } from "./thread-authored-layout.ts";
import { type BandId, THREAD_BANDS } from "./thread-bands.ts";
import type { SectionBox, ThreadId } from "./thread-geometry.ts";
import { MOTIFS } from "./thread-motifs.ts";
import {
  MOTIF_PLACEMENTS,
  type Placement,
  THREAD_IDS,
  THREAD_PATHS,
} from "./thread-paths.ts";
import {
  type MeasuredSection,
  type Rect,
  warpPlacement,
  warpSection,
} from "./thread-warp.ts";

export type ThreadLine = {
  d: string;
  length: number;
  /* Each section's contiguous stretch of `length`, in draw order — read off the SAME per-section
     groups `d` is built from, never re-derived by sampling the finished path. This is what lets
     `page-thread.tsx` map a section's own scroll progress onto "how much of the whole dash has
     drawn" without recomputing geometry it has already baked once here. */
  sections: readonly {
    id: Exclude<ThreadId, "not-found">;
    start: number;
    end: number;
  }[];
};

/* One optional anchor per placement, in the SAME order as `MOTIF_PLACEMENTS[band][id]` — `undefined`
   at an index means that placement takes the plain warped position, exactly today's behaviour. Kept
   generic (per section, per placement index) rather than naming `family`/`portraitLoop` here: the
   owner's anchoring requirement is Family's today, but the mechanism — translate a motif's warped
   centre onto a real measured element — has nothing Family-specific about it, and Task 4's caller is
   the one that knows which placement is which (by matching a real DOM rect to the nearest warped
   placement, since two `portraitLoop`s in one section are otherwise indistinguishable here). */
export type SectionAnchors = readonly (Rect | undefined)[];

const PATH_TOKEN = /[A-Za-z]|-?\d*\.?\d+(?:[eE][-+]?\d+)?/g;

type Point = { x: number; y: number };

/* A motif is drawn in its own 0-100 unit square (`thread-motifs.ts`) and carries a single
   scale-rotate[-mirror] onto the page. This is the SAME transform `thread-css.ts` (the stylesheet
   this component replaces) already applies as CSS `rotate`/`scale` on the motif's own field —
   confirmed against that file's live composition, not assumed: at identity (band's own nominal
   viewport, `place.turn`/`place.mirror` as authored), this formula lands the heart's entry point
   within 0.05px of `THREAD_PATHS.tall.invite`'s first connector's own recorded endpoint (44.49,
   417.61), and `family`'s first mirrored `portraitLoop` entry within 0.01px of that section's first
   connector endpoint (79.29, 397.4) — both read from `thread-paths.ts`, not typed by hand.

   CSS's individual transform properties compose in a fixed order regardless of declaration order —
   translate, then rotate, then scale — applied to a POINT that means scale (the mirror) runs first,
   then rotate, then the placement's own position. `side` is the motif's ABSOLUTE pixel side: the
   warped placement's `scale` is still the relative factor `warpPlacement` returns (matching
   `Placement.scale`'s own convention), so it is resolved against the SAME `bandBox` passed into
   `warpPlacement` — `warped.scale * Math.min(bandBox.width, bandBox.height)` — never the card or the
   section height (see `thread-warp.ts`'s `uniformScaleFactor` comment for why substituting either
   silently undersizes a whole band). */
function bakeMotifPoint(
  x: number,
  y: number,
  placement: Placement,
  side: number,
): Point {
  let lx = x / 100 - 0.5;
  const ly = y / 100 - 0.5;
  if (placement.mirror) lx = -lx;
  const radians = (placement.turn * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const rx = cos * lx - sin * ly;
  const ry = sin * lx + cos * ly;
  return { x: placement.x + rx * side, y: placement.y + ry * side };
}

/* A connector's own authored `d` ends exactly at its neighbouring motif's authored entry/exit point
   (`thread-paths.ts`'s header: a boundary is "sliced at the join it already passes through"). But
   `warpSection` warps a connector PER AXIS (`thread-warp.ts`'s x/y each carry their own ratio) while
   a motif's own points must warp with a single UNIFORM factor to hold its shape
   (`bakeMotifPoint`/`bakeMotif` above) — and those two ratios need not be equal on a real measured
   layout (a section's card width and its own height reflow independently). So the SAME authored
   point, warped both ways, lands at two different pixels whenever the layout is anisotropic; a
   synthetic layout with only a 5.9% width/height ratio difference already opens a ~0.1px gap at a
   motif's own entry, which the `d` cannot afford under the "one continuous line" requirement this
   module exists for.

   The motif's transform is the one that must not bend — Task 1's spike measured 0.0% aspect spread
   under it, against 82.9% for either axis-independent alternative. The connector's endpoint carries
   no such constraint, so IT yields: every connector point that touches a motif is snapped to that
   motif's own baked entry/exit point after both are computed, rather than trusted as an independent
   warp of the same authored coordinate. This is also the more literal reading of "connector k runs
   from motif k's exit to motif k+1's entry" — the connector's endpoint IS the motif's point, not a
   second, separately-derived copy of it. */
function tokenizePath(d: string): string[] {
  return d.match(PATH_TOKEN) ?? [];
}

function firstAndLastPoint(d: string): { first: Point; last: Point } {
  const tokens = tokenizePath(d);
  return {
    first: { x: Number(tokens[1]), y: Number(tokens[2]) },
    last: {
      x: Number(tokens[tokens.length - 2]),
      y: Number(tokens[tokens.length - 1]),
    },
  };
}

function withFirstPoint(d: string, point: Point): string {
  const tokens = tokenizePath(d);
  tokens[1] = String(point.x);
  tokens[2] = String(point.y);
  return tokens.join(" ");
}

function withLastPoint(d: string, point: Point): string {
  const tokens = tokenizePath(d);
  tokens[tokens.length - 2] = String(point.x);
  tokens[tokens.length - 1] = String(point.y);
  return tokens.join(" ");
}

function bakeMotif(
  motifD: string,
  placement: Placement,
  bandBox: SectionBox,
): string {
  const side = placement.scale * Math.min(bandBox.width, bandBox.height);
  const tokens = motifD.match(PATH_TOKEN) ?? [];
  let index = 0;

  function nextNumber(): number {
    const token = tokens[index++];
    const value = token === undefined ? NaN : Number(token);
    if (Number.isNaN(value)) {
      throw new Error(
        `thread-line: malformed motif path data (token ${index}) in "${motifD}"`,
      );
    }
    return value;
  }

  function bakedPointTokens(): string[] {
    const point = bakeMotifPoint(nextNumber(), nextNumber(), placement, side);
    return [String(point.x), String(point.y)];
  }

  const out: string[] = [];
  let command = "";
  while (index < tokens.length) {
    const token = tokens[index];
    if (/^[A-Za-z]$/.test(token)) {
      command = token;
      index++;
    }
    if (command === "M") {
      out.push("M", ...bakedPointTokens());
    } else if (command === "C") {
      out.push(
        "C",
        ...bakedPointTokens(),
        ...bakedPointTokens(),
        ...bakedPointTokens(),
      );
    } else {
      throw new Error(
        `thread-line: motif path uses unsupported command "${command}"`,
      );
    }
  }
  return out.join(" ");
}

/* No `getTotalLength()` exists off-DOM, so arc length is estimated by sampling each cubic at 256
   equal parameter steps and summing the resulting polyline's chord lengths — a systematic
   UNDERESTIMATE, since a chord is never longer than the arc it subtends. The error shrinks as
   1/samples^2 for a curve without a cusp (each sub-arc becomes flatter, and a flatter arc's
   chord-length deficit falls with the square of its own span); measured directly against this
   module's own output (the `wide`-band test fixture in `thread-line.test.ts`), going from 256 to 512
   samples per cubic moves the page's own total length of ~14208px by ~0.0042px, a relative change of
   ~0.00003% — so 256 is already several orders inside the 0.01px tolerance every other measurement in
   this file works to. */
const LENGTH_SAMPLES = 256;

function pointOnCubic(
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
  t: number,
): Point {
  const mt = 1 - t;
  const a = mt * mt * mt;
  const b = 3 * mt * mt * t;
  const c = 3 * mt * t * t;
  const d = t * t * t;
  return {
    x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
    y: a * p0.y + b * p1.y + c * p2.y + d * p3.y,
  };
}

function cubicLength(p0: Point, p1: Point, p2: Point, p3: Point): number {
  let length = 0;
  let previous = p0;
  for (let step = 1; step <= LENGTH_SAMPLES; step++) {
    const point = pointOnCubic(p0, p1, p2, p3, step / LENGTH_SAMPLES);
    length += Math.hypot(point.x - previous.x, point.y - previous.y);
    previous = point;
  }
  return length;
}

function pathLength(d: string): number {
  const tokens = d.match(PATH_TOKEN) ?? [];
  let index = 0;

  function nextPoint(): Point {
    const x = Number(tokens[index++]);
    const y = Number(tokens[index++]);
    return { x, y };
  }

  let length = 0;
  let current: Point = { x: 0, y: 0 };
  let command = "";
  while (index < tokens.length) {
    const token = tokens[index];
    if (/^[A-Za-z]$/.test(token)) {
      command = token;
      index++;
    }
    if (command === "M") {
      current = nextPoint();
    } else {
      const c1 = nextPoint();
      const c2 = nextPoint();
      const end = nextPoint();
      length += cubicLength(current, c1, c2, end);
      current = end;
    }
  }
  return length;
}

export function threadLine(
  band: BandId,
  sections: MeasuredSection[],
  anchors?: Partial<Record<Exclude<ThreadId, "not-found">, SectionAnchors>>,
): ThreadLine {
  if (sections.length !== THREAD_IDS.length) {
    throw new Error(
      `threadLine: expected ${THREAD_IDS.length} measured sections, one per THREAD_IDS entry (${THREAD_IDS.join(", ")}), got ${sections.length}`,
    );
  }

  const bandBox = THREAD_BANDS.find((candidate) => candidate.id === band)?.box;
  if (bandBox === undefined) {
    throw new Error(`threadLine: unknown band "${band}"`);
  }

  const perSection: string[][] = THREAD_IDS.map((id, index) => {
    const from = authoredCard(id, band);
    const to = sections[index];
    const connectors = THREAD_PATHS[band][id];
    const placements = MOTIF_PLACEMENTS[band][id];
    const sectionAnchors = anchors?.[id];

    const bakedMotifs = placements.map((placement, placementIndex) => {
      const anchor = sectionAnchors?.[placementIndex];
      const warped = warpPlacement(placement, from, to, bandBox, anchor);
      const bakedD = bakeMotif(MOTIFS[placement.motif].d, warped, bandBox);
      const { first, last } = firstAndLastPoint(bakedD);
      return { d: bakedD, entry: first, exit: last };
    });

    const group: string[] = [];
    connectors.forEach((connector, k) => {
      let d = warpSection(connector.d, from, to);
      if (k > 0) d = withFirstPoint(d, bakedMotifs[k - 1].exit);
      if (k < bakedMotifs.length) d = withLastPoint(d, bakedMotifs[k].entry);
      group.push(d);
      if (k < bakedMotifs.length) group.push(bakedMotifs[k].d);
    });
    return group;
  });

  /* A SECTION boundary has the same problem as a motif join, for a different reason: the two sides
     are warped against different `(from, to)` pairs (a section's own card can genuinely differ from
     its neighbour's — `thread-authored-layout.ts`'s `celebrations` row), and the authored data itself
     carries a small fitting residual at the slice (a boundary's closing coordinate is not always
     pinned to exactly its section's own authored height — e.g. `wide.celebrations`'s last connector
     ends at y=1319.78 of a 1320-unit section). Every section's FIRST connector, by contrast, starts
     at exactly authored (x, 0) with no such residual (true of every entry in `thread-paths.ts`), so
     its warp is the clean side of the join — the previous section's closing point is snapped to it,
     the same "prefer the side with no residual" rule the motif join above already applies. */
  for (let i = 0; i < perSection.length - 1; i++) {
    const thisGroup = perSection[i];
    const nextGroup = perSection[i + 1];
    const boundary = firstAndLastPoint(nextGroup[0]).first;
    const lastIndex = thisGroup.length - 1;
    thisGroup[lastIndex] = withLastPoint(thisGroup[lastIndex], boundary);
  }

  /* Boundaries are read off the SAME groups the `d` above is built from, section by section, in
     THREAD_IDS order -- never sampled from the finished string, which would be measuring the
     output rather than the thing that produced it. Summing each section's own sampled length and
     accumulating is the same arithmetic `pathLength` would do over the concatenated `d` (each
     curve's chord-sum contributes once either way), so `length` below equals the cumulative total
     by construction rather than by a second, potentially-drifting measurement. */
  const sectionLengths = perSection.map((group) => pathLength(group.join(" ")));
  let cursor = 0;
  const sectionRanges = THREAD_IDS.map((id, index) => {
    const start = cursor;
    cursor += sectionLengths[index];
    return { id, start, end: cursor };
  });

  const d = perSection.flat().join(" ");
  return { d, length: cursor, sections: sectionRanges };
}

/* ---------------------------------------------------------------------------------------------
   THE PIECEWISE PROGRESS MAP — replaces one global `scrollY / (scrollHeight - innerHeight)`
   (`page-thread.tsx`'s old `pageProgress`), which advanced the draw head at a constant rate through
   TOTAL PATH LENGTH. Total path length has no relationship to where a section's own scroll window
   falls, so every section crept forward at once instead of drawing in the order the reader reaches
   them (the owner's review, `session.md` 2026-09-27). This is a MAPPING fix only: still one path,
   one dash, one number -- only the function producing that number changes. */

/* Structurally identical to `MeasuredSection`'s `top`/`height` -- kept as its own minimal type
   rather than importing `MeasuredSection` so this stays a pure function over the two numbers it
   actually needs, with no dependency on `thread-warp.ts`'s card fields it never reads. */
export type SectionRect = { top: number; height: number };

export type SectionRange = {
  id: Exclude<ThreadId, "not-found">;
  start: number;
  end: number;
};

/* Owner decision, `session.md` 2026-09-27: a section's thread draws over roughly the first 60% of
   that section's own scroll window, then holds drawn for the remaining 40% -- chosen over drawing
   across the WHOLE window (the last stretch would still be advancing while the reader is already at
   the bottom of the card) and over a fast arrival gesture confined to the first 25%. */
const DRAW_FRACTION = 0.6;

/* One section's own scroll window is the distance between its top reaching the viewport's top
   (`rect.top`) and its bottom reaching the viewport's BOTTOM (`rect.top + rect.height -
   viewportHeight`) -- not the viewport's top, which would place the window's end past the page's
   own maximum scroll (`document.documentElement.scrollHeight - window.innerHeight`) for every
   section but the ones before the last. Ending each window at "my bottom meets the viewport's
   bottom" is what makes the LAST section's window end land exactly on that same maximum, which is
   the whole reason "at the page's end every section is full" holds without a separate clamp.

   A section no taller than the viewport (the common case -- most of this page's sections are
   authored as one `100svh` screen) makes this window zero-width or negative. Rather than dividing
   by that, it collapses to a single point at `rect.top`: undrawn right up to and including it,
   fully drawn the instant scroll passes it. STRICTLY past, not at-or-past: the non-degenerate ramp
   below already reads 0 exactly AT its own `windowStart` (`(scrollY - windowStart) / ... = 0` when
   `scrollY === windowStart`), and using `>=` here instead of `>` would break that same convention
   for the one section whose window starts at the very top of the page -- the invite's, at
   `rect.top === 0` -- reading it as already fully drawn at `scrollY === 0`, before the reader has
   scrolled at all. Caught on a real render, not in the synthetic tests below: every one of this
   file's own test fixtures happens to use a viewport shorter than every section, so none of them
   ever exercises this branch at `windowStart === 0`. A earlier round divided by a band this narrow
   and lost MONOTONICITY to it -- the thread briefly retracted, which read as flickering rather than
   as a sizing bug (`lessons.md`, 2026-09-25) -- so this is guarded explicitly, not left to fall out
   of the algebra. */
function sectionProgress(
  scrollY: number,
  viewportHeight: number,
  rect: SectionRect,
): number {
  const windowStart = rect.top;
  const windowEnd = rect.top + rect.height - viewportHeight;
  if (windowEnd <= windowStart) {
    return scrollY > windowStart ? 1 : 0;
  }
  const drawEnd = windowStart + DRAW_FRACTION * (windowEnd - windowStart);
  const progress = (scrollY - windowStart) / (drawEnd - windowStart);
  return Math.min(1, Math.max(0, progress));
}

/* The total drawn length of the whole page's dash at a given scroll position: each section's own
   range contributes `progress * rangeLength`, and nothing more -- a section whose window has not
   opened yet (`sectionProgress` 0) contributes zero regardless of how far past it any LATER section
   already is, and a section fully behind (`sectionProgress` 1) keeps its full range regardless of
   how far the reader has since continued. Sections are contiguous in both scroll order (each one's
   `rect.top` is the previous one's `rect.top + rect.height`) and path-length order (`threadLine`'s
   own `sections`), so summing every section's own contribution IS the whole page's monotonic
   progress -- there is no separate "which section is current" branch to get wrong. */
export function drawnLength(
  scrollY: number,
  viewportHeight: number,
  sectionRects: readonly SectionRect[],
  ranges: readonly SectionRange[],
): number {
  let total = 0;
  for (let i = 0; i < ranges.length; i++) {
    const rect = sectionRects[i];
    const range = ranges[i];
    if (rect === undefined || range === undefined) continue;
    const progress = sectionProgress(scrollY, viewportHeight, rect);
    total += progress * (range.end - range.start);
  }
  return total;
}
