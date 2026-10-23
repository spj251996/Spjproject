import assert from "node:assert/strict";
import test from "node:test";
import { BASE_WIDTH } from "../../scripts/lib/built-tokens.ts";
import {
  TAPER_CUT_WIDTH,
  type TaperSegment,
  taperCut,
  taperReached,
  taperSegments,
} from "./thread-taper.ts";

/* ---------------------------------------------------------------------------------------------
   THE TAPER. A tapered end is a stack of butt-capped runs of the piece, each a little narrower than
   the one before, so it is tested the way the head's stack is: as arc-length ranges and widths,
   with no DOM. */

const TAPER = { steps: 5, taperLength: 10, strokeWidth: 1.6 };

test("a taper narrows toward the end it sits on", () => {
  const segments = taperSegments(400, 400, 1, TAPER);
  assert.equal(segments.length, TAPER.steps);
  segments.forEach((segment, i) => {
    assert.equal(segment.index, i, "index 0 is the innermost, widest run");
  });
  for (let i = 1; i < segments.length; i += 1) {
    assert.ok(
      segments[i].width < segments[i - 1].width,
      `segment ${i} must be narrower than ${i - 1}: a taper only narrows`,
    );
  }
  assert.ok(
    segments[0].width <= TAPER.strokeWidth &&
      segments[0].width > TAPER.strokeWidth * 0.8,
    "the innermost run is nearly the ink's own width, so it meets the ink without a step",
  );
  const last = segments[segments.length - 1];
  assert.ok(
    last.width < TAPER.strokeWidth * 0.5,
    "the last run must be well under half the stroke, or it is not a taper",
  );
  assert.ok(last.width > 0, "and never a zero-width run");
});

test("the last run is a hairline, not a vanishing stroke", () => {
  const fine = taperSegments(400, 400, 1, {
    steps: 16,
    taperLength: 40,
    strokeWidth: 1.6,
  });
  assert.equal(fine.length, 16);
  for (const segment of fine) {
    assert.ok(segment.width >= 0.2, `run ${segment.index} is ${segment.width}`);
  }
});

test("the taper never reaches past its own end, in either direction", () => {
  const forwards = taperSegments(400, 400, 1, TAPER);
  for (const segment of forwards) {
    assert.ok(segment.end <= 400 + 1e-9, "a forward taper stops at its end");
    assert.ok(segment.start >= 0 && segment.start < segment.end);
  }
  const backwards = taperSegments(0, 400, -1, TAPER);
  for (const segment of backwards) {
    assert.ok(segment.start >= -1e-9, "a backward taper stops at its end");
    assert.ok(segment.end <= 400 && segment.start < segment.end);
  }
});

test("a taper covers exactly its length, the narrowest run at the end", () => {
  const forwards = taperSegments(400, 400, 1, TAPER);
  assert.ok(Math.abs(forwards[forwards.length - 1].end - 400) < 1e-9);
  const outer = forwards[forwards.length - 1];
  const step = TAPER.taperLength / TAPER.steps;
  assert.ok(
    outer.end - outer.start >= step && outer.end - outer.start <= step + 2,
    "the outermost run is one step long, plus only its inward overlap",
  );
  const innermost = Math.min(...forwards.map((s) => s.start));
  assert.ok(
    innermost >= 400 - TAPER.taperLength - 1 - 1e-9 &&
      innermost < 400 - TAPER.taperLength,
    "it begins a taper length back, less only the inward overlap",
  );
  const backwards = taperSegments(0, 400, -1, TAPER);
  assert.ok(Math.abs(backwards[backwards.length - 1].start) < 1e-9);
});

test("a taper at the path's start mirrors one at its end", () => {
  const atEnd = taperSegments(400, 400, 1, TAPER);
  const atStart = taperSegments(0, 400, -1, TAPER);
  assert.deepEqual(
    atStart.map((s) => s.width),
    atEnd.map((s) => s.width),
    "the same widths, whichever way the end points",
  );
  /* Index 0 is the innermost run in both, so it sits FURTHEST from the end. */
  assert.ok(atStart[0].start > atStart[atStart.length - 1].start);
  assert.ok(atEnd[0].start < atEnd[atEnd.length - 1].start);
});

test("a taper longer than the path available is clamped, not overrun", () => {
  const short = taperSegments(4, 400, 1, { ...TAPER, taperLength: 40 });
  assert.equal(short.length, TAPER.steps, "the steps are kept and shortened");
  for (const segment of short) {
    assert.ok(segment.start >= 0, "no run begins before the path does");
    assert.ok(segment.end <= 4 + 1e-9, "and none passes the end");
    assert.ok(segment.end > segment.start, "and every run is still a run");
  }
  assert.ok(
    Math.abs(Math.max(...short.map((s) => s.end)) - 4) < 1e-9,
    "the narrowest run is still at the end",
  );
  const near = taperSegments(396, 400, -1, { ...TAPER, taperLength: 40 });
  for (const segment of near) {
    assert.ok(segment.end > segment.start, "every run is still a run");
    assert.ok(segment.end <= 400, "no run ends after the path does");
    assert.ok(segment.start >= 396 - 1e-9, "and none passes the end");
  }
});

test("a run is lent a hair of the run inside it, so the seam between two cannot open", () => {
  const segments = taperSegments(400, 400, 1, TAPER);
  for (let i = 1; i < segments.length; i += 1) {
    const overlap = segments[i - 1].end - segments[i].start;
    assert.ok(overlap > 0 && overlap <= 2, `run ${i} overlaps run ${i - 1}`);
  }
});

function reach(segments: readonly TaperSegment[]) {
  return segments.map((s) => s.end);
}

test("a run shows once the ink has drawn all the way along it", () => {
  const segments = taperSegments(400, 400, 1, TAPER);
  const ends = reach(segments);
  assert.ok(
    segments.every((s) => !taperReached(s, 0)),
    "nothing before the ink",
  );
  assert.ok(
    segments.every((s) => taperReached(s, 400)),
    "everything once drawn",
  );
  const partway = ends[2] - 0.5;
  assert.deepEqual(
    segments.map((s) => taperReached(s, partway)),
    [true, true, false, false, false],
    "a run the ink has only half-drawn stays hidden, for the head to cover",
  );
  const atStart = taperSegments(0, 400, -1, TAPER);
  assert.ok(
    atStart.every((s) => !taperReached(s, 0.5)) &&
      atStart.every((s) => taperReached(s, 400)),
    "the start end is reached the same way: ink grows from arc 0",
  );
});

test("the cut-back takes the ink off exactly the tapered stretch and a margin past the free end", () => {
  const forwards = taperCut(400, 400, 1, 10);
  assert.equal(forwards.from, 390, "it begins where the taper does");
  assert.equal(forwards.to, 400 + TAPER_CUT_WIDTH / 2);
  const backwards = taperCut(0, 400, -1, 10);
  assert.equal(backwards.to, 10);
  assert.equal(backwards.from, -TAPER_CUT_WIDTH / 2);
  const clamped = taperCut(4, 400, 1, 40);
  assert.equal(clamped.from, 0, "a taper longer than the path is clamped");
});

test("the cut is wider than the ink, so it takes the ink's round cap and antialiased edge", () => {
  assert.ok(
    TAPER_CUT_WIDTH / 2 > BASE_WIDTH / 2 + 1,
    "half the cut clears the ink's cap by more than a pixel",
  );
});
