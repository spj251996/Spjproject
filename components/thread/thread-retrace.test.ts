import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import {
  BASE_WIDTH,
  builtChunks,
  butts,
  COVER,
  OPTIONS,
  tokens,
  tokenValue,
} from "../../scripts/built-tokens.ts";
import {
  deltaE,
  type HeadOptions,
  type HeadSegment,
  type Rgb,
} from "./thread-head.ts";
import {
  parseCssCount,
  parseCssTime,
  RETRACE_GLOW,
  RETRACE_GLOW_SCALE,
  RETRACE_LENGTH_RATIO,
  retraceFade,
  retraceGlow,
  retraceLoopAt,
  retraceNominalMs,
  retracePeriodMs,
  retracePhase,
  retraceSegments,
  retraceSpan,
  retraceTargets,
  tipGroupIndex,
} from "./thread-retrace.ts";

/* ---------------------------------------------------------------------------------------------
   THE RE-TRACE — a lit segment that runs the complete line on a loop, and the page's scroll cue.
   The measured behaviour it follows is the owner's reference clip (measured by sampling its
   frames): the segment's length is not constant, its leading edge is hard and its trailing
   end soft, and nothing stays behind its tail. */

const RECTS = [
  { top: 0, height: 700 },
  { top: 700, height: 700 },
  { top: 1400, height: 700 },
  { top: 2100, height: 700 },
];

test("the phase turns over only when the whole thread has been drawn", () => {
  assert.equal(retracePhase(0, 1000), "drawing");
  assert.equal(retracePhase(999, 1000), "drawing");
  assert.equal(retracePhase(1000, 1000), "complete");
});

test("while drawing, only the group holding the tip may loop", () => {
  assert.deepEqual(
    retraceTargets("drawing", RECTS, { scrollY: 0, height: 700 }, 0),
    [0],
  );
  assert.deepEqual(
    retraceTargets("drawing", RECTS, { scrollY: 0, height: 700 }, undefined),
    [],
    "no tip, no loop",
  );
});

test("a tip that has scrolled off screen does not loop", () => {
  assert.deepEqual(
    retraceTargets("drawing", RECTS, { scrollY: 1400, height: 700 }, 0),
    [],
  );
});

test("once complete, every group ON SCREEN loops and none off it does", () => {
  assert.deepEqual(
    retraceTargets("complete", RECTS, { scrollY: 0, height: 700 }, undefined),
    [0],
  );
  assert.deepEqual(
    retraceTargets("complete", RECTS, { scrollY: 350, height: 700 }, undefined),
    [0, 1],
    "a viewport straddling two groups lights both",
  );
});

test("a group that only touches the viewport's edge is not on screen", () => {
  assert.deepEqual(
    retraceTargets("complete", RECTS, { scrollY: 0, height: 700 }, undefined),
    [0],
    "a group beginning exactly at the viewport's bottom edge is off it",
  );
  assert.deepEqual(
    retraceTargets("complete", RECTS, { scrollY: 700, height: 700 }, undefined),
    [1],
    "a group ending exactly at the viewport's top edge is off it",
  );
});

test("the last group holds the terminal and loops like any other, in either phase", () => {
  assert.deepEqual(
    retraceTargets(
      "complete",
      RECTS,
      { scrollY: 2100, height: 700 },
      undefined,
    ),
    [3],
    "at the final terminal the last group loops",
  );
  assert.deepEqual(
    retraceTargets(
      "complete",
      RECTS,
      { scrollY: 1750, height: 700 },
      undefined,
    ),
    [2, 3],
    "and the group before it still does",
  );
  assert.deepEqual(
    retraceTargets("drawing", RECTS, { scrollY: 2100, height: 700 }, 3),
    [3],
    "as does a tip that is still drawing it",
  );
});

test("once complete, some group loops at every scroll position, to the page's last pixel", () => {
  const pageHeight = 2800;
  for (let scrollY = 0; scrollY <= pageHeight - 700; scrollY += 5) {
    assert.ok(
      retraceTargets("complete", RECTS, { scrollY, height: 700 }, undefined)
        .length > 0,
      `nothing loops at ${scrollY}`,
    );
  }
});

