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
import type { MotifId, SectionBox, ThreadId } from "./thread-geometry.ts";
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
  /* Each GROUP's contiguous stretch of `length`, in draw order — read off the SAME per-section
     groups `d` is built from, never re-derived by sampling the finished path. A section with no
     measured subdivision is exactly one group covering its own whole rect (every section, before
     this file supported subdivision at all, and still every section this page never measures a
     card/row split for — `invite`/`contact`/`wishes`); a section whose caller hands in two or more
     real card/row rects (`subdivisions` below) can split into MORE than one entry here, one per
     card or ritual row its own pieces' geometry actually sits in (`assignRectIndex`'s own header).
     `id` still names the OWNING SECTION, not a group identity of its own — nothing downstream needs
     to tell two groups of the same section apart by anything other than array position, and the
     `id === "wishes"` terminal check (`drawnLength` below) only needs to find wishes' own (always
     single) group. This is what lets `page-thread.tsx` map a scroll position onto "how much of the
     whole dash has drawn" per WINDOW rather than per section, without recomputing geometry it has
     already baked once here. */
  sections: readonly SectionRange[];
  /* `groupRects[i]` is `sections[i]`'s own scroll window — the measured card/row rect its pieces
     were assigned against, or the section's own `{top, height}` when no subdivision applied. Kept
     as its own array, index-aligned with `sections`, rather than folded into `SectionRange` itself:
     every existing caller of `sectionProgressAt`/`drawnLength` already takes a rects array and a
     ranges array as two separate parameters (see those functions' own signatures, unchanged by this
     addition), so a synthetic test can go on constructing hand-picked ranges without also having to
     invent a rect for each one. */
  groupRects: readonly SectionRect[];
  /* ONE PIECE PER connector and per motif, in draw order, over the SAME cumulative scale as
     `length`/`sections` — the fix for the finding that supersedes the previous architecture:
     `stroke-dasharray` restarts at every `M` subpath, so a single dash driving a `d` that holds 19
     subpaths (the main path, `wishes` excluded — its own weave copy carries the other 3) produced
     19 simultaneous draw heads rather than one (`task-1-report.md`). `page-thread.tsx` and
     `WishesWeave` give each piece its OWN `<path>` and its OWN dash, computed from its own
     `[start, end)` here — contiguous and disjoint by construction, which is what makes "exactly one
     piece mid-draw" true without a second rule to keep in sync (see `pieceProgress` below). */
  pieces: readonly ThreadPiece[];
};

/* One entry per GROUP now, not strictly one per THREAD_ID section — see `ThreadLine.sections`'s own
   header for why that generalisation is backward compatible with every caller that never asks for a
   subdivision. */
export type SectionRange = {
  id: Exclude<ThreadId, "not-found">;
  start: number;
  end: number;
  /* The length of this GROUP's own LAST piece. For an un-split section this is always a connector
     (every section ends with one more connector than it has motifs), matching this field's original
     meaning exactly; for a group formed by a card/row split, the group's own last piece can be
     whichever piece (connector or motif) happens to fall before the geometry crosses into the next
     card or row. Needed only for the 75%/25% crossing rule (`drawnLength` below): the owner's anchor
     is stated as a fraction of THIS piece, not of the group as a whole, so the group-level progress
     fraction that reproduces it depends on how much of the group's own total length that one piece
     is. */
  lastPieceLength: number;
};

/* A group's own scroll window, in the SAME page-absolute pixel space every `MeasuredSection` and
   `Rect` here already uses. Shares its shape with `MeasuredSection`'s own `top`/`height` fields
   (see that type's comment in `thread-warp.ts`) but is declared fresh rather than importing it, so
   this stays the minimal shape the progress-ramp functions below actually read — neither a card's
   `cardLeft`/`cardWidth` nor an x-axis at all ever enters a vertical scroll calculation. */
export type SectionRect = { top: number; height: number };

