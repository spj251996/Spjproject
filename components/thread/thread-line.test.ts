import assert from "node:assert/strict";
import { test } from "node:test";
import { authoredCard } from "./thread-authored-layout.ts";
import { threadLine } from "./thread-line.ts";
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