const PEAK = RETRACE_LENGTH_RATIO * BASE_WIDTH;
const PHASES = Array.from({ length: 201 }, (_, i) => i / 200);

test("the segment is empty as a loop begins and as it ends, and grows and shrinks between", () => {
  for (const extent of [60, 400, 1500]) {
    const first = retraceSpan(0, extent, PEAK);
    const last = retraceSpan(1, extent, PEAK);
    assert.equal(first.tip - first.tail, 0, `extent ${extent} starts empty`);
    assert.ok(
      Math.abs(last.tip - last.tail) < 1e-9,
      `extent ${extent} ends empty`,
    );
    assert.ok(Math.abs(last.tip - extent) < 1e-9, "and at the end of the line");
    const lengths = PHASES.map((u) => {
      const { tail, tip } = retraceSpan(u, extent, PEAK);
      return tip - tail;
    });
    const longest = Math.max(...lengths);
    assert.ok(
      longest > 0.9 * Math.min(PEAK, extent),
      `extent ${extent}: the segment reaches its length`,
    );
    assert.ok(
      new Set(lengths.map((length) => length.toFixed(3))).size > 20,
      "its length is not constant",
    );
  }
});

test("the segment never exceeds its peak length, leaves the line, or runs backwards", () => {
  for (const extent of [60, 400, 1500]) {
    let previous = retraceSpan(0, extent, PEAK);
    for (const u of PHASES) {
      const { tail, tip } = retraceSpan(u, extent, PEAK);
      assert.ok(
        tip - tail <= PEAK + 1e-9,
        `extent ${extent} at ${u}: too long`,
      );
      assert.ok(tip >= tail - 1e-9, "the tip is never behind the tail");
      assert.ok(tail >= -1e-9 && tip <= extent + 1e-9, "inside the line");
      assert.ok(tip >= previous.tip - 1e-9, "the tip never runs backwards");
      assert.ok(tail >= previous.tail - 1e-9, "the tail never runs backwards");
      previous = { tail, tip };
    }
  }
});

test("the tip and the tail move at different speeds: the segment grows, then shrinks as the tail runs on", () => {
  const starting = retraceSpan(0.02, 1500, PEAK);
  assert.ok(starting.tip > 0, "the tip is under way");
  assert.equal(starting.tail, 0, "while the tail has not left the start");
  const cruising = retraceSpan(0.3, 1500, PEAK);
  assert.ok(
    cruising.tip - cruising.tail > starting.tip - starting.tail,
    "the segment is longer later in the run",
  );
  const shrinking = [0.7, 0.8, 0.9].map((u) => retraceSpan(u, 1500, PEAK));
  assert.ok(
    shrinking.every(({ tip }) => tip === 1500),
    "the tip has arrived and stays at the end",
  );
  assert.ok(
    shrinking[2].tip - shrinking[2].tail < shrinking[0].tip - shrinking[0].tail,
    "and the segment is shorter at the end of the loop",
  );
  assert.ok(
    shrinking[2].tail > shrinking[0].tail,
    "the tail is still travelling once the tip has arrived",
  );
});

test("a segment fades as it grows from nothing and as it shrinks back to it", () => {
  assert.equal(retraceFade(0, PEAK), 0);
  assert.equal(retraceFade(PEAK, PEAK), 1);
  assert.equal(retraceFade(PEAK * 5, PEAK), 1, "never brighter than full");
  for (let length = 1; length <= PEAK; length += 1) {
    assert.ok(
      retraceFade(length, PEAK) >= retraceFade(length - 1, PEAK),
      `a longer segment is never fainter (${length})`,
    );
  }
  assert.ok(retraceFade(PEAK / 4, PEAK) < 1, "a short segment is faint");
});

/* The re-trace is the drawing head's own settled values (the owner's ruling, 2026-10-02) at the
   re-trace's peak length. */