/* One real card/row rect per placement WITHIN a section — `event-info` and `family` hand in their
   two `.mounted-sheet-frame__leaf` rects, `celebrations` hands in one rect per `[data-thread-row]`
   ritual row, page-absolute, top-to-bottom in DOM order (which is also draw order: a stacked pair's
   leaves and a ritual list's rows both render top-to-bottom in the document regardless of whether
   CSS currently lays them out side by side). A section absent from this map, or present with fewer
   than two rects, takes no split — the section's own whole rect is used instead, precisely today's
   behaviour (`threadLine`'s own `windowRects` fallback). Kept generic over EVERY section rather than
   naming `event-info`/`family`/`celebrations` in the type itself: the measuring caller
   (`page-thread.tsx`) is the one that knows which sections actually have a stackable pair or a row
   list this band, and a section this page never subdivides simply never appears here. */
export type SectionSubdivisions = Partial<
  Record<Exclude<ThreadId, "not-found">, readonly SectionRect[]>
>;

export type ThreadPiece = {
  id: Exclude<ThreadId, "not-found">;
  kind: "connector" | MotifId;
  start: number;
  end: number;
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

/* PORTRAIT LOOP TAIL TRIM — the owner's ask (`session.md` 2026-09-27): "can we trim the entry/exit
   tails of the motif so that connectors don't do weird turns there?" `portraitLoop`'s own drawn
   tails run nearly flat (entry angle -0.4deg, exit -29.8deg — `thread-motifs.ts`) before curving into
   the loop proper, while the connectors either side of it were authored against those FULL,
   untrimmed endpoints — measured on the real rendered page (Task 3's own baseline), the join turns
   30-117 degrees at every band, far past what that shallow authored tangent alone would predict.
   Dropping a fraction of the motif's own arc at each end moves the point the connector meets
   further round the loop's curve, onto ink closer to the connector's actual angle of approach.

   Scoped to `portraitLoop` ONLY, at composition time — `thread-motifs.ts`'s seven drawings are
   owner-confirmed and off limits (`heart` is part-traced and part-composed by hand; re-tracing it
   would silently undo that hand work). ONE number, tunable on a render — the owner chose this over
   editing the drawing for exactly that reason.

   Trimming runs on the motif's own UNBAKED 0-100 curve, before `bakeMotifPoint`'s rotate-scale-
   translate — so the existing transform (a single scalar `side`, this function's own docs below) is
   applied to a shorter curve exactly as it is applied to the full one, and cannot itself introduce a
   non-uniform squash: dropping arc length changes WHICH points get transformed, never how they do. */
export const PORTRAIT_LOOP_TRIM_FRACTION = 0.12;

function bakeMotif(
  motifD: string,
  placement: Placement,
  bandBox: SectionBox,
): string {
  const side = placement.scale * Math.min(bandBox.width, bandBox.height);
  const d =
    placement.motif === "portraitLoop"
      ? trimMotifTails(motifD, PORTRAIT_LOOP_TRIM_FRACTION)
      : motifD;
  const tokens = d.match(PATH_TOKEN) ?? [];
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

type CubicSeg = { p0: Point; p1: Point; p2: Point; p3: Point };

function parseCubicChain(d: string): CubicSeg[] {
  const tokens = d.match(PATH_TOKEN) ?? [];
  let index = 0;

  function nextPoint(): Point {
    const x = Number(tokens[index++]);
    const y = Number(tokens[index++]);
    return { x, y };
  }

  let command = "";
  let current: Point = { x: 0, y: 0 };
  const segments: CubicSeg[] = [];
  while (index < tokens.length) {
    const token = tokens[index];
    if (/^[A-Za-z]$/.test(token)) {
      command = token;
      index++;
    }
    if (command === "M") {
      current = nextPoint();
    } else if (command === "C") {
      const p1 = nextPoint();
      const p2 = nextPoint();
      const p3 = nextPoint();
      segments.push({ p0: current, p1, p2, p3 });
      current = p3;
    } else {
      throw new Error(`trimMotifTails: unsupported command "${command}"`);
    }
  }
  return segments;
}

function reverseSeg(seg: CubicSeg): CubicSeg {
  return { p0: seg.p3, p1: seg.p2, p2: seg.p1, p3: seg.p0 };
}

/* de Casteljau split: exact for any `t`, unlike the arc-length SEARCH that locates `t`
   (`paramAtLength` below) — the split itself introduces no approximation of its own. */
function splitCubicAt(
  seg: CubicSeg,
  t: number,
): { left: CubicSeg; right: CubicSeg } {
  const lerp = (a: Point, b: Point): Point => ({
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  });
  const p01 = lerp(seg.p0, seg.p1);
  const p12 = lerp(seg.p1, seg.p2);
  const p23 = lerp(seg.p2, seg.p3);
  const p012 = lerp(p01, p12);
  const p123 = lerp(p12, p23);
  const p0123 = lerp(p012, p123);
  return {
    left: { p0: seg.p0, p1: p01, p2: p012, p3: p0123 },
    right: { p0: p0123, p1: p123, p2: p23, p3: seg.p3 },
  };
}

/* Same sampling resolution and method as `cubicLength`/`pointOnCubic` above (`LENGTH_SAMPLES` equal
   steps), so this arc-length-to-`t` search shares that function's own accuracy rather than a second,
   independently-erring approximation of the same curve. */
function paramAtLength(seg: CubicSeg, targetLength: number): number {
  let length = 0;
  let previous = seg.p0;
  for (let step = 1; step <= LENGTH_SAMPLES; step++) {
    const t = step / LENGTH_SAMPLES;
    const point = pointOnCubic(seg.p0, seg.p1, seg.p2, seg.p3, t);
    const stepLength = Math.hypot(point.x - previous.x, point.y - previous.y);
    if (length + stepLength >= targetLength) {
      const remaining = targetLength - length;
      const fraction = stepLength > 0 ? remaining / stepLength : 0;
      return (step - 1 + fraction) / LENGTH_SAMPLES;
    }
    length += stepLength;
    previous = point;
  }
  return 1;
}

/* The single point representing "where a piece's own drawn geometry sits", for the card/ritual-row
   grouping below -- the point at HALF this piece's own arc length, found by walking its cubic chain
   (reusing `cubicLength`/`paramAtLength`'s own sampling, never a second curve-measuring method) and
   splitting the one segment the target falls inside. A whole-chain midpoint rather than either
   endpoint: a connector's own start and end already belong to the motifs either side of it (the
   join snap earlier in `threadLine` proves as much), so an endpoint would just re-derive the
   NEIGHBOUR's own group and never let a long connector be judged by where the bulk of ITS OWN ink
   actually falls. The final segment's own last point covers the pathological empty-chain / zero-
   length case (never true of a real piece) the same defensive way `trimChainStart` does below. */
function pointAtChainLength(segments: CubicSeg[], targetLength: number): Point {
  let remaining = targetLength;
  for (let index = 0; index < segments.length; index++) {
    const seg = segments[index];
    const length = cubicLength(seg.p0, seg.p1, seg.p2, seg.p3);
    if (length >= remaining || index === segments.length - 1) {
      const t = paramAtLength(seg, Math.min(remaining, length));
      return pointOnCubic(seg.p0, seg.p1, seg.p2, seg.p3, t);
    }
    remaining -= length;
  }
  return { x: 0, y: 0 };
}

/* Which of a section's own measured card/row rects a y-coordinate falls inside -- `rects` is always
   top-to-bottom in page-absolute pixels (`SectionSubdivisions`'s own header), so containment is a
   plain range test. A point that lands in the GAP between two cards, or past the first/last rect's
   own edge (a connector's own drawn curve routinely overshoots into a card's padding before turning
   toward the next motif), takes the NEAREST rect by clamped distance rather than defaulting to index
   0 -- the nearest rect is still the card or row whose window this piece is about to enter or has
   just left, where index 0 would wrongly pull a late piece's assignment back to the first card. */
function assignRectIndex(y: number, rects: readonly SectionRect[]): number {
  for (let index = 0; index < rects.length; index++) {
    const rect = rects[index];
    if (y >= rect.top && y < rect.top + rect.height) return index;
  }
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  rects.forEach((rect, index) => {
    const distance =
      y < rect.top ? rect.top - y : Math.max(0, y - (rect.top + rect.height));
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });
  return bestIndex;
}

/* Drops `trimLength` of arc from the START of a cubic chain: splits the one segment the cut falls
   inside and discards every whole segment before it. A trim fraction sane enough to leave a
   recognisable motif never reaches the "consumes the whole chain" branch below; it exists only so
   this pure function cannot throw on a pathological input. */
function trimChainStart(segments: CubicSeg[], trimLength: number): CubicSeg[] {
  if (trimLength <= 0) return segments;
  let remaining = trimLength;
  let index = 0;
  while (index < segments.length) {
    const seg = segments[index];
    const length = cubicLength(seg.p0, seg.p1, seg.p2, seg.p3);
    if (length > remaining) break;
    remaining -= length;
    index++;
  }
  if (index >= segments.length) {
    const last = segments[segments.length - 1];
    return [{ p0: last.p3, p1: last.p3, p2: last.p3, p3: last.p3 }];
  }
  const { right } = splitCubicAt(
    segments[index],
    paramAtLength(segments[index], remaining),
  );
  return [right, ...segments.slice(index + 1)];
}

/* Drops the SAME `fraction` of the chain's own total arc length from both ends. Trimming from the
   end reuses `trimChainStart` by reversing the chain, trimming, and reversing back — rather than a
   second, independently-written mirror of the same algorithm that could drift from it. */
function trimMotifTails(d: string, fraction: number): string {
  const segments = parseCubicChain(d);
  const total = segments.reduce(
    (sum, seg) => sum + cubicLength(seg.p0, seg.p1, seg.p2, seg.p3),
    0,
  );
  const trimLength = fraction * total;

  const trimmedStart = trimChainStart(segments, trimLength);
  const reversed = trimmedStart.slice().reverse().map(reverseSeg);
  const trimmedBoth = trimChainStart(reversed, trimLength)
    .slice()
    .reverse()
    .map(reverseSeg);

  const first = trimmedBoth[0].p0;
  const parts = [`M ${first.x} ${first.y}`];
  for (const seg of trimmedBoth) {
    parts.push(
      `C ${seg.p1.x} ${seg.p1.y} ${seg.p2.x} ${seg.p2.y} ${seg.p3.x} ${seg.p3.y}`,
    );
  }
  return parts.join(" ");
}

export function threadLine(
  band: BandId,
  sections: MeasuredSection[],
  anchors?: Partial<Record<Exclude<ThreadId, "not-found">, SectionAnchors>>,
  subdivisions?: SectionSubdivisions,
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

  /* ONE PIECE PER GROUP ENTRY, and (new) one GROUP per contiguous run of a section's own pieces that
     share a single measured card or ritual row. `perSection[i]` is already `[connector, motif,
     connector, motif, ..., connector]` (`k` even = connector, `k` odd = the `k/2`-th placement's
     motif — the same indexing `bakedMotifs`/`connectors.forEach` above builds it with), so labelling
     by parity needs no second pass over the geometry. Boundaries are read off these SAME groups the
     `d` above is built from, section by section, in THREAD_IDS order -- never sampled from the
     finished string, which would be measuring the output rather than the thing that produced it.
     Summing every piece's own sampled length and accumulating is the same arithmetic `pathLength`
     would do over the concatenated `d` (each curve's chord-sum contributes once either way, and `M`
     contributes none), so `length` below equals the cumulative total by construction rather than by
     a second, potentially-drifting measurement.

     A GROUP is a run of whole pieces, never a fragment of one -- the owner's own words describe
     pieces being SEQUENCED within a group, by length, exactly as they already are within a section,
     which is only true if grouping never cuts a piece in two. Each piece is assigned a single window
     rect by where the point at ITS OWN arc-length midpoint falls (`pointAtChainLength`/
     `assignRectIndex` above); a group boundary opens wherever that assignment moves to a rect further
     down the section than the current group's own rect -- clamped with `Math.max` against the
     current group's own rect index so a piece whose midpoint reads slightly EARLIER than its
     predecessor's (measurement noise at a card's edge, or a connector whose own midpoint sits before
     the motif it is leading into) can never re-open an earlier group or split a run into more pieces
     than there are rects. This is also why the ordering `event-info`'s own table describes falls out
     for free: `rings` sits inside card 1's own rect, so its leading connector (whose midpoint sits
     even earlier) reads the same rect and joins it; the connector leaving `rings` toward `knot`
     crosses into card 2's own rect partway along its length, so ITS midpoint already reads card 2 and
     the group closes right there, one piece early -- `knot` and its own trailing connector then join
     that second group by the same rule. */
  const pieces: ThreadPiece[] = [];
  const groups: SectionRange[] = [];
  const groupRects: SectionRect[] = [];
  let cursor = 0;
  THREAD_IDS.forEach((id, index) => {
    const group = perSection[index];
    const placements = MOTIF_PLACEMENTS[band][id];
    const to = sections[index];
    const sectionRect: SectionRect = { top: to.top, height: to.height };
    const ownSubdivision = subdivisions?.[id];
    const windowRects: readonly SectionRect[] =
      ownSubdivision !== undefined && ownSubdivision.length >= 2
        ? ownSubdivision
        : [sectionRect];

    let motifIndex = 0;
    let rectIndex = 0;
    let groupStart = cursor;
    let groupLastLength = 0;

    function closeGroup(end: number) {
      groups.push({
        id,
        start: groupStart,
        end,
        lastPieceLength: groupLastLength,
      });
      groupRects.push(windowRects[rectIndex]);
    }

    group.forEach((pieceD, k) => {
      const length = pathLength(pieceD);
      const kind: ThreadPiece["kind"] =
        k % 2 === 1 ? placements[motifIndex++].motif : "connector";
      const pieceStart = cursor;
      const pieceEnd = cursor + length;
      pieces.push({ id, kind, start: pieceStart, end: pieceEnd });

      if (windowRects.length > 1) {
        const midpoint = pointAtChainLength(
          parseCubicChain(pieceD),
          length / 2,
        );
        const assignedIndex = Math.max(
          rectIndex,
          assignRectIndex(midpoint.y, windowRects),
        );
        if (assignedIndex !== rectIndex) {
          closeGroup(pieceStart);
          rectIndex = assignedIndex;
          groupStart = pieceStart;
        }
      }

      groupLastLength = length;
      cursor = pieceEnd;
    });

    closeGroup(cursor);
  });

  const d = perSection.flat().join(" ");
  return { d, length: cursor, sections: groups, groupRects, pieces };
}

/* ---------------------------------------------------------------------------------------------
   THE PIECEWISE PROGRESS MAP — replaces one global `scrollY / (scrollHeight - innerHeight)`
   (`page-thread.tsx`'s old `pageProgress`), which advanced the draw head at a constant rate through
   TOTAL PATH LENGTH. Total path length has no relationship to where a section's own scroll window
   falls, so every section crept forward at once instead of drawing in the order the reader reaches
   them (the owner's review, `session.md` 2026-09-27). This is a MAPPING fix only: still one path,
   one dash, one number -- only the function producing that number changes. */

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

/* THE 75%/25% CROSSING RULE, owner decision 2026-09-28, superseding this same file's earlier
   60%-of-window/40%-hold rule (session.md, 2026-09-27) now that the dash is per-PIECE rather than
   per-section: "the last connector of every section except wishes is 75% drawn at the moment the
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
  rect: SectionRect,
  maxScroll: number,
): { progress: number; windowEnd: number } {
  const windowEnd = Math.min(rect.top + rect.height, maxScroll);
  return {
    progress: lerpProgress(scrollY, windowStart, windowEnd, 0, 1),
    windowEnd,
  };
}

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
   rect.height]`, no lead-in) and hold for the rest — reported to the owner in `task-1-report.md`
   as a deliberate, evidence-driven exception to "every section except wishes", not a silent one. */
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

   `windowStart` is NOT this section's own `rect.top` -- it is wherever the PREVIOUS section's own
   ramp B finished (or, for the first section, the page's own scroll origin), threaded through
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

/* The total drawn length of the whole page's dash at a given scroll position: each section's own
   range contributes `progress * rangeLength`, and nothing more -- a section whose window has not
   opened yet contributes zero regardless of how far past it any LATER section already is, and a
   section fully behind keeps its full range regardless of how far the reader has since continued.
   `windowStart` threads sequentially through the loop -- each section's own ramp begins exactly
   where the previous one's ramp B ended (or the page's own scroll origin, for the first section) --
   which is the mechanism, not an assumption, behind "the next section's first piece waits": its
   ramp A cannot start before `windowStart` reaches it, and `windowStart` cannot advance until the
   previous section's crossing piece (or, for `wishes`, its own terminal ramp) has reported its own
   `windowEnd`. */
/* Every section's own 0-1 progress at a given scroll position, in THREAD_IDS order -- the piece
   this file's three ramp shapes (`firstSectionProgress`/`crossingSectionProgress`/
   `terminalSectionProgress`) share, and what `drawnLength` below sums. Exported (alongside the sum)
   because "which sections are mid-ramp right now" is itself a testable claim -- "at most one
   section mid-ramp" (`thread-line.test.ts`) needs to inspect EACH section's own value, not just
   their combined total, and re-deriving that by hand-zeroing ranges in the test would only
   reproduce these same ramp shapes a second time, with its own chance to drift from them. */
export function sectionProgressAt(
  scrollY: number,
  viewportHeight: number,
  sectionRects: readonly SectionRect[],
  ranges: readonly SectionRange[],
): number[] {
  const maxScroll = pageMaxScroll(sectionRects, viewportHeight);
  const progresses: number[] = [];
  let windowStart = 0;
  for (let i = 0; i < ranges.length; i++) {
    const rect = sectionRects[i];
    const range = ranges[i];
    if (rect === undefined || range === undefined) {
      progresses.push(0);
      continue;
    }
    const clampedStart = Math.min(windowStart, maxScroll);

    const { progress, windowEnd } =
      range.id === "wishes"
        ? terminalSectionProgress(scrollY, clampedStart, rect, maxScroll)
        : i === 0
          ? firstSectionProgress(scrollY, rect, maxScroll)
          : crossingSectionProgress(
              scrollY,
              clampedStart,
              rect,
              range,
              maxScroll,
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
): number {
  const progresses = sectionProgressAt(
    scrollY,
    viewportHeight,
    sectionRects,
    ranges,
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
   fully-drawn piece never lands on the "stops short" case `lessons.md` (2026-09-25) records for an
   exactly-matching dash, and scaling the offset by `length` instead would leave exactly that
   epsilon painted at progress 0 -- a seed of ink on every one of the nineteen pieces before any of
   them has begun. Lives here rather than in the component so the arithmetic is testable without a
   DOM, which is how the seed went unnoticed. */
export const DASH_EPSILON = 4;

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
   singleton, or `PageThread` and `WishesWeave` would share a maximum that means different things in
   their two different path lengths.

   `reset` exists because a maximum is only meaningful against the layout it was measured in: a
   resize or a font load re-measures the page and changes the path's total length, and a maximum
   held over from the old one can exceed the new total, clamping every piece to fully drawn. The
   caller resets at its own re-measure and lets the next `advance` re-seed from the fresh value. */
export function createDrawRatchet(): {
  advance: (drawn: number) => number;
  reset: () => void;
} {
  let peak = 0;
  return {
    advance(drawn: number): number {
      if (drawn > peak) peak = drawn;
      return peak;
    },
    reset(): void {
      peak = 0;
    },
  };
}
