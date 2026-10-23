import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import {
  BASE_WIDTH,
  builtChunks,
  butts,
  COVER,
  colourToken,
  OPTIONS,
  pxToken,
  tokenValue,
} from "../../scripts/built-tokens.ts";
import {
  deltaE,
  HEAD_LENGTH_RATIO,
  type HeadOptions,
  type HeadSegment,
  headSegments,
  headStepCount,
} from "./thread-head.ts";
import { dashForPiece } from "./thread-progress.ts";

/* One piece 400 long, drawn to a fraction of it. `drawn` is the page-level scalar, which on a
   single piece starting at 0 is just the length drawn so far. */
const SINGLE = [{ start: 0, end: 400 }];
const drawnAt = (progress: number, length = 400) => progress * length;

/* The ink's own tip: `dashForPiece` paints (period * progress) of a piece, clipped to its length.
   Asserted through that function rather than restated, so a change to the epsilon reaches here. */
function inkTip(length: number, progress: number): number {
  const { dasharray, dashoffset } = dashForPiece(length, progress);
  return Math.min(length, dasharray - dashoffset);
}

test("nothing mid-draw means no head, at either end of the thread", () => {
  assert.deepEqual(headSegments(0, SINGLE, OPTIONS), []);
  assert.deepEqual(headSegments(400, SINGLE, OPTIONS), []);
  assert.deepEqual(headSegments(9999, SINGLE, OPTIONS), []);
});

test("the stack is widest and hottest at the tip and falls off behind it", () => {
  const segments = butts(headSegments(drawnAt(0.5), SINGLE, OPTIONS));
  assert.equal(segments.length, headStepCount(OPTIONS));
  for (let i = 1; i < segments.length; i += 1) {
    assert.ok(
      segments[i].step === segments[i - 1].step + 1,
      "one segment per step, in order",
    );
    assert.ok(
      segments[i].width <= segments[i - 1].width,
      `step ${i} must be no wider than step ${i - 1}`,
    );
  }
  const distanceFromTip = (segment: HeadSegment): number => {
    const [r, g, b] = segment.stroke.match(/\d+/g)?.map(Number) ?? [];
    return deltaE([r, g, b], OPTIONS.tipColor);
  };
  for (let i = 1; i < segments.length; i += 1) {
    assert.ok(
      distanceFromTip(segments[i]) >= distanceFromTip(segments[i - 1]),
      `step ${i} must be no closer to the tip colour than step ${i - 1}`,
    );
  }
  assert.ok(
    distanceFromTip(segments[segments.length - 1]) >
      distanceFromTip(segments[0]) + 10,
    "the ramp must actually span the tail colour to the tip colour",
  );
});

test("the tip-most step ends at the drawn tip, plus the reach that covers the ink's round cap", () => {
  for (const progress of [0.1, 0.25, 0.5, 0.75, 0.9]) {
    const tip = inkTip(400, progress);
    const [first] = butts(headSegments(drawnAt(progress), SINGLE, OPTIONS));
    assert.equal(first.step, 0);
    assert.ok(
      first.end - tip > BASE_WIDTH / 2,
      "the leading edge clears the ink's round cap, not merely meets it",
    );
    assert.ok(
      Math.abs(first.end - COVER - tip) < 1e-9,
      `at ${progress} the tip step ends ${first.end - tip} past the tip, not ${COVER}`,
    );
    assert.ok(
      Math.abs(
        first.end -
          first.start -
          (OPTIONS.length / headStepCount(OPTIONS) + COVER),
      ) < 1e-9,
      "the tip step is one step long plus its reach",
    );
  }
});