const RETRACE_OPTIONS: HeadOptions = { ...OPTIONS, length: PEAK };
const CHAIN = [
  { start: 0, end: 300 },
  { start: 300, end: 700 },
];
const stroke = (segment: HeadSegment): Rgb => {
  const [r, g, b] = segment.stroke.match(/\d+/g)?.map(Number) ?? [];
  return [r, g, b];
};

test("a segment of no length paints nothing", () => {
  assert.deepEqual(retraceSegments(100, 100, CHAIN, RETRACE_OPTIONS), []);
  assert.deepEqual(retraceSegments(100, 100.001, CHAIN, RETRACE_OPTIONS), []);
});

test("the segment's leading edge is hard and its tail begins exactly at the tail", () => {
  for (const [tail, tip] of [
    [40, 150],
    [20, 160],
    [320, 460],
  ]) {
    const segments = butts(retraceSegments(tail, tip, CHAIN, RETRACE_OPTIONS));
    const globalStart = (segment: HeadSegment) =>
      CHAIN[segment.piece].start + segment.start;
    const globalEnd = (segment: HeadSegment) =>
      CHAIN[segment.piece].start + segment.end;
    const leading = segments.filter((segment) => segment.step === 0);
    assert.ok(
      Math.abs(Math.max(...leading.map(globalEnd)) - COVER - tip) < 1e-9,
      `the leading edge sits at the tip (${tip}) plus only the cap's reach`,
    );
    assert.ok(
      Math.abs(Math.min(...segments.map(globalStart)) - tail) < 1e-9,
      `nothing is painted behind the tail (${tail})`,
    );
  }
});

test("the gradient is stretched over whatever length the segment has, tail colour to tip colour", () => {
  for (const [tail, tip] of [
    [0, 140],
    [200, 230],
    [100, 112],
  ]) {
    const segments = butts(retraceSegments(tail, tip, CHAIN, RETRACE_OPTIONS));
    const first = segments.find((segment) => segment.step === 0);
    const last = segments.reduce((a, b) => (b.step > a.step ? b : a));
    assert.ok(first && last);
    assert.ok(
      deltaE(stroke(first), RETRACE_OPTIONS.tipColor) < 3,
      `${tip - tail}px long: the tip end is the tip colour`,
    );
    assert.ok(
      deltaE(stroke(last), RETRACE_OPTIONS.tailColor) < 3,
      `${tip - tail}px long: the tail end is the thread's own ink colour`,
    );
  }
});

test("the segment is widest at its tip and narrows to the line's own width at its tail", () => {
  const segments = butts(retraceSegments(40, 150, CHAIN, RETRACE_OPTIONS));
  const byStep = [...segments].sort((a, b) => a.step - b.step);
  assert.equal(
    byStep[0].width < RETRACE_OPTIONS.tipWidth,
    true,
    "within the tip's width",
  );
  assert.ok(
    byStep[0].width > RETRACE_OPTIONS.tipWidth - 0.2,
    "the tip step is about the head's tip width",
  );
  const last = byStep[byStep.length - 1];
  assert.ok(
    last.width - BASE_WIDTH < 0.2,
    "the tail step is about the line's own width",
  );
  for (let i = 1; i < byStep.length; i += 1) {
    assert.ok(
      byStep[i].width <= byStep[i - 1].width + 1e-9,
      "narrowing toward the tail",
    );
  }
});

test("a segment crosses a piece boundary whole", () => {
  const segments = retraceSegments(250, 360, CHAIN, RETRACE_OPTIONS);
  assert.ok(segments.some((segment) => segment.piece === 0));
  assert.ok(segments.some((segment) => segment.piece === 1));
  for (const segment of segments) {
    const piece = CHAIN[segment.piece];
    assert.ok(
      segment.start >= -1e-9 && segment.end <= piece.end - piece.start + 1e-9,
    );
  }
});

test("a segment whose tip is on a piece's end is covered by the round cap there, as the head is", () => {
  const segments = retraceSegments(180, 300, CHAIN, RETRACE_OPTIONS);
  assert.equal(segments.filter((segment) => segment.cap === "round").length, 1);
  const none = retraceSegments(180, 299, CHAIN, RETRACE_OPTIONS);
  assert.equal(
    none.filter((segment) => segment.cap === "round").length,
    0,
    "a tip a stroke's width from the end needs none",
  );
});

