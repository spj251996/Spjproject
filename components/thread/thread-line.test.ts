import assert from "node:assert/strict";
import { test } from "node:test";
import { authoredCard } from "./thread-authored-layout.ts";
import { drawnLength, threadLine } from "./thread-line.ts";
import { MOTIFS } from "./thread-motifs.ts";
import { MOTIF_PLACEMENTS, THREAD_IDS, THREAD_PATHS } from "./thread-paths.ts";
import type { MeasuredSection } from "./thread-warp.ts";

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
   THREAD_IDS/measured data, so each behaviour (not-reached, held-past, the 60% completion, the
   degenerate one-screen-tall section) can be pinned to hand-picked numbers instead of whatever a
   real layout happens to produce. */

const RANGE_IDS = THREAD_IDS; // borrow real ids only to satisfy the type; positional, not semantic.

test("drawnLength: a section not yet reached contributes zero, even once a later section is done", () => {
  // top 0-1000, 1000-2000, 2000-2200 (C is shorter than the viewport, the degenerate case).
  const sectionRects = [
    { top: 0, height: 1000 },
    { top: 1000, height: 1000 },
    { top: 2000, height: 200 },
  ];
  const ranges = [
    { id: RANGE_IDS[0], start: 0, end: 100 },
    { id: RANGE_IDS[1], start: 100, end: 250 },
    { id: RANGE_IDS[2], start: 250, end: 300 },
  ];
  const viewportHeight = 500;

  // At the very top, the first section's own window has not opened yet either.
  assert.equal(drawnLength(0, viewportHeight, sectionRects, ranges), 0);

  // A's window is [0, 500], draw-complete by 300. At 500, A is fully drawn and held, but B's window
  // ([1000, 1500]) and C's ([2000, 2200] — collapsed to the single point 2000) have not opened.
  assert.equal(drawnLength(500, viewportHeight, sectionRects, ranges), 100);
});

test("drawnLength: a section fully scrolled past contributes its full range and holds there", () => {
  const sectionRects = [{ top: 0, height: 1000 }];
  const ranges = [{ id: RANGE_IDS[0], start: 40, end: 140 }];
  const viewportHeight = 500;

  // Window is [0, 500], draw-complete at 300. Anywhere from 300 through well past the window's own
  // end must read the full 100px range -- the thread never un-draws once its section is behind.
  for (const scrollY of [300, 500, 900, 5000]) {
    assert.equal(
      drawnLength(scrollY, viewportHeight, sectionRects, ranges),
      100,
      `scrollY ${scrollY}: expected the full 100px range held`,
    );
  }
});

test("drawnLength: completes at 60% of a section's own scroll window, holds for the remaining 40%", () => {
  const sectionRects = [{ top: 0, height: 1000 }];
  const ranges = [{ id: RANGE_IDS[0], start: 0, end: 100 }];
  const viewportHeight = 500; // window [0, 500], draw-complete at 0.6 * 500 = 300.

  assert.equal(drawnLength(0, viewportHeight, sectionRects, ranges), 0);
  assert.ok(
    Math.abs(drawnLength(150, viewportHeight, sectionRects, ranges) - 50) <
      0.01,
    "halfway to the 60% mark should read half-drawn",
  );
  assert.equal(drawnLength(300, viewportHeight, sectionRects, ranges), 100);
  // Past the 60% mark but still inside the section's own window -- held, not still advancing.
  assert.equal(drawnLength(400, viewportHeight, sectionRects, ranges), 100);
  assert.equal(drawnLength(500, viewportHeight, sectionRects, ranges), 100);
});

test("drawnLength: a section no taller than the viewport draws in one step, never divides by zero", () => {
  // height 200 <= viewportHeight 500 -- the window collapses to a single point rather than a
  // negative-length band, which is the exact case a previous round lost monotonicity to.
  const sectionRects = [{ top: 1000, height: 200 }];
  const ranges = [{ id: RANGE_IDS[0], start: 0, end: 60 }];
  const viewportHeight = 500;

  assert.equal(drawnLength(999, viewportHeight, sectionRects, ranges), 0);
  // Strictly PAST the collapsed point, not AT it -- matching the non-degenerate ramp's own
  // convention of reading 0 exactly at its `windowStart` (see `sectionProgress`'s comment). A
  // section whose window starts at the very top of the page (the invite's, at `top: 0`) would
  // otherwise read fully drawn at `scrollY` 0, before the reader has scrolled at all.
  assert.equal(drawnLength(1000, viewportHeight, sectionRects, ranges), 0);
  assert.equal(drawnLength(1000.01, viewportHeight, sectionRects, ranges), 60);
  assert.equal(drawnLength(2000, viewportHeight, sectionRects, ranges), 60);
});

test("drawnLength: a degenerate section whose window starts at the very top of the page has not started at scrollY 0", () => {
  // This is the invite's own real shape: the first section, so `top: 0`, and no taller than the
  // viewport, so its window collapses to that same point -- the case the render caught.
  const sectionRects = [{ top: 0, height: 700 }];
  const ranges = [{ id: RANGE_IDS[0], start: 0, end: 90 }];
  const viewportHeight = 700;

  assert.equal(drawnLength(0, viewportHeight, sectionRects, ranges), 0);
  assert.equal(drawnLength(1, viewportHeight, sectionRects, ranges), 90);
});

test("drawnLength is monotonic in scrollY across the whole page, swept at fine resolution", () => {
  const sectionRects = [
    { top: 0, height: 1000 },
    { top: 1000, height: 1000 },
    { top: 2000, height: 200 }, // the degenerate, shorter-than-viewport case, mixed in on purpose.
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
});

test("drawnLength: at scrollY 0 nothing has started; at the page's max scroll every section is full", () => {
  const band = "wide";
  const sections = measuredSections(band);
  const { length, sections: ranges } = threadLine(band, sections);

  // Smaller than every synthetic section's own height (measuredSections scales the authored
  // 695/1320-unit heights by 0.9), so every window below is the ordinary non-degenerate case.
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