test("nothing paints past the tip's reach at any progress", () => {
  const pieces = [
    { start: 0, end: 300 },
    { start: 300, end: 700 },
  ];
  for (let step = 1; step < 700; step += 3) {
    for (const segment of headSegments(step, pieces, OPTIONS)) {
      const piece = pieces[segment.piece];
      const tip = pieces
        .map((p, index) => ({ p, index }))
        .filter(({ p }) => step > p.start)
        .map(({ p }) => {
          const length = p.end - p.start;
          return (
            p.start + inkTip(length, Math.min(1, (step - p.start) / length))
          );
        })
        .reduce((most, value) => Math.max(most, value), 0);
      assert.ok(
        piece.start + segment.end <= tip + COVER + 1e-9,
        `drawn ${step}: a step reaches ${piece.start + segment.end}, past tip ${tip} + ${COVER}`,
      );
      assert.ok(
        segment.end <= piece.end - piece.start + 1e-9,
        "inside its piece",
      );
      assert.ok(segment.start >= -1e-9, "inside its piece");
    }
  }
});

test("the head is the last stretch of the drawn line, so it crosses a piece boundary whole", () => {
  const pieces = [
    { start: 0, end: 300 },
    { start: 300, end: 700 },
  ];
  /* 10px into the second piece: the head's tail lies 86px back, in the first. A head kept per piece
     would shrink to a 10px stub here and regrow. */
  const drawn = 310;
  const segments = headSegments(drawn, pieces, OPTIONS);
  const inFirst = segments.filter((segment) => segment.piece === 0);
  const inSecond = segments.filter((segment) => segment.piece === 1);
  assert.ok(
    inFirst.length > 0 && inSecond.length > 0,
    "both pieces carry a slice",
  );
  const tip = 300 + inkTip(400, 10 / 400);
  const globalStarts = butts(segments).map(
    (segment) => pieces[segment.piece].start + segment.start,
  );
  assert.ok(
    Math.abs(Math.min(...globalStarts) - (tip - OPTIONS.length)) < 1e-9,
    "the tail is a full head length behind the tip",
  );
});

test("a head near the start of the thread is the tip end of the ramp, not a squashed whole", () => {
  const segments = butts(headSegments(drawnAt(0.05), SINGLE, OPTIONS));
  const tip = inkTip(400, 0.05);
  assert.ok(tip < OPTIONS.length);
  assert.ok(segments.every((segment) => segment.start >= 0));
  assert.equal(
    segments.length,
    Math.ceil(tip / (OPTIONS.length / headStepCount(OPTIONS))),
    "one run per step that lies on the drawn line, and no stub past its start",
  );
  assert.equal(segments[0].step, 0, "the tip step is still the first");
});

/* The owner judged the colours BETWEEN the stops on every lab render, so the vermilion middle stop
   is a settled design value, not an implementation detail. The step count is 14 with or without it
   (26.6 direct, 27.1 through vermilion), so counting steps cannot defend it: this asserts the ramp's
   actual colour where vermilion sits on it. */
test("the ramp passes through vermilion, where vermilion sits on it", () => {
  const segments = butts(headSegments(drawnAt(0.9), SINGLE, OPTIONS));
  const steps = segments.length;
  const vermilionAt =
    deltaE(OPTIONS.tailColor, OPTIONS.midColor) /
    (deltaE(OPTIONS.tailColor, OPTIONS.midColor) +
      deltaE(OPTIONS.midColor, OPTIONS.tipColor));
  let nearest = segments[0];
  for (const segment of segments) {
    const along = 1 - (segment.step + 0.5) / steps;
    const best = 1 - (nearest.step + 0.5) / steps;
    if (Math.abs(along - vermilionAt) < Math.abs(best - vermilionAt)) {
      nearest = segment;
    }
  }
  const [r, g, b] = nearest.stroke.match(/\d+/g)?.map(Number) ?? [];
  const distance = deltaE([r, g, b], OPTIONS.midColor);
  assert.ok(
    distance < 0.5,
    `the step at the vermilion stop is ${distance.toFixed(2)} from vermilion (${nearest.stroke})`,
  );
});