test("the built page reads the re-trace's loop cadence, settle interval and loop budget from the stylesheet", (t) => {
  assert.match(tokenValue("retrace-duration"), /^[\d.]+m?s$/);
  assert.match(tokenValue("retrace-settle"), /^[\d.]+m?s$/);
  assert.equal(
    parseCssCount(tokenValue("retrace-loops")),
    4,
    "--retrace-loops is the owner's pick, 4 on the LONGEST stretch (2026-10-05), superseding the 5 of 2026-10-02 for that stretch alone -- every shorter one now runs more than five",
  );
  if (!existsSync("out/_next/static/chunks")) {
    t.skip("no static export: run `npm run build` first");
    return;
  }
  const css = builtChunks(".css");
  const script = builtChunks(".js");
  for (const token of [
    "--retrace-duration",
    "--retrace-settle",
    "--retrace-loops",
  ]) {
    assert.ok(css.includes(token), `${token} is not in the built CSS`);
    assert.ok(
      script.includes(`"${token}"`),
      `${token} is not read by name in the built script`,
    );
  }
});

test("the tip's group is the last one the drawn length has entered", () => {
  const ranges = [{ start: 0 }, { start: 100 }, { start: 250 }];
  assert.equal(tipGroupIndex(ranges, 0), undefined, "nothing drawn, no tip");
  assert.equal(tipGroupIndex(ranges, 1), 0);
  assert.equal(
    tipGroupIndex(ranges, 100),
    0,
    "at a boundary it is still the earlier group",
  );
  assert.equal(tipGroupIndex(ranges, 101), 1);
  assert.equal(tipGroupIndex(ranges, 9999), 2);
});

test("a CSS time is read in milliseconds, and anything else is refused rather than defaulted", () => {
  assert.equal(parseCssTime("2s"), 2000);
  assert.equal(parseCssTime(" 800ms "), 800);
  assert.equal(parseCssTime("0.5s"), 500);
  for (const bad of ["", "fast", "2", "-1s", "0s", "2 s", "NaNs"]) {
    assert.equal(parseCssTime(bad), undefined, `"${bad}"`);
  }
});

test("a CSS count is a whole number of loops, and anything else is refused rather than defaulted", () => {
  assert.equal(parseCssCount("3"), 3);
  assert.equal(parseCssCount(" 12 "), 12);
  for (const bad of ["", "0", "-1", "2.5", "3s", "many", "1e2"]) {
    assert.equal(parseCssCount(bad), undefined, `"${bad}"`);
  }
});

test("the budget is counted in whole loops: the loop is empty at its edges, and only the Nth loop's end spends it", () => {
  const duration = 3200;
  for (const loops of [1, 3, 7]) {
    const within = retraceLoopAt(duration * loops - 1, duration, loops);
    assert.equal(within.spent, false, `${loops} loops: not spent a ms early`);
    assert.ok(within.loop > 0.99, "and it is at the end of the last loop");
    assert.equal(
      retraceLoopAt(duration * loops, duration, loops).spent,
      true,
      `${loops} loops: spent at the end of the last`,
    );
    assert.equal(
      retraceLoopAt(duration * (loops + 5), duration, loops).spent,
      true,
    );
  }
  assert.equal(retraceLoopAt(0, duration, 3).loop, 0);
  assert.equal(retraceLoopAt(duration * 1.5, duration, 3).loop, 0.5);
  assert.equal(
    retraceLoopAt(duration * 2.25, duration, 3).loop,
    0.25,
    "the loop wraps and the budget does not",
  );
  assert.equal(
    retraceLoopAt(-50, duration, 3).loop,
    0,
    "a clock before zero is zero",
  );
});

test("the budget is a count: a slower loop does not keep the page busy for longer in loops", () => {
  for (const duration of [2000, 3200, 8000]) {
    assert.equal(retraceLoopAt(duration * 3 - 1, duration, 3).spent, false);
    assert.equal(retraceLoopAt(duration * 3, duration, 3).spent, true);
  }
});

