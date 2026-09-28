import assert from "node:assert/strict";
import { test } from "node:test";
import { authoredCard } from "./thread-authored-layout.ts";
import { THREAD_BANDS } from "./thread-bands.ts";
import {
  drawnLength,
  PORTRAIT_LOOP_TRIM_FRACTION,
  type SectionRect,
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
   drawnLength — the piecewise, per-section progress map that replaces one global
   `scrollY / (scrollHeight - innerHeight)`. Synthetic sections and ranges below, never real
   THREAD_IDS/measured data, so each behaviour (not-reached, held-past, the 60% completion, a
   section no taller than the viewport, the invite's own start, the page's own end) can be pinned to
   hand-picked numbers instead of whatever a real layout happens to produce.

   OWNER DECISION, 2026-09-28: NO LEAD-IN. A section's own window is exactly `[top, top + height]` —
   see `sectionProgress`'s header comment in `thread-line.ts` for why the previous
   viewport-wide-lead-in window was replaced (it was why two adjacent one-screen sections always
   drew at once). Sections tile the page contiguously, so these windows now share only their
   boundary point and never overlap — asserted directly, across all three real bands, in "adjacent
   sections' windows never overlap..." below, rather than left as an assumption. */

const RANGE_IDS = THREAD_IDS; // borrow real ids only to satisfy the type; positional, not semantic.

test("drawnLength: a section not yet reached contributes zero, even once an earlier one is done", () => {
  // Two tall sections, well separated: A's window is [0, 5000] (windowStart clamped from -500 to
  // 0), draw-complete at 3000; B's window [4500, 10000] has not opened by 3500.
  const sectionRects = [
    { top: 0, height: 5000 },
    { top: 5000, height: 5000 },
  ];
  const ranges = [
    { id: RANGE_IDS[0], start: 0, end: 100 },
    { id: RANGE_IDS[1], start: 100, end: 250 },
  ];
  const viewportHeight = 500;

  assert.equal(drawnLength(0, viewportHeight, sectionRects, ranges), 0);
  // A is fully drawn and held (3500 > 3000); B's window opens at 4500, well past 3500.
  assert.equal(drawnLength(3500, viewportHeight, sectionRects, ranges), 100);
});

test("drawnLength: a section fully scrolled past contributes its full range and holds there, capped at the page's own end", () => {
  // A single section is also the LAST one, so its passage window's far edge (top + height = 1000)
  // sits past `maxScroll` (500 = 1000 total height - 500 viewport) -- the position at which the
  // section's bottom would reach the viewport's TOP, which the page can never be scrolled far
  // enough to reach (its bottom instead settles at the viewport's own bottom, at scrollY ===
  // maxScroll). Uncapped, the raw 60% mark (600) would fall past `maxScroll` and the thread would
  // never finish drawing -- `sectionProgress` caps `drawEnd` at `maxScroll` for exactly this case.
  const sectionRects = [{ top: 0, height: 1000 }];
  const ranges = [{ id: RANGE_IDS[0], start: 40, end: 140 }];
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

test("drawnLength: completes at 60% of a section's own window -- exactly [top, top + height], no lead-in -- and holds for the remaining 40%", () => {
  // Positioned away from the page's own start (top isn't 0) and followed by a much larger section,
  // so neither the windowStart clamp nor the maxScroll cap on drawEnd applies here -- this isolates
  // the plain 60%-of-window ramp on its own.
  const sectionRects = [
    { top: 1000, height: 1000 },
    { top: 2000, height: 5000 },
  ];
  const ranges = [
    { id: RANGE_IDS[0], start: 0, end: 100 },
    { id: RANGE_IDS[1], start: 100, end: 300 },
  ];
  const viewportHeight = 500;
  // window [1000, 2000] (the section's own extent, no viewport-wide lead-in), draw-complete at
  // 1000 + 0.6*1000 = 1600. B's own window opens at exactly 2000, where A's own ends, so 1900 still
  // reads A fully drawn and B untouched.

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
  assert.equal(drawnLength(1600, viewportHeight, sectionRects, ranges), 100);
  assert.equal(drawnLength(1900, viewportHeight, sectionRects, ranges), 100);
});

test("drawnLength: a LAST section no taller than the viewport has no room for a gradual ramp under the no-lead-in window, and pops complete at exactly maxScroll rather than sticking at 0 or reading complete from page load", () => {
  // height 200 < viewport 500, and this is the ONLY (so also the LAST) section: its own window
  // ([1000, 1200], no lead-in) opens at rect.top=1000, past maxScroll (700 = 1200-500) -- the last
  // reachable scrollY. `windowStart` clamps to `maxScroll` for exactly this reason
  // (`sectionProgress`'s own header comment in thread-line.ts): without the clamp this would either
  // compare scrollY against an unreachable windowStart and stay stuck at 0 forever, or -- comparing
  // a drawEnd already capped to maxScroll against that same unreachable windowStart -- read as
  // already-complete from scrollY 0. This is a genuine consequence of removing the lead-in for a
  // section this short at the very end of the page, not a bug to patch here -- see task-1-report.md.
  const sectionRects = [{ top: 1000, height: 200 }];
  const ranges = [{ id: RANGE_IDS[0], start: 0, end: 60 }];
  const viewportHeight = 500; // maxScroll = 1200 - 500 = 700.

  assert.equal(drawnLength(499, viewportHeight, sectionRects, ranges), 0);
  assert.equal(drawnLength(500, viewportHeight, sectionRects, ranges), 0);
  assert.equal(drawnLength(600, viewportHeight, sectionRects, ranges), 0);
  assert.equal(drawnLength(700, viewportHeight, sectionRects, ranges), 60);
  assert.equal(drawnLength(900, viewportHeight, sectionRects, ranges), 60);
});

test("drawnLength: the invite's own real shape -- top 0, one screen tall -- has not started at scrollY 0, and draws gradually rather than popping", () => {
  // windowStart is exactly rect.top (0), no lead-in to clamp -- "at scrollY 0 the invite's thread
  // has not started" now holds as a direct consequence of the window's own definition, not a
  // clamp on a window that would otherwise have opened before the page existed (the opening
  // sequence's own fade already establishes the static starting state at hand-off; scroll drawing
  // has to build from there). The second section sits far down the (synthetic) page -- not
  // contiguous with the first -- purely so its own window opens well past every scroll position
  // this test samples, keeping the invite's own ramp isolated from it and from the maxScroll cap.
  const sectionRects = [
    { top: 0, height: 700 },
    { top: 100000, height: 5000 },
  ];
  const ranges = [
    { id: RANGE_IDS[0], start: 0, end: 90 },
    { id: RANGE_IDS[1], start: 90, end: 300 },
  ];
  const viewportHeight = 700;
  // window [0, 700], draw-complete at 0.6 * 700 = 420.

  assert.equal(drawnLength(0, viewportHeight, sectionRects, ranges), 0);
  const justStarted = drawnLength(1, viewportHeight, sectionRects, ranges);
  assert.ok(
    justStarted > 0 && justStarted < 1,
    `expected a tiny, non-zero amount just after scrolling begins, got ${justStarted} -- Task 2's original degenerate branch popped straight to 90 here`,
  );
  assert.ok(
    Math.abs(drawnLength(210, viewportHeight, sectionRects, ranges) - 45) <
      0.01,
    "halfway to the 60% mark (210 of 420) should read half drawn",
  );
  assert.equal(drawnLength(420, viewportHeight, sectionRects, ranges), 90);
});

test("drawnLength: a page that cannot scroll at all reads as already complete, never stuck", () => {
  // The whole page fits within one viewport: maxScroll clamps to 0, and the section's own
  // windowStart clamps to 0 too, so drawEnd (min(rawDrawEnd, 0)) also lands at 0 -- there is no
  // scroll room to reveal it gradually, so it renders complete rather than stuck at zero forever
  // with no gesture able to move it (the same choice this project already makes under reduced
  // motion and no-JS). Not a shape any of this project's six real sections take on its own, but a
  // legitimate synthetic input this pure function must not divide by zero on.
  const sectionRects = [{ top: 0, height: 300 }];
  const ranges = [{ id: RANGE_IDS[0], start: 0, end: 50 }];
  const viewportHeight = 1000; // taller than the whole page.

  assert.equal(drawnLength(0, viewportHeight, sectionRects, ranges), 50);
});

test("drawnLength is monotonic in scrollY across the whole page, swept at fine resolution", () => {
  const sectionRects = [
    { top: 0, height: 1000 },
    { top: 1000, height: 1000 },
    { top: 2000, height: 200 }, // shorter than the viewport, mixed in on purpose.
    { top: 2200, height: 1500 },
  ];
  const ranges = [
    { id: RANGE_IDS[0], start: 0, end: 100 },
    { id: RANGE_IDS[1], start: 100, end: 250 },
    { id: RANGE_IDS[2], start: 250, end: 300 },
    { id: RANGE_IDS[3], start: 300, end: 480 },
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

  // The maxScroll cap on drawEnd (see sectionProgress) guarantees this holds regardless of how
  // viewportHeight compares to any individual section's own height, unlike Task 2's original
  // window, which needed viewportHeight smaller than every section to avoid its degenerate branch.
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
   NO LEAD-IN: at most one section is ever mid-ramp, and adjacent windows never overlap. This is
   the property the owner actually asked for (session.md, 2026-09-28) and the reason this task
   exists -- everything above pins individual numbers; this sweeps the real page shape at every
   band and checks the property directly, isolating each section's own contribution rather than
   reading only the summed total `drawnLength` returns. */

/* Zeroing every OTHER section's own range width makes `drawnLength`'s per-section term the only
   non-zero addend (`total += progress * (range.end - range.start)`), so dividing by the one
   section's own (arbitrary, fixed) width recovers `sectionProgress`'s own 0-1 value exactly --
   without needing to export it, and while still driving `pageMaxScroll` off the REAL, unmodified
   `sectionRects`, so the maxScroll every section is judged against matches what the page itself
   would compute. */
const ISOLATION_WIDTH = 100;

function isolatedProgress(
  sectionRects: readonly SectionRect[],
  ids: readonly (typeof THREAD_IDS)[number][],
  index: number,
  scrollY: number,
  viewportHeight: number,
): number {
  const ranges = ids.map((id, i) => ({
    id,
    start: 0,
    end: i === index ? ISOLATION_WIDTH : 0,
  }));
  return (
    drawnLength(scrollY, viewportHeight, sectionRects, ranges) / ISOLATION_WIDTH
  );
}

test("adjacent sections' windows never overlap, and at most one section is mid-ramp at any scroll position -- swept across all three real bands", () => {
  for (const band of ["tall", "upright", "wide"] as const) {
    const sections = measuredSections(band);
    const viewportBox = THREAD_BANDS.find((b) => b.id === band)?.box;
    if (viewportBox === undefined) throw new Error(`unknown band ${band}`);
    const viewportHeight = viewportBox.height;
    const totalHeight = sections.reduce((sum, s) => sum + s.height, 0);
    const maxScroll = Math.max(totalHeight - viewportHeight, 0);
    const step = 4;

    for (let scrollY = 0; scrollY <= maxScroll; scrollY += step) {
      let midRampCount = 0;
      for (let i = 0; i < sections.length; i++) {
        const progress = isolatedProgress(
          sections,
          THREAD_IDS,
          i,
          scrollY,
          viewportHeight,
        );
        if (progress > 1e-6 && progress < 1 - 1e-6) midRampCount++;
      }
      assert.ok(
        midRampCount <= 1,
        `${band} @ scrollY=${scrollY}: expected at most one section mid-ramp, found ${midRampCount}`,
      );
    }

    // Stated directly, not just inferred from the sweep above: the scrollY at which section i's
    // own progress FIRST reaches 1 must not exceed (beyond one sweep step's resolution) the scrollY
    // at which section i+1's own progress first becomes non-zero -- section i+1's window has not
    // opened while section i is still ramping.
    function firstScrollYAt(index: number, threshold: number): number {
      for (let scrollY = 0; scrollY <= maxScroll; scrollY += step) {
        if (
          isolatedProgress(
            sections,
            THREAD_IDS,
            index,
            scrollY,
            viewportHeight,
          ) >= threshold
        ) {
          return scrollY;
        }
      }
      return maxScroll;
    }

    for (let i = 0; i < sections.length - 1; i++) {
      const completes = firstScrollYAt(i, 1 - 1e-6);
      const nextStarts = firstScrollYAt(i + 1, 1e-6);
      assert.ok(
        completes <= nextStarts + step,
        `${band}: section ${i} (${THREAD_IDS[i]}) completes at ${completes}, but section ${i + 1} (${THREAD_IDS[i + 1]}) starts at ${nextStarts} -- windows overlap`,
      );
    }
  }
});