test("the step count follows the colour span as well as the length", () => {
  assert.equal(headStepCount(OPTIONS), 14, "14 at the shipped values");

  const longer = { ...OPTIONS, length: 160 };
  assert.equal(headStepCount(longer), 20, "length: ceil(160 / 8)");

  const flat: HeadOptions = {
    ...OPTIONS,
    midColor: OPTIONS.tailColor,
    tipColor: OPTIONS.tailColor,
  };
  assert.equal(headStepCount(flat), 12, "no colour span leaves ceil(96 / 8)");

  const paler: HeadOptions = { ...OPTIONS, tipColor: [255, 178, 87] };
  assert.ok(
    headStepCount(paler) > headStepCount(OPTIONS),
    "a longer colour span needs more steps",
  );
  assert.ok(headStepCount({ ...OPTIONS, length: 4000 }) <= 48, "capped at 48");
});

test("each step runs under the one in front of it by a hair, as insurance against a seam", () => {
  const segments = butts(headSegments(drawnAt(0.5), SINGLE, OPTIONS));
  for (let i = 1; i < segments.length; i += 1) {
    const overlap = segments[i].end - segments[i - 1].start;
    assert.ok(overlap > 0, `step ${i} must overlap step ${i - 1}`);
    assert.ok(overlap <= 2, `step ${i} overlaps step ${i - 1} by only a hair`);
  }
});

test("the width tapers from the tip width at the tip to the base width at the tail", () => {
  const segments = butts(headSegments(drawnAt(0.9), SINGLE, OPTIONS));
  const steps = segments.length;
  const quantum = (OPTIONS.tipWidth - OPTIONS.baseWidth) / steps;
  assert.ok(segments[0].width <= OPTIONS.tipWidth);
  assert.ok(
    segments[0].width >= OPTIONS.tipWidth - quantum,
    "the tip step is within one step of the tip width",
  );
  const tail = segments[steps - 1];
  assert.ok(tail.width >= OPTIONS.baseWidth);
  assert.ok(
    tail.width <= OPTIONS.baseWidth + quantum,
    "the tail step is within one step of the base width",
  );
});

test("paint order lays the tip over its own tail and later pieces over earlier ones", () => {
  const pieces = [
    { start: 0, end: 60 },
    { start: 60, end: 400 },
  ];
  const segments = headSegments(120, pieces, OPTIONS);
  const rankOf = (piece: number, step: number) =>
    segments.find(
      (s) => s.piece === piece && s.step === step && s.cap === "butt",
    )?.rank;
  const tipRank = rankOf(1, 0);
  const tailRank = rankOf(1, 3);
  assert.ok(tipRank !== undefined && tailRank !== undefined);
  assert.ok(
    tipRank > tailRank,
    "within a piece the tip end lies over the tail",
  );
  const inFirst = segments.filter((segment) => segment.piece === 0);
  assert.ok(inFirst.length > 0, "the head reaches back into the first piece");
  for (const early of inFirst) {
    for (const late of segments.filter((segment) => segment.piece === 1)) {
      assert.ok(
        late.rank > early.rank,
        "a later piece lies over an earlier one",
      );
    }
  }
  for (const segment of segments) {
    const same = segments.filter((other) => other.rank === segment.rank);
    assert.equal(same.length, 1, "no two segments share a rank");
  }
});

test("a tip at a piece's end is covered by a round-capped cover, since no butt step runs past the path", () => {
  const pieces = [
    { start: 0, end: 300 },
    { start: 300, end: 700 },
  ];
  /* Piece 0 fully painted, piece 1 not begun: the ink's round cap sits at the end of piece 0, where
     the clipped butt step stops short of it. */
  const segments = headSegments(300, pieces, OPTIONS);
  const dots = segments.filter((segment) => segment.cap === "round");
  assert.equal(dots.length, 1, "exactly one round-capped cover");
  assert.equal(dots[0].piece, 0);
  assert.ok(Math.abs(dots[0].end - 300) < 1e-9, "it ends at the piece's end");
  assert.equal(
    dots[0].width,
    Math.max(OPTIONS.baseWidth, OPTIONS.tipWidth),
    "the cover is as wide as the head",
  );
  for (const segment of butts(segments)) {
    assert.ok(
      segment.end <= 300 + 1e-9,
      "no butt step runs past the path's end",
    );
  }
  const midPiece = headSegments(150, pieces, OPTIONS);
  assert.equal(
    midPiece.filter((segment) => segment.cap === "round").length,
    0,
    "no cover away from a piece's end",
  );
});