test("the re-trace has no filter of its own, its glow being strokes, and no look tokens of its own", (t) => {
  assert.doesNotMatch(
    tokens,
    /--retrace-(tip|mid|width|halo)\s*:/,
    "a second copy of a head value",
  );
  if (!existsSync("out/_next/static/chunks")) {
    t.skip("no static export: run `npm run build` first");
    return;
  }
  const css = builtChunks(".css").replace(/\s+/g, "");
  const rules = css.match(/\.[^{}]*pageRetrace[^{}]*\{[^}]*\}/g) ?? [];
  assert.ok(
    rules.some((rule) => rule.includes("pageRetracepath")) &&
      rules.some((rule) => rule.includes("pageRetraceGlowpath")),
    "the re-trace's and its glow's paths are styled",
  );
  for (const rule of rules) {
    assert.doesNotMatch(rule, /filter/, `a filter on the re-trace: ${rule}`);
  }
});

/* ---------------------------------------------------------------------------------------------
   THE GLOW AS STROKES. The 4x halo, measured on a straight 3.2px line over the ivory ground: the
   share of vermilion at each distance from the line's centre. The stack of translucent strokes is
   fitted to it. */

const MEASURED_HALO: readonly (readonly [number, number])[] = [
  [3, 0.213],
  [4, 0.178],
  [6, 0.13],
  [8, 0.083],
  [10, 0.059],
  [15, 0.047],
  [20, 0.036],
  [25, 0.024],
  [30, 0.018],
  [40, 0.012],
];
const compositeAlphaAt = (distance: number) =>
  1 -
  RETRACE_GLOW.filter((stroke) => stroke.width / 2 >= distance).reduce(
    (left, stroke) => left * (1 - stroke.alpha),
    1,
  );

test("the glow strokes are painted widest first and the composite never weakens outward", () => {
  for (let i = 1; i < RETRACE_GLOW.length; i += 1) {
    assert.ok(RETRACE_GLOW[i].width < RETRACE_GLOW[i - 1].width);
  }
  for (let distance = 2; distance < 60; distance += 1) {
    assert.ok(
      compositeAlphaAt(distance) <= compositeAlphaAt(distance - 1) + 1e-9,
    );
  }
});

test("the stack of strokes reproduces the 4x halo's measured falloff, at its scale, to within 0.03", () => {
  for (const [distance, measured] of MEASURED_HALO) {
    const alpha = measured * RETRACE_GLOW_SCALE;
    const modelled = compositeAlphaAt(distance);
    assert.ok(
      Math.abs(modelled - alpha) < 0.03,
      `at ${distance}px the stack gives ${modelled.toFixed(3)}, the filter ${alpha}`,
    );
  }
});

test("a segment's glow is one stroke per level over each piece it covers, widest painted first", () => {
  const glow = retraceGlow(250, 360, CHAIN, RETRACE_OPTIONS.midColor);
  assert.equal(
    glow.length,
    2 * RETRACE_GLOW.length,
    "two pieces, N strokes each",
  );
  for (const index of [0, 1]) {
    const own = glow.filter((segment) => segment.piece === index);
    assert.deepEqual(
      own.map((segment) => segment.width),
      RETRACE_GLOW.map((stroke) => stroke.width),
    );
    for (let i = 1; i < own.length; i += 1) {
      assert.ok(
        own[i].rank > own[i - 1].rank,
        "a narrower stroke lies over a wider one",
      );
    }
  }
});

test("the glow covers exactly the segment, tail to tip, and each stroke is one polyline per piece", () => {
  const glow = retraceGlow(40, 150, CHAIN, RETRACE_OPTIONS.midColor);
  assert.equal(glow.length, RETRACE_GLOW.length, "one piece, N strokes");
  for (const segment of glow) {
    assert.equal(segment.start, 40);
    assert.equal(segment.end, 150);
    assert.equal(segment.cap, "round");
  }
});

test("a glow stroke carries its alpha in its colour and the vermilion stop's channels", () => {
  const [wide] = retraceGlow(40, 150, CHAIN, RETRACE_OPTIONS.midColor);
  const [r, g, b] = RETRACE_OPTIONS.midColor;
  assert.equal(wide.stroke, `rgba(${r},${g},${b},${RETRACE_GLOW[0].alpha})`);
});

