import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { authoredCard, portraitPhotoWidth } from "./thread-authored-layout.ts";
import { THREAD_BANDS } from "./thread-bands.ts";
import { authoredMeasuredSections } from "./thread-fallback.ts";
import {
  JOIN_EASE,
  joined,
  joinReach,
  PORTRAIT_LOOP_TRIM_FRACTION,
  splitSubpaths,
  subpathRange,
  threadLine,
} from "./thread-line.ts";
import { MOTIFS } from "./thread-motifs.ts";
import {
  MOTIF_PLACEMENTS,
  type Placement,
  THREAD_IDS,
  THREAD_PATHS,
} from "./thread-paths.ts";
import { threadPaths } from "./thread-photo-state.ts";
import {
  createDrawRatchet,
  dashForPiece,
  drawnLength,
  pieceProgress,
  sectionProgressAt,
} from "./thread-progress.ts";
import {
  type MeasuredSection,
  warpPlacement,
  warpSection,
} from "./thread-warp.ts";

const PATH_TOKEN = /[A-Za-z]|-?\d*\.?\d+(?:[eE][-+]?\d+)?/g;

type Point = { x: number; y: number };

/* Splits a `d` on its `M` boundaries — every connector and motif `d` this project generates is
   exactly one `M ... C ... C ...` subpath (`thread-paths.ts`'s and `thread-motifs.ts`'s own header
   comments), so an `M` token always marks the start of the next drawn stretch. */
function parseSubpaths(d: string): { start: Point; end: Point }[] {
  const tokens = d.match(PATH_TOKEN) ?? [];
  const subpaths: { start: Point; end: Point }[] = [];
  let index = 0;
  let current: Point | null = null;

  function nextPoint(): Point {
    const x = Number(tokens[index++]);
    const y = Number(tokens[index++]);
    return { x, y };
  }

  let command = "";
  while (index < tokens.length) {
    const token = tokens[index];
    if (/^[A-Za-z]$/.test(token)) {
      command = token;
      index++;
    }
    if (command === "M") {
      current = nextPoint();
      subpaths.push({ start: current, end: current });
    } else if (command === "C") {
      nextPoint();
      nextPoint();
      current = nextPoint();
      subpaths[subpaths.length - 1].end = current;
    } else {
      throw new Error(`test: unexpected path command "${command}"`);
    }
  }
  return subpaths;
}

/* A synthetic per-band set of measured sections that is NOT the identity — every card narrower and
   every section shorter than what the section was authored against, and each section given a
   different left offset, so the test exercises the real warp (position AND uniform scale) rather
   than an identity no-op. Real card/section figures come from `thread-authored-layout.ts`; this is a
   deliberately different, but still plausible, measured layout. */
function measuredSections(
  band: "tall" | "upright" | "wide",
): MeasuredSection[] {
  let top = 0;
  return THREAD_IDS.map((id) => {
    const from = authoredCard(id, band);
    const height = from.sectionHeight * 0.9;
    const section: MeasuredSection = {
      top,
      height,
      cardLeft: from.cardLeft * 0.8 + 10,
      cardWidth: from.cardWidth * 0.85,
    };
    top += height;
    return section;
  });
}

test("threadLine produces exactly one subpath per connector and per motif, in connection order", () => {
  const band = "wide";
  const { d } = threadLine(band, measuredSections(band));
  const subpathCount = (d.match(/M/g) ?? []).length;

  const expected = THREAD_IDS.reduce((sum, id) => {
    const connectors = THREAD_PATHS[band][id].length;
    const motifs = MOTIF_PLACEMENTS[band][id].length;
    return sum + connectors + motifs;
  }, 0);

  assert.equal(subpathCount, expected);
});

test("consecutive stretches share an endpoint to 0.01px, start to end of the page", () => {
  const band = "wide";
  const { d } = threadLine(band, measuredSections(band));
  const subpaths = parseSubpaths(d);

  assert.ok(subpaths.length > 1);
  for (let i = 1; i < subpaths.length; i++) {
    const gap = Math.hypot(
      subpaths[i].start.x - subpaths[i - 1].end.x,
      subpaths[i].start.y - subpaths[i - 1].end.y,
    );
    assert.ok(
      gap < 0.01,
      `stretch ${i}: gap of ${gap}px between ${JSON.stringify(subpaths[i - 1].end)} and ${JSON.stringify(subpaths[i].start)}`,
    );
  }
});

/* `bakeMotifPoint`'s transform (thread-line.ts) is `pos + side * R(turn) * mirror(local)`. Applying
   `R(-turn)` to every BAKED point of one motif's subpath removes the rotation only — the constant
   `R(-turn) * pos` term it leaves behind shifts every point by the same amount and cannot change a
   bounding box's WIDTH or HEIGHT, and a mirror flips the sign of one axis without changing its
   magnitude either. So the width/height ratio of the un-rotated baked points equals the width/height
   ratio of the motif's own un-transformed ink — `Motif.aspect` — regardless of translation, scale or
   mirror. This measures the claim from the BAKED points, not from the placement inputs. */
function unrotatedAspect(points: Point[], turnDegrees: number): number {
  const radians = (-turnDegrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const rotated = points.map((p) => ({
    x: cos * p.x - sin * p.y,
    y: sin * p.x + cos * p.y,
  }));
  const xs = rotated.map((p) => p.x);
  const ys = rotated.map((p) => p.y);
  const width = Math.max(...xs) - Math.min(...xs);
  const height = Math.max(...ys) - Math.min(...ys);
  return width / height;
}

function parseAllPoints(d: string): Point[] {
  const tokens = d.match(PATH_TOKEN) ?? [];
  const points: Point[] = [];
  for (let i = 0; i < tokens.length; i++) {
    if (/^[A-Za-z]$/.test(tokens[i])) continue;
    const x = Number(tokens[i]);
    const y = Number(tokens[i + 1]);
    points.push({ x, y });
    i++;
  }
  return points;
}

test("a motif's own aspect is preserved to 0.1% after baking onto a warped, non-identity layout", () => {
  const band = "wide";
  const sections = measuredSections(band);
  const { d } = threadLine(band, sections);
  const subpaths = d.split(/(?=M )/).filter((s) => s.trim().length > 0);

  // heart is family "invite"'s only motif: connector[0], heart, connector[1] -> subpath index 1.
  const heartPlacement = MOTIF_PLACEMENTS[band].invite[0];
  const heartSubpath = subpaths[1];
  const points = parseAllPoints(heartSubpath);

  const bakedAspect = unrotatedAspect(points, heartPlacement.turn);
  const authoredAspect = MOTIFS[heartPlacement.motif].aspect;

  const relativeError = Math.abs(bakedAspect - authoredAspect) / authoredAspect;
  assert.ok(
    relativeError < 0.001,
    `aspect drifted ${(relativeError * 100).toFixed(4)}%: baked ${bakedAspect}, authored ${authoredAspect}`,
  );
});

/* ------------------------------------------------------------------------------------------------
   PORTRAIT LOOP TAIL TRIM — the owner's ask, "trim the entry/exit tails of the motif so
   connectors don't do weird turns there". Every helper below is an INDEPENDENT re-implementation of
   `thread-line.ts`'s own arc-length math (same convention as `unrotatedAspect`/`parseAllPoints`
   above), so these tests cannot pass by sharing a bug with the code they verify. */

type CubicSeg = { p0: Point; p1: Point; p2: Point; p3: Point };

function indepPointOnCubic(
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
  const e = t * t * t;
  return {
    x: a * p0.x + b * p1.x + c * p2.x + e * p3.x,
    y: a * p0.y + b * p1.y + c * p2.y + e * p3.y,
  };
}

const INDEP_SAMPLES = 256; // matches thread-line.ts's own LENGTH_SAMPLES.

function indepCubicLength(seg: CubicSeg): number {
  let length = 0;
  let previous = seg.p0;
  for (let step = 1; step <= INDEP_SAMPLES; step++) {
    const point = indepPointOnCubic(
      seg.p0,
      seg.p1,
      seg.p2,
      seg.p3,
      step / INDEP_SAMPLES,
    );
    length += Math.hypot(point.x - previous.x, point.y - previous.y);
    previous = point;
  }
  return length;
}

function indepParseCubicChain(d: string): CubicSeg[] {
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
    } else {
      const p1 = nextPoint();
      const p2 = nextPoint();
      const p3 = nextPoint();
      segments.push({ p0: current, p1, p2, p3 });
      current = p3;
    }
  }
  return segments;
}

// Walks forward from the chain's own start by `targetLength` of arc, at the same sampling
// resolution `thread-line.ts` searches with -- returns the point there.
function indepPointAtArcLength(
  segments: CubicSeg[],
  targetLength: number,
): Point {
  let remaining = targetLength;
  for (const seg of segments) {
    const len = indepCubicLength(seg);
    if (len > remaining) {
      let acc = 0;
      let previous = seg.p0;
      for (let step = 1; step <= INDEP_SAMPLES; step++) {
        const t = step / INDEP_SAMPLES;
        const point = indepPointOnCubic(seg.p0, seg.p1, seg.p2, seg.p3, t);
        const stepLen = Math.hypot(point.x - previous.x, point.y - previous.y);
        if (acc + stepLen >= remaining) return point;
        acc += stepLen;
        previous = point;
      }
      return previous;
    }
    remaining -= len;
  }
  return segments[segments.length - 1].p3;
}

function indepReverseSeg(seg: CubicSeg): CubicSeg {
  return { p0: seg.p3, p1: seg.p2, p2: seg.p1, p3: seg.p0 };
}