test("the head is 60 times the base stroke, 96px at the shipped width", () => {
  assert.equal(HEAD_LENGTH_RATIO, 60);
  assert.ok(Math.abs(OPTIONS.length - 96) < 1e-9);
});

/* Owner-tuned values, chosen on live renders (2026-09-30): pinned so a fitting step or a stray edit
   cannot move them unseen. The code reads every one of these from the built stylesheet, so this is
   the only copy of the number outside tokens.css itself. */
test("the head's owner-chosen values are the ones in the stylesheet", () => {
  assert.deepEqual(colourToken("color-thread-core"), [0xff, 0x79, 0x00]);
  assert.equal(pxToken("stroke-thread-head"), 3.2);
  assert.equal(pxToken("stroke-thread"), 1.6);
});

/* Any failure here is also a prompt to re-fit `FITTED_GLOW` (`thread-retrace.ts`): the re-trace's eight
   glow alphas were fitted to the falloff of exactly these radii and alphas, so retuning the halo
   leaves them describing a halo that no longer exists. */
test("the head's halo is the bleed's own shape at four times the radii", () => {
  const shadows = (name: string) =>
    [
      ...tokenValue(name).matchAll(
        /0 0 ([\d.]+)px color-mix\(in srgb, var\(([\w-]+)\) (\d+)%/g,
      ),
    ].map((match) => ({
      radius: Number(match[1]),
      colour: match[2],
      alpha: Number(match[3]),
    }));
  const bleed = shadows("bleed-thread");
  const halo = shadows("halo-thread-head");
  assert.equal(bleed.length, 3);
  assert.equal(halo.length, 3);
  bleed.forEach((shadow, index) => {
    assert.equal(halo[index].colour, shadow.colour);
    assert.equal(halo[index].alpha, shadow.alpha);
    assert.equal(halo[index].radius, shadow.radius * 4);
  });
  assert.deepEqual(
    halo.map((shadow) => shadow.radius),
    [3.5, 12, 33],
    "the halo's radii changed: FITTED_GLOW's eight alphas were fitted to the falloff of THESE radii " +
      "and alphas, so re-fit them and re-measure MEASURED_HALO before updating this expectation",
  );
});

/* TRIPWIRE, not a design value. The two literals below (`3.2px`, `#ff7900`) are the owner's current
   head values, repeated here only because the assertion is about the BUILT artifact. When the owner
   retunes either, this test failing is expected: update the literal to the new token value, do not
   delete the test. The other half of it, that the built script reads every token by name and carries
   no copy, is the part that must keep holding. */
test("the built page reads the head's values from the built stylesheet rather than carrying copies", (t) => {
  if (!existsSync("out/_next/static/chunks")) {
    t.skip("no static export: run `npm run build` first");
    return;
  }
  const css = builtChunks(".css");
  const script = builtChunks(".js");
  for (const token of [
    "--stroke-thread-head:3.2px",
    "--color-thread-core:#ff7900",
    "--halo-thread-head:drop-shadow(",
  ]) {
    assert.ok(
      css.replace(/\s+/g, "").includes(token),
      `${token} is not in the built CSS`,
    );
  }
  for (const token of [
    "--stroke-thread",
    "--stroke-thread-head",
    "--color-thread-red",
    "--color-thread-vermilion",
    "--color-thread-core",
  ]) {
    assert.ok(
      script.includes(`"${token}"`),
      `${token} is not read by name in the built script`,
    );
  }
  assert.doesNotMatch(script, /tipWidth:\s*[\d.]/, "a literal tip width");
  assert.doesNotMatch(script, /baseWidth:\s*[\d.]/, "a literal base width");
  assert.doesNotMatch(
    script,
    /#ff7900|255,\s*121,\s*0\b/i,
    "a literal core colour",
  );
});