test("an empty segment has no glow", () => {
  assert.deepEqual(retraceGlow(100, 100, CHAIN, RETRACE_OPTIONS.midColor), []);
});

test("the glow has enough strokes that no rim steps the composite by more than 0.05", () => {
  /* Three strokes fitted to the same curve pass the falloff test above and were seen to band at 3x:
     their rims step the share by 0.08 and more. The shipped eight step by at most 0.041 (the 6px
     and 13px strokes' rims), under 0.05, which is the bound. This bounds the step directly, and the
     count with it. */
  assert.ok(
    RETRACE_GLOW.length >= 8,
    "fewer strokes than the eight that were seen not to band",
  );
  for (const stroke of RETRACE_GLOW) {
    const rim = stroke.width / 2;
    const step = compositeAlphaAt(rim - 0.01) - compositeAlphaAt(rim + 0.01);
    assert.ok(
      step <= 0.05,
      `the ${stroke.width}px stroke's rim steps the share by ${step.toFixed(3)}`,
    );
  }
});

test("the glow's scale constant is what scales the shipped alphas", () => {
  assert.ok(
    Math.abs(
      RETRACE_GLOW[RETRACE_GLOW.length - 1].alpha - 0.061 * RETRACE_GLOW_SCALE,
    ) < 1e-4,
  );
  assert.ok(Math.abs(RETRACE_GLOW[0].alpha - 0.01 * RETRACE_GLOW_SCALE) < 1e-4);
});

/* The owner's two rules for the re-trace's pace (2026-10-05): one speed for every stretch, and a
   budget that never cuts a stretch off part-way round a loop. */
test("every stretch fits whole loops into the shared budget, at one speed", () => {
  /* The shipped `wide` layout's own stretch lengths, longest first in the budget's eyes. */
  const extents = [1487, 4173, 1873, 3772, 588, 406, 1690, 2362];
  const speed = 845;
  const loops = 4;
  const longest = Math.max(...extents);
  const budget = loops * retraceNominalMs(longest, speed);

  for (const extent of extents) {
    const period = retracePeriodMs(budget, retraceNominalMs(extent, speed));
    const count = budget / period;
    assert.ok(
      Math.abs(count - Math.round(count)) < 1e-9,
      `a ${extent}px stretch runs ${count} loops in the budget, not a whole number`,
    );
    assert.ok(
      count >= 1,
      `a ${extent}px stretch must run at least one whole loop`,
    );
    /* Speed is what the rounding trades away, and it has to stay small or the decoupling is
       pointless -- the spread it replaces is 10.3x. */
    const actual = extent / (period / 1000);
    const wanted = extent / (retraceNominalMs(extent, speed) / 1000);
    assert.ok(
      Math.abs(actual / wanted - 1) <= 0.1,
      `a ${extent}px stretch runs ${((actual / wanted - 1) * 100).toFixed(1)}% off the set speed`,
    );
  }

  /* The longest stretch is the budget's own unit, so it is exact rather than rounded. */
  const longestPeriod = retracePeriodMs(
    budget,
    retraceNominalMs(longest, speed),
  );
  assert.equal(Math.round(budget / longestPeriod), loops);
});

test("a short stretch fits as many whole loops into the budget as its nominal period allows", () => {
  const budget = 4 * retraceNominalMs(4173, 845);
  const nominal = retraceNominalMs(100, 845);
  assert.equal(
    retracePeriodMs(budget, nominal),
    budget / Math.round(budget / nominal),
  );
});

/* The floor of one keeps a stretch longer than twice the budget from rounding to zero loops, which
   would make the period infinite. */
test("a stretch longer than twice the budget runs exactly one loop of the budget", () => {
  const budget = 4 * retraceNominalMs(4173, 845);
  const period = retracePeriodMs(budget, retraceNominalMs(1e9, 845));
  assert.ok(Number.isFinite(period), "the period is finite");
  assert.equal(period, budget);
});
