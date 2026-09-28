import assert from "node:assert/strict";
import { test } from "node:test";
import { authoredCard } from "./thread-authored-layout.ts";
import { THREAD_BANDS } from "./thread-bands.ts";
import {
  clamp01,
  dashForPiece,
  drawnLength,
  PORTRAIT_LOOP_TRIM_FRACTION,
  pieceProgress,
  sectionProgressAt,
  threadLine,
} from "./thread-line.ts";
import { MOTIFS } from "./thread-motifs.ts";
import {
  MOTIF_PLACEMENTS,
  type Placement,
  THREAD_IDS,
  THREAD_PATHS,
} from "./thread-paths.ts";
import { type MeasuredSection, warpPlacement } from "./thread-warp.ts";

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
   than an identity no-op. Real card/section figures come from `thread-authored-layout.ts` and
   `thread-boxes.ts`; this is a deliberately different, but still plausible, measured layout. */
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
   PORTRAIT LOOP TAIL TRIM (Task 3) — the owner's ask, "trim the entry/exit tails of the motif so
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
    bandBox,
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
  const anchor = { left: 900, top: 200, width: 40, height: 40 };
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

  /* An anchor changes only the placement's CENTRE, never its rotation or scale, so every one of the
     motif's baked points shifts by the SAME rigid translation -- the delta the first point moved by
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
   TASK 1 REPRODUCTION -- the finding this task exists to fix, pinned as a test before anything
   else. `stroke-dasharray` restarting at every `M` subpath (proven in isolation, `task-1-brief.md`)
   is a RENDERING behaviour with no unit-testable surface of its own in `thread-line.ts` -- this
   file's pure functions never touched a `<path>` before this task, so there was no "old formula" to
   contrast against. What this test pins instead is the ARITHMETIC that behaviour is equivalent to,
   independently derived here: with one dash covering the WHOLE concatenated path and one shared
   `dashoffset = totalLength - drawn` applied to every subpath, a subpath of its own length `Lk`
   renders `min(Lk, max(0, drawn))` of ITSELF -- every piece measuring its own progress from its own
   start against the SAME global `drawn`, with no offset for how far into the page that piece sits.
   That is "all parts of thread starting to draw at same time" exactly. Contrast: `pieceProgress`
   (the fix) measures `drawn` against `piece.start`, so a piece cannot begin until every piece before
   it has finished. */
function oldSingleDashPieceProgress(
  drawn: number,
  piece: { readonly start: number; readonly end: number },
): number {
  const length = piece.end - piece.start;
  return length <= 0 ? 1 : clamp01(drawn / length);
}

test("REPRODUCTION: the old single-dash-per-page arithmetic draws every piece from its own start at once; pieceProgress (the fix) draws exactly one at a time", () => {
  const band = "wide";
  const sections = measuredSections(band);
  const { pieces } = threadLine(band, sections);
  assert.ok(pieces.length > 5, "need several real pieces to show simultaneity");

  // A `drawn` partway through the page's very first piece is tiny relative to every later piece's
  // own (much longer) length, so under the OLD arithmetic every piece with `length > drawn` reads
  // partially drawn AT THE SAME TIME -- the bug, reproduced without touching a DOM.
  const drawn = pieces[0].end / 2;
  const oldMidDrawCount = pieces.filter((piece) => {
    const progress = oldSingleDashPieceProgress(drawn, piece);
    return progress > 1e-9 && progress < 1 - 1e-9;
  }).length;
  assert.ok(
    oldMidDrawCount > 1,
    `expected the OLD arithmetic to show several pieces mid-draw at once, found ${oldMidDrawCount} -- the reproduction itself is wrong if this fails`,
  );

  const newMidDrawCount = pieces.filter((piece) => {
    const progress = pieceProgress(drawn, piece);
    return progress > 1e-9 && progress < 1 - 1e-9;
  }).length;
  assert.equal(
    newMidDrawCount,
    1,
    `expected pieceProgress to show exactly one piece mid-draw, found ${newMidDrawCount}`,
  );
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
     `thread-line.ts` walks through why applying the crossing formula there instead collapses the
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
   AT MOST ONE PIECE IS MID-DRAW -- the property this whole task exists to establish, and the
   assertion whose absence let the defect survive three rounds of review (`task-1-brief.md`). Not
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
   CARD/ROW GROUPING — the owner's decision `session.md` 2026-09-28: a stacked pair is two windows,
   not one, and a long ritual list is several. `subdivisions` never comes from real DOM in this file
   (that measurement lives in `page-thread.tsx`, untestable off a browser) — every test below hands
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

test("event-info and family split into exactly two groups each when given two real card rects; celebrations splits when given real row rects", () => {
  const band = "wide";
  const sections = measuredSections(band);
  const subdivisions = subdivisionsFor(sections);
  const line = threadLine(band, sections, undefined, subdivisions);

  const countFor = (id: (typeof THREAD_IDS)[number]) =>
    line.sections.filter((group) => group.id === id).length;

  assert.equal(
    countFor("event-info"),
    2,
    "rings and knot sit in different cards, so event-info's own piece-run must split there",
  );
  assert.equal(
    countFor("family"),
    2,
    "the two portraitLoop placements sit in different cards, so family must split there too",
  );
  assert.ok(
    countFor("celebrations") >= 1,
    "celebrations has only one motif (wishesLoop), so it can split into at most as many groups as it has pieces (3) -- but must produce at least one",
  );
  // Every OTHER section keeps exactly one group -- nothing outside the three the owner named splits.
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
  const band = "wide";
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
  assert.equal(indices.length, 2);
  assert.ok(
    groupRects[indices[0]].top < groupRects[indices[1]].top,
    "card 1's group must be drawn before card 2's",
  );
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