// Exact de Casteljau split, independent of `thread-line.ts`'s own `splitCubicAt`.
function indepSplitCubicAt(
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

function indepParamAtLength(seg: CubicSeg, targetLength: number): number {
  let length = 0;
  let previous = seg.p0;
  for (let step = 1; step <= INDEP_SAMPLES; step++) {
    const t = step / INDEP_SAMPLES;
    const point = indepPointOnCubic(seg.p0, seg.p1, seg.p2, seg.p3, t);
    const stepLength = Math.hypot(point.x - previous.x, point.y - previous.y);
    if (length + stepLength >= targetLength) {
      const remaining = targetLength - length;
      const fraction = stepLength > 0 ? remaining / stepLength : 0;
      return (step - 1 + fraction) / INDEP_SAMPLES;
    }
    length += stepLength;
    previous = point;
  }
  return 1;
}

function indepTrimChainStart(
  segments: CubicSeg[],
  trimLength: number,
): CubicSeg[] {
  let remaining = trimLength;
  let index = 0;
  while (index < segments.length) {
    const length = indepCubicLength(segments[index]);
    if (length > remaining) break;
    remaining -= length;
    index++;
  }
  const { right } = indepSplitCubicAt(
    segments[index],
    indepParamAtLength(segments[index], remaining),
  );
  return [right, ...segments.slice(index + 1)];
}

// A second, independently-written implementation of `thread-line.ts`'s own `trimMotifTails`, used
// only to check that implementation's OUTPUT (via `unrotatedAspect` on the actual baked path above)
// against a from-scratch trim of the same authored data -- not a stand-in for it.
function indepTrimBothEnds(d: string, fraction: number): string {
  const segments = indepParseCubicChain(d);
  const total = segments.reduce((sum, seg) => sum + indepCubicLength(seg), 0);
  const trimLength = fraction * total;

  const trimmedStart = indepTrimChainStart(segments, trimLength);
  const reversed = trimmedStart.slice().reverse().map(indepReverseSeg);
  const trimmedBoth = indepTrimChainStart(reversed, trimLength)
    .slice()
    .reverse()
    .map(indepReverseSeg);

  const first = trimmedBoth[0].p0;
  const parts = [`M ${first.x} ${first.y}`];
  for (const seg of trimmedBoth) {
    parts.push(
      `C ${seg.p1.x} ${seg.p1.y} ${seg.p2.x} ${seg.p2.y} ${seg.p3.x} ${seg.p3.y}`,
    );
  }
  return parts.join(" ");
}

// Inverts `bakeMotifPoint`'s transform (thread-line.ts: `pos + side * R(turn) * mirror(local)`) to
// recover a baked point's own LOCAL, 0-100-square coordinate -- letting these tests compare the
// actual `threadLine()` output directly against an independent trim of the authored motif data,
// without duplicating the baking transform itself (only its inverse, which the aspect test above
// already establishes is safe to lean on: rotation and uniform scale preserve ratios exactly).
function invertBakePoint(
  baked: Point,
  placement: Placement,
  bandBox: { width: number; height: number },
): Point {
  const side = placement.scale * Math.min(bandBox.width, bandBox.height);
  const vx = (baked.x - placement.x) / side;
  const vy = (baked.y - placement.y) / side;
  const radians = (-placement.turn * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const ux = cos * vx - sin * vy;
  const uy = sin * vx + cos * vy;
  const lx = placement.mirror ? -ux : ux;
  return { x: (lx + 0.5) * 100, y: (uy + 0.5) * 100 };
}

// family's two portraitLoop placements are always indices 0 and 1 (thread-paths.ts): the first
// motif subpath sits right after family's own connector[0].
function familyMotifSubpathIndex(band: "tall" | "upright" | "wide"): number {
  const before = THREAD_IDS.slice(0, THREAD_IDS.indexOf("family")).reduce(
    (sum, id) =>
      sum + THREAD_PATHS[band][id].length + MOTIF_PLACEMENTS[band][id].length,
    0,
  );
  return before + 1;
}

test("family's portraitLoop entry and exit sit further along the motif's own arc after the tail trim", () => {
  const band = "wide";
  const sections = measuredSections(band);
  const { d } = threadLine(band, sections);
  const subpaths = d.split(/(?=M )/).filter((s) => s.trim().length > 0);

  const motifIndex = familyMotifSubpathIndex(band);
  const authoredPlacement = MOTIF_PLACEMENTS[band].family[0];
  const bandBox = THREAD_BANDS.find((candidate) => candidate.id === band)?.box;
  if (bandBox === undefined) throw new Error("wide band not found");
  // `bakeMotif` bakes against the WARPED placement (`threadLine`'s own composition), not the
  // authored one -- `warpPlacement` only moves x/y/scale, never turn/mirror, but x/y/scale are
  // exactly what `invertBakePoint` needs to recover a local point, so using the authored placement
  // here would invert the wrong transform entirely.
  const familyIndex = THREAD_IDS.indexOf("family");
  const placement = warpPlacement(
    authoredPlacement,
    authoredCard("family", band),
    sections[familyIndex],
  );

  const points = parseAllPoints(subpaths[motifIndex]);
  const bakedEntryLocal = invertBakePoint(points[0], placement, bandBox);
  const bakedExitLocal = invertBakePoint(
    points[points.length - 1],
    placement,
    bandBox,
  );

  const chain = indepParseCubicChain(MOTIFS.portraitLoop.d);
  const total = chain.reduce((sum, seg) => sum + indepCubicLength(seg), 0);
  const trimLength = PORTRAIT_LOOP_TRIM_FRACTION * total;

  const expectedEntry = indepPointAtArcLength(chain, trimLength);
  const reversedChain = chain
    .slice()
    .reverse()
    .map((seg) => ({ p0: seg.p3, p1: seg.p2, p2: seg.p1, p3: seg.p0 }));
  const expectedExit = indepPointAtArcLength(reversedChain, trimLength);

  assert.ok(
    Math.hypot(
      bakedEntryLocal.x - expectedEntry.x,
      bakedEntryLocal.y - expectedEntry.y,
    ) < 0.1,
    `trimmed entry ${JSON.stringify(bakedEntryLocal)} does not match an independent ${(PORTRAIT_LOOP_TRIM_FRACTION * 100).toFixed(1)}% arc-length walk ${JSON.stringify(expectedEntry)}`,
  );
  assert.ok(
    Math.hypot(
      bakedExitLocal.x - expectedExit.x,
      bakedExitLocal.y - expectedExit.y,
    ) < 0.1,
    `trimmed exit ${JSON.stringify(bakedExitLocal)} does not match an independent ${(PORTRAIT_LOOP_TRIM_FRACTION * 100).toFixed(1)}% arc-length walk from the far end ${JSON.stringify(expectedExit)}`,
  );

  // Confirms the trim actually moved the join, rather than the two happening to coincide: the
  // untrimmed entry is the motif's own authored (0, 54.77).
  const authoredEntry = {
    x: MOTIFS.portraitLoop.entry.x * 100,
    y: MOTIFS.portraitLoop.entry.y * 100,
  };
  assert.ok(
    Math.hypot(
      bakedEntryLocal.x - authoredEntry.x,
      bakedEntryLocal.y - authoredEntry.y,
    ) > 1,
    "entry did not move along the motif's own arc -- the trim is not being applied",
  );
});

test("the connectors either side of family's trimmed portraitLoop still meet it to 0.01px", () => {
  const band = "wide";
  const sections = measuredSections(band);
  const { d } = threadLine(band, sections);
  const subpaths = d.split(/(?=M )/).filter((s) => s.trim().length > 0);

  const motifIndex = familyMotifSubpathIndex(band);
  const before = parseAllPoints(subpaths[motifIndex - 1]);
  const motif = parseAllPoints(subpaths[motifIndex]);
  const after = parseAllPoints(subpaths[motifIndex + 1]);

  const entryGap = Math.hypot(
    before[before.length - 1].x - motif[0].x,
    before[before.length - 1].y - motif[0].y,
  );
  const exitGap = Math.hypot(
    motif[motif.length - 1].x - after[0].x,
    motif[motif.length - 1].y - after[0].y,
  );
  assert.ok(entryGap < 0.01, `entry gap ${entryGap}px`);
  assert.ok(exitGap < 0.01, `exit gap ${exitGap}px`);
});

test("the tail trim does not squash family's portraitLoop -- its baked aspect matches the trimmed local shape's own aspect to 0.1%", () => {
  const band = "wide";
  const sections = measuredSections(band);
  const { d } = threadLine(band, sections);
  const subpaths = d.split(/(?=M )/).filter((s) => s.trim().length > 0);

  const motifIndex = familyMotifSubpathIndex(band);
  const placement = MOTIF_PLACEMENTS[band].family[0];
  const points = parseAllPoints(subpaths[motifIndex]);
  const bakedAspect = unrotatedAspect(points, placement.turn);

  // The trimmed shape's own aspect, from an INDEPENDENT de Casteljau split of the authored curve --
  // not a sampled approximation of it. `unrotatedAspect` (both here and in the untrimmed test above)
  // measures the CONTROL POLYGON's bbox, not the rendered curve's, since that is what the baked `d`
  // string's own tokens are; a Bezier's control points need not sit on the curve, so comparing that
  // against a bbox of sampled CURVE points is not the same claim and drifted 0.15% in an earlier
  // version of this test -- this compares control polygon to control polygon, like the untrimmed
  // test already does.
  const trimmedLocalD = indepTrimBothEnds(
    MOTIFS.portraitLoop.d,
    PORTRAIT_LOOP_TRIM_FRACTION,
  );
  const localPoints = parseAllPoints(trimmedLocalD);
  const xs = localPoints.map((p) => p.x);
  const ys = localPoints.map((p) => p.y);
  const localAspect =
    (Math.max(...xs) - Math.min(...xs)) / (Math.max(...ys) - Math.min(...ys));

  const relativeError = Math.abs(bakedAspect - localAspect) / localAspect;
  assert.ok(
    relativeError < 0.001,
    `aspect drifted ${(relativeError * 100).toFixed(4)}%: baked ${bakedAspect}, trimmed local shape ${localAspect}`,
  );
});

test("identity: warping every section to its own authored box reproduces the authored geometry", () => {
  const band = "upright";
  const identity: MeasuredSection[] = THREAD_IDS.map((id) => {
    const from = authoredCard(id, band);
    return {
      top: 0,
      height: from.sectionHeight,
      cardLeft: from.cardLeft,
      cardWidth: from.cardWidth,
    };
  });

  const { d } = threadLine(band, identity);
  const points = parseAllPoints(d);

  // The invite's own free start is the first authored point of its first connector.
  const first = THREAD_PATHS[band].invite[0].d.match(PATH_TOKEN) ?? [];
  const expectedX = Number(first[1]);
  const expectedY = Number(first[2]);
  assert.ok(Math.abs(points[0].x - expectedX) < 0.01);
  assert.ok(Math.abs(points[0].y - expectedY) < 0.01);
});

test("threadLine rejects a sections array that does not match THREAD_IDS", () => {
  assert.throws(() => threadLine("wide", []));
});

test("an anchor overrides a placement's warped centre, and the adjoining connectors follow it", () => {
  const band = "wide";
  const sections = measuredSections(band);
  const unanchored = threadLine(band, sections);

  // family's two portraitLoop placements are indices 0 and 1 (thread-paths.ts).
  /* The photo at the size this layout's card implies, so the ring keeps the size it has unanchored
     and only moves. */
  const familyCard = sections[THREAD_IDS.indexOf("family")];
  const photo =
    (portraitPhotoWidth(band) * familyCard.cardWidth) /
    authoredCard("family", band).cardWidth;
  const anchor = {
    left: 920 - photo / 2,
    top: 220 - photo / 2,
    width: photo,
    height: photo,
  };
  const anchorCentre = {
    x: anchor.left + anchor.width / 2,
    y: anchor.top + anchor.height / 2,
  };
  const anchored = threadLine(band, sections, {
    family: [anchor, undefined],
  });

  assert.notEqual(anchored.d, unanchored.d);

  const familyIndex = THREAD_IDS.indexOf("family");
  const subpathsBefore = THREAD_IDS.slice(0, familyIndex).reduce(
    (sum, id) =>
      THREAD_PATHS[band][id].length + MOTIF_PLACEMENTS[band][id].length + sum,
    0,
  );
  // family's own connector[0] precedes its first motif's subpath.
  const motifSubpathIndex = subpathsBefore + 1;
  const anchoredSubpaths = anchored.d
    .split(/(?=M )/)
    .filter((s) => s.trim().length > 0);
  const unanchoredSubpaths = unanchored.d
    .split(/(?=M )/)
    .filter((s) => s.trim().length > 0);
  const anchoredPoints = parseAllPoints(anchoredSubpaths[motifSubpathIndex]);
  const unanchoredPoints = parseAllPoints(
    unanchoredSubpaths[motifSubpathIndex],
  );

  /* An anchor the size of the authored photo changes only the placement's CENTRE, never its rotation
     or scale, so every one of the motif's baked points shifts by the SAME rigid translation -- the delta the first point moved by
     must equal the delta every other point moved by, to float precision. */
  const shift = {
    x: anchoredPoints[0].x - unanchoredPoints[0].x,
    y: anchoredPoints[0].y - unanchoredPoints[0].y,
  };
  for (let i = 1; i < anchoredPoints.length; i++) {
    assert.ok(
      Math.abs(anchoredPoints[i].x - unanchoredPoints[i].x - shift.x) < 0.01,
      `point ${i} x did not shift rigidly`,
    );
    assert.ok(
      Math.abs(anchoredPoints[i].y - unanchoredPoints[i].y - shift.y) < 0.01,
      `point ${i} y did not shift rigidly`,
    );
  }

  // The un-anchored centroid is some point on the motif's own ink, not necessarily its placement
  // centre, so only the SHIFT is exact -- but the shifted centroid must land close to the anchor,
  // ruling out a no-op or a wildly wrong translation without over-claiming precision the centroid
  // (rather than the true placement centre) can give.
  const unanchoredCentreProxy = {
    x:
      unanchoredPoints.reduce((sum, p) => sum + p.x, 0) /
      unanchoredPoints.length,
    y:
      unanchoredPoints.reduce((sum, p) => sum + p.y, 0) /
      unanchoredPoints.length,
  };
  const shiftedCentreProxy = {
    x: unanchoredCentreProxy.x + shift.x,
    y: unanchoredCentreProxy.y + shift.y,
  };
  assert.ok(
    Math.hypot(
      shiftedCentreProxy.x - anchorCentre.x,
      shiftedCentreProxy.y - anchorCentre.y,
    ) < 60,
  );

  // the connector preceding the anchored motif must still meet its (now shifted) entry exactly.
  const precedingConnector = parseAllPoints(
    anchoredSubpaths[motifSubpathIndex - 1],
  );
  const precedingEnd = precedingConnector[precedingConnector.length - 1];
  const motifStart = anchoredPoints[0];
  assert.ok(
    Math.hypot(precedingEnd.x - motifStart.x, precedingEnd.y - motifStart.y) <
      0.01,
  );
});

test("sections are contiguous, non-overlapping, cover [0, length] exactly, in THREAD_IDS order", () => {
  const band = "wide";
  const sections = measuredSections(band);
  const { length, sections: ranges } = threadLine(band, sections);

  assert.equal(ranges.length, THREAD_IDS.length);
  assert.deepEqual(
    ranges.map((r) => r.id),
    THREAD_IDS,
  );

  assert.equal(ranges[0].start, 0);
  assert.ok(Math.abs(ranges[ranges.length - 1].end - length) < 0.01);

  let cumulative = 0;
  for (const range of ranges) {
    assert.ok(range.end > range.start, `${range.id}: end must exceed start`);
    assert.ok(
      Math.abs(range.start - cumulative) < 0.01,
      `${range.id}: start ${range.start} should equal the cumulative length of every stretch before it (${cumulative})`,
    );
    cumulative = range.end;
  }
  assert.ok(Math.abs(cumulative - length) < 0.01);
});

test("length is a positive number roughly on the order of the page's own pixel height", () => {
  const band = "wide";
  const sections = measuredSections(band);
  const { length } = threadLine(band, sections);
  const totalHeight = sections.reduce((sum, s) => sum + s.height, 0);

  assert.ok(length > 0);
  // The thread winds through motifs and is never a straight vertical line, so it is longer than the
  // page's own height. The `wide` band's own sections are wider than they are tall (aspect ~2.21,
  // `thread-bands.ts`), and the thread crosses that width repeatedly rather than dropping straight
  // down, so the multiple is well above 1 — measured directly against this module's own output at
  // ~3.29x for this test's layout — while a bound many times that would no longer be a sanity check
  // on "roughly the page's own scale" at all.
  assert.ok(length > totalHeight);
  assert.ok(length < totalHeight * 6);
});

/* ------------------------------------------------------------------------------------------------
   drawnLength — the per-section progress map `pieceProgress` above is driven from. Synthetic
   sections and ranges below, never real THREAD_IDS/measured data, so each behaviour (not-reached,
   held-past, the crossing rule, a section too short for the model, the page's own end) can be
   pinned to hand-picked numbers instead of whatever a real layout happens to produce.

   THREE SHAPES, chosen by `drawnLength` itself, not by the caller:
   - the FIRST section (`i === 0`) has no predecessor to inherit ramp room from, so it keeps this
     file's own PRE-crossing rule (ramp across `FIRST_SECTION_DRAW_FRACTION` of its own
     `[top, top + height]` window, hold for the rest) -- `firstSectionProgress`'s own header in
     `thread-progress.ts` walks through why applying the crossing formula there instead collapses the
     ENTIRE page to complete at scrollY 0.
   - `wishes` is the page's own terminal stretch and the owner's stated exception -- a single ramp
     across its own remaining window to completion, no crossing anchor.
   - every OTHER section gets the 75%/25% crossing rule, chained from whichever scrollY the
     PREVIOUS section's own ramp finished at. */

const RANGE_IDS = THREAD_IDS; // borrow real ids only to satisfy the type; positional, not semantic.

test("drawnLength: a section not yet reached contributes zero, and begins the instant its predecessor's own ramp ends -- not before, and not only once its own rect.top arrives", () => {
  // Two tall sections, well separated: A is the first section, its own window is [0, 5000],
  // draw-complete at 0.6*5000 = 3000. B's own crossing ramp A begins exactly there (`windowStart`
  // chains to wherever the PREVIOUS section's own ramp ended, not to B's own rect.top at 5000) --
  // so B is genuinely untouched for every scrollY before 3000, and genuinely under way just after.
  const sectionRects = [
    { top: 0, height: 5000 },
    { top: 5000, height: 5000 },
  ];
  const ranges = [
    { id: RANGE_IDS[0], start: 0, end: 100, lastPieceLength: 20 },
    { id: RANGE_IDS[1], start: 100, end: 250, lastPieceLength: 30 },
  ];
  const viewportHeight = 500;

  assert.equal(drawnLength(0, viewportHeight, sectionRects, ranges), 0);
  assert.equal(
    sectionProgressAt(2999, viewportHeight, sectionRects, ranges)[1],
    0,
    "B must not have started one pixel before A's own ramp ends",
  );
  assert.equal(
    drawnLength(3000, viewportHeight, sectionRects, ranges),
    ranges[0].end - ranges[0].start,
    "at exactly 3000 (A's own ramp end), A should read fully drawn and B exactly 0",
  );
  assert.ok(
    sectionProgressAt(3500, viewportHeight, sectionRects, ranges)[1] > 0,
    "B must have started immediately once A's own ramp finished, well before B's own rect.top",
  );
});

test("drawnLength: a single (first, and so also last) section fully scrolled past contributes its full range and holds there, capped at the page's own end", () => {
  // A single section is both the first (`firstSectionProgress`) and the last, so its passage
  // window's far edge (top + height = 1000) sits past `maxScroll` (500 = 1000 total height - 500
  // viewport). Uncapped, the raw 60% mark (600) would fall past `maxScroll` and the thread would
  // never finish drawing -- `firstSectionProgress` caps `drawEnd` at `maxScroll` for exactly this
  // case.
  const sectionRects = [{ top: 0, height: 1000 }];
  const ranges = [
    { id: RANGE_IDS[0], start: 40, end: 140, lastPieceLength: 20 },
  ];
  const viewportHeight = 500; // maxScroll = 1000 - 500 = 500.

  assert.equal(drawnLength(0, viewportHeight, sectionRects, ranges), 0);
  assert.ok(
    Math.abs(drawnLength(250, viewportHeight, sectionRects, ranges) - 50) <
      0.01,
    "halfway to maxScroll should read half-drawn",
  );
  for (const scrollY of [500, 900, 5000]) {
    assert.equal(
      drawnLength(scrollY, viewportHeight, sectionRects, ranges),
      100,
      `scrollY ${scrollY}: expected the full 100px range held`,
    );
  }
});

test("drawnLength: the first section completes at 60% of its own window -- exactly [top, top + height], no lead-in -- and holds for the remaining 40%", () => {
  // Positioned away from the page's own start (top isn't 0, matching this project's own docs which
  // always test the first-section shape away from x=0 to rule out an accidental origin dependency)
  // and followed by a much larger section, so neither the windowStart clamp nor the maxScroll cap
  // on drawEnd applies here -- this isolates the first section's own 60%-of-window ramp.
  const sectionRects = [
    { top: 1000, height: 1000 },
    { top: 2000, height: 5000 },
  ];
  const ranges = [
    { id: RANGE_IDS[0], start: 0, end: 100, lastPieceLength: 20 },
    { id: RANGE_IDS[1], start: 100, end: 300, lastPieceLength: 40 },
  ];
  const viewportHeight = 500;
  // window [1000, 2000] (the section's own extent, no viewport-wide lead-in), draw-complete at
  // 1000 + 0.6*1000 = 1600. B's own crossing ramp A then runs [1600, 2000] -- real room, so B
  // begins ramping immediately at 1600, well before its own rect.top (2000); checked directly via
  // `sectionProgressAt` rather than via `drawnLength`'s combined total, which would conflate A's own
  // (already complete) contribution with B's.

  // 750 sits inside the OLD lead-in window ([500, 2000]) but before this section's own top -- under
  // the previous windowStart (`top - viewportHeight` = 500) this read 27.8% drawn; removing the
  // lead-in is exactly what pulls it back to 0 until scrollY actually reaches the section's own top.
  assert.equal(drawnLength(750, viewportHeight, sectionRects, ranges), 0);
  assert.equal(drawnLength(1000, viewportHeight, sectionRects, ranges), 0);
  assert.ok(
    Math.abs(drawnLength(1300, viewportHeight, sectionRects, ranges) - 50) <
      0.01,
    "halfway to the 60% mark should read half-drawn",
  );
  assert.equal(
    sectionProgressAt(1600, viewportHeight, sectionRects, ranges)[0],
    1,
    "A should be fully drawn at exactly its own 60% mark",
  );
  assert.equal(
    sectionProgressAt(1599, viewportHeight, sectionRects, ranges)[1],
    0,
    "B must not have started one pixel before A's own ramp ends",
  );
  assert.ok(
    sectionProgressAt(1900, viewportHeight, sectionRects, ranges)[1] > 0,
    "B should already be under way at 1900, well before its own rect.top at 2000",
  );
});

test("drawnLength: wishes, with real room from its predecessor, draws gradually across the room its own crossing predecessor leaves it", () => {
  // A dummy first section (zero-width range, so it contributes nothing) leaves `wishes` a real
  // predecessor to inherit ramp room from -- `wishes` on a real page is never the FIRST section, so
  // this is the representative shape, not the single-section one below.
  const sectionRects = [
    { top: 0, height: 1000 },
    { top: 1000, height: 200 },
  ];
  const ranges = [
    { id: RANGE_IDS[0], start: 0, end: 0, lastPieceLength: 0 },
    { id: "wishes" as const, start: 0, end: 60, lastPieceLength: 0 },
  ];
  const viewportHeight = 500;
  // First section's own window [0, 1000], draw-complete (contributing nothing) at 600 -- that is
  // wishes' own windowStart. wishes' own window: min(1000+200, maxScroll=700) = 700. Ramp [600,
  // 700].

  assert.equal(drawnLength(600, viewportHeight, sectionRects, ranges), 0);
  assert.ok(
    Math.abs(drawnLength(650, viewportHeight, sectionRects, ranges) - 30) <
      0.01,
    "halfway across wishes' own room should read half-drawn",
  );
  assert.equal(drawnLength(700, viewportHeight, sectionRects, ranges), 60);
  assert.equal(drawnLength(900, viewportHeight, sectionRects, ranges), 60);
});

test("drawnLength: wishes with NO room left by its predecessor (the page's own scroll runs out first) pops complete rather than sticking at 0", () => {
  // A tall predecessor whose own 60% mark is capped hard against a small maxScroll (viewportHeight
  // chosen larger than the page's own total height minus a sliver) leaves wishes' own crossing
  // window collapsed to zero width -- the wishes-side analogue of this file's own documented
  // last-section-has-no-room case, now reached through a predecessor's exhausted room rather than a
  // short final section.
  const sectionRects = [
    { top: 0, height: 1000 },
    { top: 1000, height: 200 },
  ];
  const ranges = [
    { id: RANGE_IDS[0], start: 0, end: 0, lastPieceLength: 0 },
    { id: "wishes" as const, start: 0, end: 60, lastPieceLength: 0 },
  ];
  const viewportHeight = 1150; // maxScroll = 1200 - 1150 = 50.

  // Predecessor: windowEnd = min(0.6*1000, 50) = 50. wishes: window [50, min(1200,50)=50] -- zero
  // width, pops at exactly 50.
  assert.equal(drawnLength(0, viewportHeight, sectionRects, ranges), 0);
  assert.equal(drawnLength(49, viewportHeight, sectionRects, ranges), 0);
  assert.equal(drawnLength(50, viewportHeight, sectionRects, ranges), 60);
  assert.equal(drawnLength(200, viewportHeight, sectionRects, ranges), 60);
});

test("drawnLength: the 75%/25% crossing rule -- an interior section's own progress is exactly its rampAFraction at its own rect.top, finishes later, and the next section's first piece waits for that", () => {
  // A dummy first section (contributes nothing) so the middle section is a genuine INTERIOR one,
  // inheriting real ramp room from a predecessor rather than being `i === 0` itself.
  const sectionRects = [
    { top: 0, height: 1000 }, // first, dummy
    { top: 2000, height: 3000 }, // the section under test
    { top: 5000, height: 1000 }, // the section that must wait
  ];
  const totalLength = 500;
  const lastPieceLength = 100;
  const rampAFraction = (totalLength - 0.25 * lastPieceLength) / totalLength; // 0.95
  const ranges = [
    { id: RANGE_IDS[0], start: 0, end: 0, lastPieceLength: 0 },
    { id: RANGE_IDS[1], start: 0, end: totalLength, lastPieceLength },
    {
      id: RANGE_IDS[2],
      start: totalLength,
      end: totalLength + 10,
      lastPieceLength: 10,
    },
  ];
  const viewportHeight = 500;
  // First section's own window [0, 1000], draw-complete (contributing nothing) at 600 -- the
  // middle section's own windowStart. rampAEnd = rect.top = 2000. durationA = 1400.
  // durationB = 1400 * (0.05/0.95) = 73.68421...; rampBEnd = 2073.68421...

  const atOwnTop = drawnLength(2000, viewportHeight, sectionRects, ranges);
  assert.ok(
    Math.abs(atOwnTop - rampAFraction * totalLength) < 0.01,
    `expected ${rampAFraction * totalLength} (95% of the section, i.e. 75% of its own last piece) at the section's own rect.top, got ${atOwnTop}`,
  );

  const rampBEnd = 2000 + 1400 * ((1 - rampAFraction) / rampAFraction);
  assert.ok(
    Math.abs(
      drawnLength(rampBEnd, viewportHeight, sectionRects, ranges) - totalLength,
    ) < 0.01,
    "the section's own last piece should be fully drawn by its own rampBEnd",
  );

  // `sectionProgressAt`'s own third entry proves the THIRD section has not started anywhere before
  // rampBEnd, and starts immediately after it: "the next section's first piece waits for that 25%"
  // is this, not a separately-coded rule.
  assert.equal(
    sectionProgressAt(rampBEnd - 1, viewportHeight, sectionRects, ranges)[2],
    0,
    "must not have started yet",
  );
  assert.ok(
    sectionProgressAt(rampBEnd + 1, viewportHeight, sectionRects, ranges)[2] >
      0,
    "must have started immediately after the crossing piece finishes",
  );
});

test("drawnLength is monotonic in scrollY across the whole page, swept at fine resolution", () => {
  const sectionRects = [
    { top: 0, height: 1000 },
    { top: 1000, height: 1000 },
    { top: 2000, height: 200 }, // shorter than the viewport, mixed in on purpose.
    { top: 2200, height: 1500 },
  ];
  const ranges = [
    { id: RANGE_IDS[0], start: 0, end: 100, lastPieceLength: 20 },
    { id: RANGE_IDS[1], start: 100, end: 250, lastPieceLength: 30 },
    { id: RANGE_IDS[2], start: 250, end: 300, lastPieceLength: 10 },
    { id: RANGE_IDS[3], start: 300, end: 480, lastPieceLength: 40 },
  ];
  const viewportHeight = 500;
  const pageEnd = 2200 + 1500;
  const step = 2; // fine enough to catch a band a few pixels wide collapsing to nothing.

  let previous = -1;
  for (let scrollY = 0; scrollY <= pageEnd; scrollY += step) {
    const value = drawnLength(scrollY, viewportHeight, sectionRects, ranges);
    assert.ok(
      value >= previous - 1e-9,
      `drawn length fell from ${previous} to ${value} at scrollY ${scrollY}`,
    );
    previous = value;
  }
  // The sum never exceeds the page's own total range even where two windows overlap.
  const total = ranges[ranges.length - 1].end;
  assert.ok(
    drawnLength(pageEnd, viewportHeight, sectionRects, ranges) <= total + 1e-9,
  );
});

test("drawnLength: at scrollY 0 nothing has started; at the page's max scroll every section is full", () => {
  const band = "wide";
  const sections = measuredSections(band);
  const { length, sections: ranges } = threadLine(band, sections);

  const viewportHeight = 400;
  const totalHeight = sections.reduce((sum, s) => sum + s.height, 0);
  const maxScroll = totalHeight - viewportHeight;

  assert.equal(drawnLength(0, viewportHeight, sections, ranges), 0);
  assert.ok(
    Math.abs(
      drawnLength(maxScroll, viewportHeight, sections, ranges) - length,
    ) < 0.01,
  );
});

/* ------------------------------------------------------------------------------------------------
   AT MOST ONE PIECE IS MID-DRAW -- the property the per-piece dash exists to establish. Not
   "one section" -- one PIECE, swept across the real page shape at all three bands, reading each
   section's own progress directly off `sectionProgressAt` (section-level) and each piece's own off
   `pieceProgress` against the shared `drawn` scalar (piece-level) -- never by hand-zeroing a
   synthetic `ranges` array, which an earlier draft of this test did and which silently changed the
   very `rampAFraction`/`windowEnd` chain being tested (a zeroed section's `totalLength` triggers
   `crossingSectionProgress`'s own `totalLength <= 0` guard, giving it a DIFFERENT completion point
   than its real one and corrupting every later section's `windowStart`) -- `sectionProgressAt` and
   `pieceProgress` need no such trick because they read the real chain directly. */

test("adjacent sections' windows never overlap, and at most one section is mid-ramp at any scroll position -- swept across all three real bands", () => {
  for (const band of ["tall", "upright", "wide"] as const) {
    const sections = measuredSections(band);
    const { sections: ranges } = threadLine(band, sections);
    const viewportBox = THREAD_BANDS.find((b) => b.id === band)?.box;
    if (viewportBox === undefined) throw new Error(`unknown band ${band}`);
    const viewportHeight = viewportBox.height;
    const totalHeight = sections.reduce((sum, s) => sum + s.height, 0);
    const maxScroll = Math.max(totalHeight - viewportHeight, 0);
    const step = 4;

    for (let scrollY = 0; scrollY <= maxScroll; scrollY += step) {
      const progresses = sectionProgressAt(
        scrollY,
        viewportHeight,
        sections,
        ranges,
      );
      const midRampCount = progresses.filter(
        (progress) => progress > 1e-6 && progress < 1 - 1e-6,
      ).length;
      assert.ok(
        midRampCount <= 1,
        `${band} @ scrollY=${scrollY}: expected at most one section mid-ramp, found ${midRampCount} (${progresses.map((p, i) => `${THREAD_IDS[i]}=${p.toFixed(4)}`).join(", ")})`,
      );
    }
  }
});

test("AT MOST ONE PIECE IS MID-DRAW at any scroll position, swept across the whole page at all three bands", () => {
  for (const band of ["tall", "upright", "wide"] as const) {
    const sections = measuredSections(band);
    const { sections: ranges, pieces } = threadLine(band, sections);
    const viewportBox = THREAD_BANDS.find((b) => b.id === band)?.box;
    if (viewportBox === undefined) throw new Error(`unknown band ${band}`);
    const viewportHeight = viewportBox.height;
    const totalHeight = sections.reduce((sum, s) => sum + s.height, 0);
    const maxScroll = Math.max(totalHeight - viewportHeight, 0);
    const step = 8; // coarser than the section-level sweep above -- 19+ pieces over the same range.

    for (let scrollY = 0; scrollY <= maxScroll; scrollY += step) {
      const drawn = drawnLength(scrollY, viewportHeight, sections, ranges);
      const midDraw = pieces.filter((piece) => {
        const progress = pieceProgress(drawn, piece);
        return progress > 1e-9 && progress < 1 - 1e-9;
      });
      assert.ok(
        midDraw.length <= 1,
        `${band} @ scrollY=${scrollY}, drawn=${drawn}: expected at most one piece mid-draw, found ${midDraw.length} (${midDraw.map((p) => `${p.id}/${p.kind}`).join(", ")})`,
      );
    }

    // At the two ends of the page, every piece must read fully undrawn / fully drawn -- not merely
    // "at most one mid-draw" (trivially true at 0 and at maxScroll too) but the actual boundary
    // values, checked directly.
    const drawnAtStart = drawnLength(0, viewportHeight, sections, ranges);
    for (const piece of pieces) {
      assert.equal(
        pieceProgress(drawnAtStart, piece),
        0,
        `${band}: ${piece.id}/${piece.kind} should be fully undrawn at scrollY 0`,
      );
    }
    const drawnAtEnd = drawnLength(maxScroll, viewportHeight, sections, ranges);
    for (const piece of pieces) {
      assert.equal(
        pieceProgress(drawnAtEnd, piece),
        1,
        `${band}: ${piece.id}/${piece.kind} should be fully drawn at the page's own max scroll`,
      );
    }
  }
});

test("a piece paints nothing at all until its own progress leaves zero", () => {
  const { dasharray, dashoffset } = dashForPiece(500, 0);
  assert.equal(
    dashoffset,
    dasharray,
    "offset must equal the whole dash period at progress 0, or the epsilon paints as a seed",
  );
});

test("a piece is fully painted at progress 1, with the overshoot the epsilon exists for", () => {
  const length = 500;
  const { dasharray, dashoffset } = dashForPiece(length, 1);
  assert.equal(dashoffset, 0);
  assert.ok(dasharray > length, "the dash must overshoot the piece's own end");
});

test("every piece of a real band's thread is blank before the draw reaches it", () => {
  const sections = THREAD_IDS.map((_id, i) => ({
    top: i * 695,
    height: 695,
    cardLeft: 288,
    cardWidth: 960,
  }));
  const line = threadLine("wide", sections);
  for (const piece of line.pieces) {
    const { dasharray, dashoffset } = dashForPiece(
      piece.end - piece.start,
      pieceProgress(0, piece),
    );
    assert.equal(
      dashoffset,
      dasharray,
      `piece ${piece.id ?? ""} seeds ink at drawn 0`,
    );
  }
});

/* ------------------------------------------------------------------------------------------------
   CARD/ROW GROUPING: a stacked pair is two windows,
   not one, and a long ritual list is several. `subdivisions` never comes from real DOM in this file
   (that measurement lives in `thread-measure.ts`, untestable off a browser) — every test below hands
   `threadLine` a synthetic, but geometrically plausible, top-to-bottom split of a section's own
   measured rect, exactly the shape `measureSubdivisions` produces from real leaf/row elements. */

/* Splits `[rect.top, rect.top + rect.height]` into `n` equal, contiguous, top-to-bottom slices --
   the same shape two `.mounted-sheet-frame__leaf` rects or six `[data-thread-row]` rects take on a
   real page (never exactly equal in practice, but equal slices are enough to prove the ASSIGNMENT
   mechanism without needing a real render). */
function splitRect(
  rect: { top: number; height: number },
  n: number,
): { top: number; height: number }[] {
  const slice = rect.height / n;
  return Array.from({ length: n }, (_, i) => ({
    top: rect.top + i * slice,
    height: slice,
  }));
}

function subdivisionsFor(
  sections: MeasuredSection[],
): Partial<
  Record<(typeof THREAD_IDS)[number], { top: number; height: number }[]>
> {
  const byId = new Map(THREAD_IDS.map((id, i) => [id, sections[i]]));
  const eventInfo = byId.get("event-info");
  const family = byId.get("family");
  const celebrations = byId.get("celebrations");
  return {
    ...(eventInfo && { "event-info": splitRect(eventInfo, 2) }),
    ...(family && { family: splitRect(family, 2) }),
    ...(celebrations && { celebrations: splitRect(celebrations, 6) }),
  };
}

/* The pair laid out side by side, as `wide` lays it: both card rects share the section's top and
   height, so one scroll window covers both. The ritual rows stay stacked -- a list never sits side
   by side. */
function sideBySideSubdivisionsFor(
  sections: MeasuredSection[],
): Partial<
  Record<(typeof THREAD_IDS)[number], { top: number; height: number }[]>
> {
  const byId = new Map(THREAD_IDS.map((id, i) => [id, sections[i]]));
  const sideBySide = (rect: { top: number; height: number }) => [
    { top: rect.top, height: rect.height },
    { top: rect.top, height: rect.height },
  ];
  const eventInfo = byId.get("event-info");
  const family = byId.get("family");
  const celebrations = byId.get("celebrations");
  return {
    ...(eventInfo && { "event-info": sideBySide(eventInfo) }),
    ...(family && { family: sideBySide(family) }),
    ...(celebrations && { celebrations: splitRect(celebrations, 6) }),
  };
}

function piecesInGroup(
  line: ReturnType<typeof threadLine>,
  group: ReturnType<typeof threadLine>["sections"][number],
) {
  return line.pieces.filter(
    (piece) =>
      piece.id === group.id &&
      piece.start >= group.start &&
      piece.end <= group.end,
  );
}

function groupHolding(
  line: ReturnType<typeof threadLine>,
  id: (typeof THREAD_IDS)[number],
  kind: string,
  occurrence = 0,
): number {
  const piece = line.pieces.filter((p) => p.id === id && p.kind === kind)[
    occurrence
  ];
  if (piece === undefined)
    throw new Error(`no ${kind} #${occurrence} in ${id}`);
  return line.sections.findIndex(
    (group) =>
      group.id === id && piece.start >= group.start && piece.end <= group.end,
  );
}

test("with no subdivisions given, every group is exactly one section, its rect the section's own -- unchanged from before this file supported splitting", () => {
  const band = "wide";
  const sections = measuredSections(band);
  const withoutArg = threadLine(band, sections);
  const withEmptyObject = threadLine(band, sections, undefined, {});

  for (const line of [withoutArg, withEmptyObject]) {
    assert.equal(line.sections.length, THREAD_IDS.length);
    assert.equal(line.groupRects.length, THREAD_IDS.length);
    line.sections.forEach((group, i) => {
      assert.equal(group.id, THREAD_IDS[i]);
      assert.deepEqual(line.groupRects[i], {
        top: sections[i].top,
        height: sections[i].height,
      });
    });
  }
});

test("no group is ever empty -- every group spans length and holds at least one piece, at every band, stacked or side by side", () => {
  for (const band of ["tall", "upright", "wide"] as const) {
    const sections = measuredSections(band);
    for (const [shape, subdivisions] of [
      ["stacked", subdivisionsFor(sections)],
      ["side by side", sideBySideSubdivisionsFor(sections)],
    ] as const) {
      const line = threadLine(band, sections, undefined, subdivisions);
      line.sections.forEach((group, i) => {
        assert.ok(
          group.end > group.start,
          `${band} (${shape}): ${group.id}'s group ${i} spans no length`,
        );
        assert.ok(
          piecesInGroup(line, group).length > 0,
          `${band} (${shape}): ${group.id}'s group ${i} holds no piece`,
        );
      });
    }
  }
});

test("at a stacked band, event-info and family split into two groups each, with each card's motif in its own group; celebrations, one piece, stays one group", () => {
  for (const band of ["tall", "upright"] as const) {
    const sections = measuredSections(band);
    const line = threadLine(
      band,
      sections,
      undefined,
      subdivisionsFor(sections),
    );
    const countFor = (id: (typeof THREAD_IDS)[number]) =>
      line.sections.filter((group) => group.id === id).length;

    assert.equal(countFor("event-info"), 2, `${band}: event-info`);
    assert.notEqual(
      groupHolding(line, "event-info", "rings"),
      groupHolding(line, "event-info", "knot"),
      `${band}: rings and knot sit in different cards, so they must fall in different groups`,
    );
    assert.equal(countFor("family"), 2, `${band}: family`);
    assert.notEqual(
      groupHolding(line, "family", "portraitLoop", 0),
      groupHolding(line, "family", "portraitLoop", 1),
      `${band}: the two portraitLoop placements sit in different cards, so they must fall in different groups`,
    );
    /* The redraw crosses Celebrations as one connector with no motif, and a group never splits a
       piece, so however it is sliced it stays one group. */
    assert.equal(countFor("celebrations"), 1, `${band}: celebrations`);
    for (const id of THREAD_IDS) {
      if (id === "event-info" || id === "family" || id === "celebrations")
        continue;
      assert.equal(
        countFor(id),
        1,
        `${band}: ${id} was not asked to split and must not`,
      );
    }
  }
});

test("at wide, a side-by-side pair shares one scroll window, so event-info and family each stay one group", () => {
  const band = "wide";
  const sections = measuredSections(band);
  const line = threadLine(
    band,
    sections,
    undefined,
    sideBySideSubdivisionsFor(sections),
  );
  const countFor = (id: (typeof THREAD_IDS)[number]) =>
    line.sections.filter((group) => group.id === id).length;

  assert.equal(countFor("event-info"), 1);
  assert.equal(countFor("family"), 1);
  assert.equal(countFor("celebrations"), 1);
  for (const id of THREAD_IDS) {
    if (id === "event-info" || id === "family" || id === "celebrations")
      continue;
    assert.equal(countFor(id), 1, `${id} was not asked to split and must not`);
  }
});

test("groups are contiguous end to end, covering [0, length] exactly, even when a section splits into several", () => {
  const band = "wide";
  const sections = measuredSections(band);
  const subdivisions = subdivisionsFor(sections);
  const { sections: groups, length } = threadLine(
    band,
    sections,
    undefined,
    subdivisions,
  );

  assert.equal(groups[0].start, 0);
  for (let i = 1; i < groups.length; i++) {
    assert.equal(
      groups[i].start,
      groups[i - 1].end,
      `group ${i} does not start where group ${i - 1} ended`,
    );
  }
  assert.equal(groups[groups.length - 1].end, length);
});

test("each group's rect is one of the rects it was given -- the section's own whole rect when unsplit, or one of the measured card/row rects when split", () => {
  const band = "wide";
  const sections = measuredSections(band);
  const subdivisions = subdivisionsFor(sections);
  const { sections: groups, groupRects } = threadLine(
    band,
    sections,
    undefined,
    subdivisions,
  );

  groups.forEach((group, i) => {
    const rect = groupRects[i];
    const candidates =
      subdivisions[group.id] ??
      (() => {
        const index = THREAD_IDS.indexOf(group.id);
        return [{ top: sections[index].top, height: sections[index].height }];
      })();
    assert.ok(
      candidates.some(
        (candidate) =>
          Math.abs(candidate.top - rect.top) < 1e-9 &&
          Math.abs(candidate.height - rect.height) < 1e-9,
      ),
      `${group.id}'s group ${i} carries a rect that was never handed in for it`,
    );
  });
});

test("event-info's two groups are ordered card 1 then card 2 -- the first group's rect sits above the second's", () => {
  for (const band of ["tall", "upright"] as const) {
    const sections = measuredSections(band);
    const subdivisions = subdivisionsFor(sections);
    const { sections: groups, groupRects } = threadLine(
      band,
      sections,
      undefined,
      subdivisions,
    );

    const indices = groups
      .map((group, i) => ({ group, i }))
      .filter(({ group }) => group.id === "event-info")
      .map(({ i }) => i);
    assert.equal(indices.length, 2, band);
    assert.ok(
      groupRects[indices[0]].top < groupRects[indices[1]].top,
      `${band}: card 1's group must be drawn before card 2's`,
    );
  }
});

test("AT MOST ONE PIECE IS MID-DRAW at any scroll position with card/row subdivisions active, swept across the whole page at all three bands", () => {
  for (const band of ["tall", "upright", "wide"] as const) {
    const sections = measuredSections(band);
    const subdivisions = subdivisionsFor(sections);
    const {
      sections: groups,
      groupRects,
      pieces,
    } = threadLine(band, sections, undefined, subdivisions);
    const viewportBox = THREAD_BANDS.find((b) => b.id === band)?.box;
    if (viewportBox === undefined) throw new Error(`unknown band ${band}`);
    const viewportHeight = viewportBox.height;
    const totalHeight = sections.reduce((sum, s) => sum + s.height, 0);
    const maxScroll = Math.max(totalHeight - viewportHeight, 0);
    const step = 8;

    for (let scrollY = 0; scrollY <= maxScroll; scrollY += step) {
      const drawn = drawnLength(scrollY, viewportHeight, groupRects, groups);
      const midDraw = pieces.filter((piece) => {
        const progress = pieceProgress(drawn, piece);
        return progress > 1e-9 && progress < 1 - 1e-9;
      });
      assert.ok(
        midDraw.length <= 1,
        `${band} @ scrollY=${scrollY}, drawn=${drawn}: expected at most one piece mid-draw with subdivisions active, found ${midDraw.length} (${midDraw.map((p) => `${p.id}/${p.kind}`).join(", ")})`,
      );
    }
  }
});

test("with event-info split into two card groups, card 2's pieces (knot and its trailing connector) never read mid-draw or complete while card 1's own group is still mid-ramp", () => {
  const band = "tall";
  const sections = measuredSections(band);
  const subdivisions = subdivisionsFor(sections);
  const {
    sections: groups,
    groupRects,
    pieces,
  } = threadLine(band, sections, undefined, subdivisions);
  const viewportBox = THREAD_BANDS.find((b) => b.id === band)?.box;
  if (viewportBox === undefined) throw new Error(`unknown band ${band}`);
  const viewportHeight = viewportBox.height;
  const totalHeight = sections.reduce((sum, s) => sum + s.height, 0);
  const maxScroll = Math.max(totalHeight - viewportHeight, 0);

  const card1Group = groups.find((g) => g.id === "event-info");
  if (card1Group === undefined) throw new Error("event-info must split");
  const card2Pieces = pieces.filter(
    (p) => p.id === "event-info" && p.start >= card1Group.end,
  );
  assert.ok(card2Pieces.length > 0, "card 2 must own at least one piece");

  for (let scrollY = 0; scrollY <= maxScroll; scrollY += 8) {
    const drawn = drawnLength(scrollY, viewportHeight, groupRects, groups);
    const card1Progress = pieceProgress(drawn, card1Group);
    if (card1Progress > 1e-9 && card1Progress < 1 - 1e-9) {
      for (const piece of card2Pieces) {
        assert.equal(
          pieceProgress(drawn, piece),
          0,
          `card 2's ${piece.kind} must still be fully undrawn while card 1 (event-info) is mid-ramp at scrollY ${scrollY}`,
        );
      }
    }
  }
});

/* THE RATCHET -- the owner's "and then stay drawn". These
   assert BEHAVIOUR, not the source's spelling: `drawnLength` is a pure function of `scrollY` with
   no memory, so without a ratchet at the call site the thread unravels on the way back up and is
   gone again at scroll 0. */
test("the ratchet never reduces the drawn length on the way back up", () => {
  const ratchet = createDrawRatchet();
  const descent = [0, 120, 400, 900, 1500, 2400];
  for (const drawn of descent) ratchet.advance(drawn);
  const peak = descent.at(-1) ?? 0;
  for (const drawn of [...descent].reverse()) {
    assert.equal(
      ratchet.advance(drawn),
      peak,
      `scrolling back up to a drawn length of ${drawn} must still report the peak`,
    );
  }
  assert.equal(
    ratchet.advance(0),
    peak,
    "returning to the very top must keep the thread drawn",
  );
});

test("the ratchet still advances past its own peak", () => {
  const ratchet = createDrawRatchet();
  ratchet.advance(1000);
  ratchet.advance(200);
  assert.equal(ratchet.advance(1400), 1400);
});

/* A resize or a font load re-measures the page, and the path's total length changes with it -- a
   maximum held over from the old layout can exceed the new total, which would clamp every piece to
   fully drawn. `rebase` scales it between the two totals instead of discarding it: discarding it is
   a visible defect on a phone, where a URL bar fires `resize` DURING a scroll, so zeroing the peak
   let the thread un-draw itself every time a reader changed direction. */
test("rebase keeps the reader's proportion of the thread when the page grows", () => {
  const ratchet = createDrawRatchet();
  assert.equal(ratchet.advance(500), 500);
  ratchet.rebase(1000, 2000);
  // Half the thread was drawn; half of the longer thread is 1000.
  assert.equal(ratchet.advance(0), 1000);
});

test("rebase never leaves a peak longer than the new total", () => {
  // A resize that makes the page SHORTER than current progress -- the exact failure the old
  // `reset` existed to prevent, which a rebase must not reintroduce.
  const ratchet = createDrawRatchet();
  ratchet.advance(900);
  ratchet.rebase(1000, 400);
  const peak = ratchet.advance(0);
  assert.ok(peak <= 400, `peak ${peak} exceeds the new total 400`);
  assert.equal(peak, 360); // 0.9 of 400
});

test("rebase before any measurement cannot divide by zero", () => {
  // oldTotal 0. An Infinity from a measured-value divisor has killed a renderer in this project
  // once, so the zero case is asserted rather than reasoned about.
  const ratchet = createDrawRatchet();
  ratchet.advance(300);
  ratchet.rebase(0, 1200);
  const peak = ratchet.advance(0);
  assert.ok(Number.isFinite(peak), `peak is ${peak}`);
  assert.equal(peak, 0);
});

test("rebase to a zero total yields zero, not NaN", () => {
  const ratchet = createDrawRatchet();
  ratchet.advance(300);
  ratchet.rebase(1000, 0);
  assert.equal(ratchet.advance(0), 0);
});

test("advance is still monotonic across a rebase", () => {
  const ratchet = createDrawRatchet();
  ratchet.advance(800);
  ratchet.rebase(1000, 1000); // identical layout: a no-op
  assert.equal(ratchet.advance(10), 800);
});

test("two ratchets hold their own maximum", () => {
  const trunk = createDrawRatchet();
  const weave = createDrawRatchet();
  trunk.advance(900);
  assert.equal(weave.advance(10), 10);
  assert.equal(trunk.advance(0), 900);
});

test("splitSubpaths returns one entry per M", () => {
  const parts = splitSubpaths("M 0 0 C 1 1 2 2 3 3 M 4 4 C 5 5 6 6 7 7 M 8 8");
  assert.equal(parts.length, 3);
  for (const part of parts) assert.match(part, /^M /);
});

test("each band emits one subpath per piece, and its section ranges are contiguous and cover them all", () => {
  for (const band of THREAD_BANDS) {
    const { d, pieces } = threadLine(
      band.id,
      authoredMeasuredSections(band.id),
    );
    const total = splitSubpaths(d).length;
    assert.equal(pieces.length, total, `${band.id}: one subpath per piece`);
    let next = 0;
    for (const id of THREAD_IDS) {
      const { start, end } = subpathRange(band.id, id);
      assert.equal(start, next, `${band.id}/${id} starts where the last ended`);
      assert.ok(end > start, `${band.id}/${id} owns at least one subpath`);
      next = end;
    }
    assert.equal(
      next,
      total,
      `${band.id}: the ranges cover all ${total} subpaths`,
    );
  }
});

/* MOTIF JOINS — a connector is warped per axis and a motif baked uniformly (portraits anchored to
   the photo), so away from the authored size the connector's end misses the motif's. The join is
   carried along the connector and turned onto the motif's own direction, never just snapped. */

/** A subpath sampled along its cubics, so a direction is read over visible line. */
function sampled(d: string): Point[] {
  const p = parseAllPoints(d);
  const out = [p[0]];
  for (let i = 1; i + 2 < p.length; i += 3) {
    const a = out[out.length - 1];
    for (let t = 1; t <= 16; t += 1) {
      const u = t / 16;
      const v = 1 - u;
      out.push({
        x:
          v * v * v * a.x +
          3 * v * v * u * p[i].x +
          3 * v * u * u * p[i + 1].x +
          u * u * u * p[i + 2].x,
        y:
          v * v * v * a.y +
          3 * v * v * u * p[i].y +
          3 * v * u * u * p[i + 1].y +
          u * u * u * p[i + 2].y,
      });
    }
  }
  return out;
}

/** The first point `reach` px along a run of points. */
function alongBy(points: Point[], reach: number): Point {
  let run = 0;
  for (let i = 1; i < points.length; i += 1) {
    run += Math.hypot(
      points[i].x - points[i - 1].x,
      points[i].y - points[i - 1].y,
    );
    if (run >= reach) return points[i];
  }
  return points[points.length - 1];
}

/** A MOTIF's direction leaving its first point, over its first 3px of visible line. */
function leaving(d: string): number {
  const p = sampled(d);
  const q = alongBy(p, 3);
  return Math.atan2(q.y - p[0].y, q.x - p[0].x);
}

/** A MOTIF's direction arriving at its last point, over its last 3px of visible line. */
function arriving(d: string): number {
  const p = sampled(d).reverse();
  const q = alongBy(p, 3);
  return Math.atan2(p[0].y - q.y, p[0].x - q.x);
}

/** A CONNECTOR's own direction at an end, off the control point beside it: its tangent there. */
function tangentAt(d: string, end: "start" | "finish"): number {
  const p = end === "start" ? parseAllPoints(d) : parseAllPoints(d).reverse();
  const q =
    p.slice(1).find((r) => Math.hypot(r.x - p[0].x, r.y - p[0].y) > 1e-9) ??
    p[0];
  const a = Math.atan2(q.y - p[0].y, q.x - p[0].x);
  return end === "start" ? a : a + Math.PI;
}

function turnDegrees(a: number, b: number): number {
  let d = Math.abs(a - b) % (2 * Math.PI);
  if (d > Math.PI) d = 2 * Math.PI - d;
  return (d * 180) / Math.PI;
}

/** Sections stretched from the authored ones by `sx` across the card and `sy` down the section. */
function stretched(
  band: "tall" | "upright" | "wide",
  sx: number,
  sy: number,
): MeasuredSection[] {
  let top = 0;
  return THREAD_IDS.map((id) => {
    const from = authoredCard(id, band);
    const height = from.sectionHeight * sy;
    const section = {
      top,
      height,
      cardLeft: from.cardLeft * sx,
      cardWidth: from.cardWidth * sx,
    };
    top += height;
    return section;
  });
}

const STRETCHES: [number, number][] = [
  [0.7, 1],
  [1.3, 1],
  [1, 0.75],
  [1, 1.4],
  [0.85, 1.2],
  [1.6, 0.9],
];

test("every connector meets its motif in the motif's own direction, on any stretched layout", () => {
  for (const { id: band } of THREAD_BANDS)
    for (const [sx, sy] of STRETCHES) {
      const { d, pieces } = threadLine(band, stretched(band, sx, sy));
      const subpaths = splitSubpaths(d);
      pieces.forEach((piece, i) => {
        if (piece.kind === "connector") return;
        const where = `${band} ${sx}x${sy} ${piece.id}/${piece.kind}`;
        const before = parseAllPoints(subpaths[i - 1]).at(-1) as Point;
        const into = parseAllPoints(subpaths[i])[0];
        const out = parseAllPoints(subpaths[i]).at(-1) as Point;
        const after = parseAllPoints(subpaths[i + 1])[0];
        assert.ok(
          Math.hypot(before.x - into.x, before.y - into.y) < 0.01,
          `${where}: gap in`,
        );
        assert.ok(
          Math.hypot(out.x - after.x, out.y - after.y) < 0.01,
          `${where}: gap out`,
        );
        const turnIn = turnDegrees(
          tangentAt(subpaths[i - 1], "finish"),
          leaving(subpaths[i]),
        );
        const turnOut = turnDegrees(
          arriving(subpaths[i]),
          tangentAt(subpaths[i + 1], "start"),
        );
        assert.ok(
          turnIn < 1,
          `${where}: turns ${turnIn.toFixed(1)}° into the motif`,
        );
        assert.ok(
          turnOut < 1,
          `${where}: turns ${turnOut.toFixed(1)}° out of it`,
        );
      });
    }
});

test("a connector bends into its motif gradually: no 3px of its last 30px turns more than 40°", () => {
  /* Turning only the end's control point onto the motif squeezes the whole turn into the last few
     pixels — a hook, measured past 100°. Redrawing the last stretch spreads it. The owner's own
     drawing bends up to ~25° in 3px near some motifs at the authored size, so the bound sits above
     that. */
  const hook = (points: Point[]) => {
    const steps: Point[] = [points[0]];
    let run = 0;
    for (let i = 1; i < points.length && run < 30; i += 1) {
      run += Math.hypot(
        points[i].x - points[i - 1].x,
        points[i].y - points[i - 1].y,
      );
      const last = steps[steps.length - 1];
      if (Math.hypot(points[i].x - last.x, points[i].y - last.y) >= 3)
        steps.push(points[i]);
    }
    let worst = 0;
    for (let i = 1; i + 1 < steps.length; i += 1) {
      const a = Math.atan2(
        steps[i].y - steps[i - 1].y,
        steps[i].x - steps[i - 1].x,
      );
      const b = Math.atan2(
        steps[i + 1].y - steps[i].y,
        steps[i + 1].x - steps[i].x,
      );
      worst = Math.max(worst, turnDegrees(a, b));
    }
    return worst;
  };
  for (const { id: band } of THREAD_BANDS)
    for (const [sx, sy] of STRETCHES) {
      const { d, pieces } = threadLine(band, stretched(band, sx, sy));
      const subpaths = splitSubpaths(d);
      pieces.forEach((piece, i) => {
        if (piece.kind !== "connector") return;
        const where = `${band} ${sx}x${sy} ${piece.id} connector`;
        if (pieces[i + 1] && pieces[i + 1].kind !== "connector") {
          const worst = hook(sampled(subpaths[i]).reverse());
          assert.ok(
            worst <= 40,
            `${where} into ${pieces[i + 1].kind}: ${worst.toFixed(0)}°`,
          );
        }
        if (pieces[i - 1] && pieces[i - 1].kind !== "connector") {
          const worst = hook(sampled(subpaths[i]));
          assert.ok(
            worst <= 40,
            `${where} out of ${pieces[i - 1].kind}: ${worst.toFixed(0)}°`,
          );
        }
      });
    }
});

test("beyond its join's reach along a connector, the connector is the plain warped drawing", () => {
  const band = "wide";
  const sections = stretched(band, 1.3, 0.9);
  const { d, pieces } = threadLine(band, sections);
  const subpaths = splitSubpaths(d);
  let checked = 0;
  THREAD_IDS.forEach((id, s) => {
    const plain = threadPaths(band, id).map((c) =>
      parseAllPoints(warpSection(c.d, authoredCard(id, band), sections[s])),
    );
    const drawn = pieces.flatMap((p, i) =>
      p.id === id && p.kind === "connector"
        ? [parseAllPoints(subpaths[i])]
        : [],
    );
    plain.forEach((points, k) => {
      /* Anchors only (every third point after the first), each at its chord-summed distance from
         the connector's two ends. */
      const anchors = points.filter((_, i) => i % 3 === 0);
      const fromStart = [0];
      for (let i = 1; i < anchors.length; i++)
        fromStart.push(
          fromStart[i - 1] +
            Math.hypot(
              anchors[i].x - anchors[i - 1].x,
              anchors[i].y - anchors[i - 1].y,
            ),
        );
      const total = fromStart[fromStart.length - 1];
      /* Each end's reach follows how far that end had to move to meet its motif. */
      const own = drawn[k];
      const startMove = Math.hypot(
        own[0].x - points[0].x,
        own[0].y - points[0].y,
      );
      const finishMove = Math.hypot(
        (own.at(-1) as Point).x - (points.at(-1) as Point).x,
        (own.at(-1) as Point).y - (points.at(-1) as Point).y,
      );
      /* An end that moved may also have turned, by up to 180°: take the widest reach it could have. */
      const startReach =
        startMove > 1e-9 ? joinReach(startMove, total, 180) : 0;
      const finishReach =
        finishMove > 1e-9 ? joinReach(finishMove, total, 180) : 0;
      anchors.forEach((p, i) => {
        if (
          fromStart[i] < startReach + 1 ||
          total - fromStart[i] < finishReach + 1
        )
          return;
        /* A redrawn stretch drops points, so the anchor is found by position, not index. */
        const q = drawn[k].reduce((a, b) =>
          Math.hypot(b.x - p.x, b.y - p.y) < Math.hypot(a.x - p.x, a.y - p.y)
            ? b
            : a,
        );
        assert.ok(
          Math.hypot(p.x - q.x, p.y - q.y) < 1e-6,
          `${id} connector ${k} anchor ${i} moved`,
        );
        checked += 1;
      });
    });
  });
  assert.ok(checked > 50, `${checked} anchors checked`);
});

test("a join's reach is four times how far the end moved and a pixel a degree it turned, at least JOIN_EASE, at most half the connector", () => {
  assert.equal(joinReach(2, 1000), JOIN_EASE);
  assert.equal(joinReach(30, 1000), 120);
  assert.equal(joinReach(200, 1000), 500);
  assert.equal(joinReach(2, 1000, 100), 100);
});

test("at the authored size, every connector is its drawing beyond its joins' reach, in every band", () => {
  for (const band of THREAD_BANDS) {
    const identity = stretched(band.id, 1, 1);
    const { d, pieces } = threadLine(band.id, identity);
    const subpaths = splitSubpaths(d);
    let checked = 0;
    THREAD_IDS.forEach((id, s) => {
      const plain = threadPaths(band.id, id).map((c) =>
        parseAllPoints(
          warpSection(c.d, authoredCard(id, band.id), identity[s]),
        ),
      );
      const drawn = pieces.flatMap((p, i) =>
        p.id === id && p.kind === "connector"
          ? [parseAllPoints(subpaths[i])]
          : [],
      );
      plain.forEach((points, k) => {
        const anchors = points.filter((_, i) => i % 3 === 0);
        const fromStart = [0];
        for (let i = 1; i < anchors.length; i++)
          fromStart.push(
            fromStart[i - 1] +
              Math.hypot(
                anchors[i].x - anchors[i - 1].x,
                anchors[i].y - anchors[i - 1].y,
              ),
          );
        const total = fromStart[fromStart.length - 1];
        /* The widest reach each end can take: how far it moved, and a full turn's worth. */
        const own = drawn[k];
        const startMove = Math.hypot(
          own[0].x - points[0].x,
          own[0].y - points[0].y,
        );
        const finishMove = Math.hypot(
          (own.at(-1) as Point).x - (points.at(-1) as Point).x,
          (own.at(-1) as Point).y - (points.at(-1) as Point).y,
        );
        const startReach = joinReach(startMove, total, 180);
        const finishReach = joinReach(finishMove, total, 180);
        anchors.forEach((p, i) => {
          if (
            fromStart[i] < startReach + 1 ||
            total - fromStart[i] < finishReach + 1
          )
            return;
          const q = drawn[k].reduce((a, b) =>
            Math.hypot(b.x - p.x, b.y - p.y) < Math.hypot(a.x - p.x, a.y - p.y)
              ? b
              : a,
          );
          assert.ok(
            Math.hypot(p.x - q.x, p.y - q.y) < 1e-6,
            `${band.id} ${id} connector ${k} anchor ${i}`,
          );
          checked += 1;
        });
      });
    });
    assert.ok(checked > 20, `${band.id}: ${checked} anchors checked`);
  }
});

/* PORTRAIT RING SIZE — a ring wraps a real photo, and the photo follows the page's width tier, not
   the card: an iPad mini shows the phone's 72px photo in a card wider than the tablet's. */
test("a portrait ring is sized from its photo: ring width over photo width holds at any photo size", () => {
  for (const { id: band } of THREAD_BANDS) {
    const sections = stretched(band, 1, 1);
    const familyIndex = THREAD_IDS.indexOf("family");
    const ringWidths = (photo: number | undefined) => {
      const anchors = MOTIF_PLACEMENTS[band].family.map((placement) => {
        if (placement.motif !== "portraitLoop" || photo === undefined)
          return undefined;
        const at = warpPlacement(
          placement,
          authoredCard("family", band),
          sections[familyIndex],
        );
        return {
          left: at.x - photo / 2,
          top: at.y - photo / 2,
          width: photo,
          height: photo,
        };
      });
      const { d, pieces } = threadLine(band, sections, { family: anchors });
      const subpaths = splitSubpaths(d);
      return pieces.flatMap((piece, i) => {
        if (piece.kind !== "portraitLoop") return [];
        const xs = parseAllPoints(subpaths[i]).map((p) => p.x);
        return [Math.max(...xs) - Math.min(...xs)];
      });
    };
    const authored = portraitPhotoWidth(band);
    const atAuthored = ringWidths(authored);
    const unanchored = ringWidths(undefined);
    for (const photo of [authored / 2, authored * 1.5]) {
      ringWidths(photo).forEach((width, k) => {
        const ratio = width / photo / (atAuthored[k] / authored);
        assert.ok(
          Math.abs(ratio - 1) < 0.01,
          `${band} ring ${k} at a ${photo}px photo: ${ratio.toFixed(3)}× its authored proportion`,
        );
      });
    }
    /* A photo that cannot be found falls back to a zero-size anchor: the ring keeps its plain size. */
    ringWidths(0).forEach((width, k) => {
      assert.ok(
        Math.abs(width / unanchored[k] - 1) < 0.01,
        `${band} ring ${k}: a zero-size anchor keeps the plain size`,
      );
    });
    atAuthored.forEach((width, k) => {
      assert.ok(
        Math.abs(width / unanchored[k] - 1) < 0.01,
        `${band} ring ${k}: at the authored photo the ring keeps its authored size`,
      );
    });
  }
});

/* The centre of the largest circle inside a ring that touches none of its samples: where the photo
   it wraps sits. Searched coarse then fine around a first guess. */
function emptyCircle(points: Point[], guess: Point): Point & { r: number } {
  const clearance = (x: number, y: number) =>
    Math.min(...points.map((p) => Math.hypot(p.x - x, p.y - y)));
  let best = { x: guess.x, y: guess.y, r: clearance(guess.x, guess.y) };
  for (const [reach, step] of [
    [30, 1],
    [1.5, 0.05],
  ]) {
    const around = { x: best.x, y: best.y };
    for (let x = around.x - reach; x <= around.x + reach; x += step)
      for (let y = around.y - reach; y <= around.y + reach; y += step) {
        const r = clearance(x, y);
        if (r > best.r) best = { x, y, r };
      }
  }
  return best;
}

const HALF_STROKE = 1.1;

/* The ring's loop is not centred in its drawing's square, so placing the square's centre on the photo
   left every ring 10–15px off it, its strands across the face. */
test("an anchored portrait ring's loop is centred on its photo and no strand crosses it", () => {
  for (const { id: band } of THREAD_BANDS) {
    for (const [sx, sy] of [
      [1, 1],
      [0.75, 1.2],
    ]) {
      const sections = stretched(band, sx, sy);
      const familyIndex = THREAD_IDS.indexOf("family");
      const photo = portraitPhotoWidth(band) * sx;
      const anchors = MOTIF_PLACEMENTS[band].family.map((placement) => {
        const at = warpPlacement(
          placement,
          authoredCard("family", band),
          sections[familyIndex],
        );
        return {
          left: at.x - photo / 2,
          top: at.y - photo / 2,
          width: photo,
          height: photo,
        };
      });
      const { d, pieces } = threadLine(band, sections, { family: anchors });
      const subpaths = splitSubpaths(d);
      let k = 0;
      pieces.forEach((piece, i) => {
        if (piece.kind !== "portraitLoop") return;
        const anchor = anchors[k++];
        const centre = {
          x: anchor.left + photo / 2,
          y: anchor.top + photo / 2,
        };
        const loop = emptyCircle(sampled(subpaths[i]), centre);
        const off = Math.hypot(loop.x - centre.x, loop.y - centre.y);
        assert.ok(
          off < 0.5,
          `${band} ${sx}×${sy} ring ${k - 1}: loop centre ${off.toFixed(1)}px off its photo`,
        );
        const nearest = Math.min(
          ...sampled(subpaths[i]).map((p) =>
            Math.hypot(p.x - centre.x, p.y - centre.y),
          ),
        );
        assert.ok(
          nearest - HALF_STROKE > photo / 2,
          `${band} ${sx}×${sy} ring ${k - 1}: a strand ${(photo / 2 - nearest + HALF_STROKE).toFixed(1)}px over the photo`,
        );
      });
    }
  }
});

/* Unanchored at the authored size — the page before the photos are measured, and the generator's own
   fit — each ring's loop sits on the photo the drawing was made around. */
test("at the authored size each generated ring's loop is centred on its portrait", () => {
  for (const { id: band } of THREAD_BANDS) {
    const layout = JSON.parse(
      readFileSync(`assets/thread/${band}/photo-layout.json`, "utf8"),
    ) as {
      portraits: Point[];
      sections: { id: string; top: number }[];
    };
    const top = layout.sections.find((s) => s.id === "family")?.top ?? 0;
    const sections = stretched(band, 1, 1);
    const familyTop = sections[THREAD_IDS.indexOf("family")].top;
    const { d, pieces } = threadLine(band, sections);
    const subpaths = splitSubpaths(d);
    /* The drawn page lists its portraits in page order: the bride third, the groom last; the first
       ring is the bride's. */
    const people = [
      layout.portraits[2],
      layout.portraits[layout.portraits.length - 1],
    ].map((p) => ({ x: p.x, y: p.y - top + familyTop }));
    let ring = 0;
    pieces.forEach((piece, i) => {
      if (piece.kind !== "portraitLoop") return;
      const points = sampled(subpaths[i]);
      const portrait = people[ring++];
      const loop = emptyCircle(points, portrait);
      const off = Math.hypot(loop.x - portrait.x, loop.y - portrait.y);
      assert.ok(
        off < 0.5,
        `${band} ring at (${portrait.x}, ${portrait.y}): loop centre ${off.toFixed(1)}px off its portrait`,
      );
    });
  }
});

/* The ring fit picks where the line enters and leaves each ring; a line that reaches the ring by
   crossing its photo first reads as the thread over the face. */
test("at the authored size no line crosses the photo its ring wraps", () => {
  for (const { id: band } of THREAD_BANDS) {
    const layout = JSON.parse(
      readFileSync(`assets/thread/${band}/photo-layout.json`, "utf8"),
    ) as {
      portraits: Point[];
      sections: { id: string; top: number }[];
    };
    const top = layout.sections.find((s) => s.id === "family")?.top ?? 0;
    const sections = stretched(band, 1, 1);
    const familyIndex = THREAD_IDS.indexOf("family");
    const familyTop = sections[familyIndex].top;
    const photo = portraitPhotoWidth(band);
    const portraits = layout.portraits.map((p) => ({
      x: p.x,
      y: p.y - top + familyTop,
    }));
    const ringed = MOTIF_PLACEMENTS[band].family.map((placement) => {
      const at = { x: placement.x, y: placement.y + familyTop };
      return portraits.reduce((a, b) =>
        Math.hypot(a.x - at.x, a.y - at.y) <= Math.hypot(b.x - at.x, b.y - at.y)
          ? a
          : b,
      );
    });
    const anchors = ringed.map((c) => ({
      left: c.x - photo / 2,
      top: c.y - photo / 2,
      width: photo,
      height: photo,
    }));
    const { d, pieces } = threadLine(band, sections, { family: anchors });
    const subpaths = splitSubpaths(d);
    pieces.forEach((piece, i) => {
      if (piece.id !== "family") return;
      for (const c of ringed) {
        const nearest = Math.min(
          ...sampled(subpaths[i]).map((p) => Math.hypot(p.x - c.x, p.y - c.y)),
        );
        assert.ok(
          nearest - HALF_STROKE > photo / 2,
          `${band} family piece ${i} (${piece.kind}) is ${(photo / 2 - nearest + HALF_STROKE).toFixed(1)}px over the photo at (${c.x}, ${c.y})`,
        );
      }
    });
  }
});

/* The generator joins each connector to the motif's ends as the page draws them — a portrait ring
   trimmed at its tails — so at the authored size no join has to move, and the owner's drawing
   stands as drawn rather than being redrawn into the motif. */
test("at the authored size every connector already meets its motif: no end moves half a pixel", () => {
  for (const { id: band } of THREAD_BANDS) {
    const identity = stretched(band, 1, 1);
    const { d, pieces } = threadLine(band, identity);
    const subpaths = splitSubpaths(d);
    THREAD_IDS.forEach((id, s) => {
      const plain = threadPaths(band, id).map((c) =>
        parseAllPoints(warpSection(c.d, authoredCard(id, band), identity[s])),
      );
      pieces
        .flatMap((p, i) => (p.id === id && p.kind === "connector" ? [i] : []))
        .forEach((i, k) => {
          const drawn = parseAllPoints(subpaths[i]);
          if (pieces[i - 1] && pieces[i - 1].kind !== "connector") {
            const moved = Math.hypot(
              drawn[0].x - plain[k][0].x,
              drawn[0].y - plain[k][0].y,
            );
            assert.ok(
              moved < 0.5,
              `${band} ${id} connector ${k} start moved ${moved.toFixed(1)}px to meet ${pieces[i - 1].kind}`,
            );
          }
          if (pieces[i + 1] && pieces[i + 1].kind !== "connector") {
            const a = drawn.at(-1) as Point;
            const b = plain[k].at(-1) as Point;
            const moved = Math.hypot(a.x - b.x, a.y - b.y);
            assert.ok(
              moved < 0.5,
              `${band} ${id} connector ${k} end moved ${moved.toFixed(1)}px to meet ${pieces[i + 1].kind}`,
            );
          }
        });
    });
  }
});

/* A short connector can need its whole length for the join: the redraw must still leave its far end
   as it was, or the join at that end is undone by this one. */
test("a join that reaches a short connector's far end leaves that end and its direction as they were", () => {
  const d = "M 0 0 C 10 0 20 5 30 10 C 40 15 50 30 60 40";
  const far = { x: 60, y: 40 };
  const farDirection = Math.atan2(40 - 30, 60 - 50);
  const out = joined(d, "start", { x: 20, y: -30 }, { x: 0, y: 1 });
  const n = (out.match(/-?\d*\.?\d+(?:[eE][-+]?\d+)?/g) ?? []).map(Number);
  const end = { x: n[n.length - 2], y: n[n.length - 1] };
  const before = { x: n[n.length - 4], y: n[n.length - 3] };
  assert.ok(
    Math.hypot(end.x - far.x, end.y - far.y) < 1e-6,
    "the far end stays put",
  );
  const direction = Math.atan2(end.y - before.y, end.x - before.x);
  assert.ok(
    Math.abs(direction - farDirection) < (0.5 * Math.PI) / 180,
    `the far end arrives at ${((direction * 180) / Math.PI).toFixed(1)}°, was ${((farDirection * 180) / Math.PI).toFixed(1)}°`,
  );
});
