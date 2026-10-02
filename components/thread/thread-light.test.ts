import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import { authoredCard } from "./thread-authored-layout.ts";
import {
  deltaE,
  HEAD_LENGTH_RATIO,
  HEAD_TIP_MARGIN,
  type HeadOptions,
  type HeadSegment,
  headSegments,
  headStepCount,
  parseCssTime,
  polylineBetween,
  RETRACE_GLOW,
  RETRACE_GLOW_SCALE,
  RETRACE_LENGTH_RATIO,
  type Rgb,
  retraceFade,
  retraceGlow,
  retracePhase,
  retraceSegments,
  retraceSpan,
  retraceTargets,
  samplePath,
  TAPER_CUT_WIDTH,
  type TaperSegment,
  taperCut,
  taperReached,
  taperSegments,
  tipGroupIndex,
} from "./thread-light.ts";
import { dashForPiece, threadLine } from "./thread-line.ts";
import { THREAD_IDS } from "./thread-paths.ts";

const tokens = readFileSync("app/styles/tokens.css", "utf8");

function tokenValue(name: string): string {
  const match = tokens.match(new RegExp(`--${name}:\\s*([^;]+);`));
  assert.ok(match, `--${name} not found in tokens.css`);
  return match[1].replace(/\s+/g, " ").trim();
}

function colourToken(name: string): Rgb {
  const hex = tokenValue(name);
  assert.match(hex, /^#[0-9a-f]{6}$/, `--${name} is not a six-digit hex`);
  return [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
  ];
}

function pxToken(name: string): number {
  const value = tokenValue(name);
  assert.match(value, /^[\d.]+px$/, `--${name} is not a px length`);
  return Number.parseFloat(value);
}

const BASE_WIDTH = pxToken("stroke-thread");
const OPTIONS: HeadOptions = {
  length: HEAD_LENGTH_RATIO * BASE_WIDTH,
  tipWidth: pxToken("stroke-thread-head"),
  baseWidth: BASE_WIDTH,
  tailColor: colourToken("color-thread-red"),
  midColor: colourToken("color-thread-vermilion"),
  tipColor: colourToken("color-thread-core"),
};
/* How far the tip step reaches past the ink's tip: half the ink's width, so its round cap is covered,
   plus the margin that keeps the two edges from sharing a pixel. */
const COVER = BASE_WIDTH / 2 + HEAD_TIP_MARGIN;

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

const butts = (segments: readonly HeadSegment[]) =>
  segments.filter((segment) => segment.cap === "butt");

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
  assert.ok(
    dots[0].width === OPTIONS.tipWidth || dots[0].width <= OPTIONS.tipWidth,
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

/* Any failure here is also a prompt to re-fit `FITTED_GLOW` (`thread-light.ts`): the re-trace's eight
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

/* A piece sampled once per pixel of arc, as the component takes it: a straight run along +x from
   (10, 5), 10px long, with the two trailing points the sampler adds clamped to the end. */
function straightSamples(length: number) {
  const count = Math.ceil(length) + 2;
  const xy = new Float32Array(count * 2);
  for (let i = 0; i < count; i += 1) {
    xy[2 * i] = 10 + Math.min(length, i);
    xy[2 * i + 1] = 5;
  }
  return { xy, length };
}

const pointsOf = (d: string) =>
  [...d.matchAll(/[ML]([-\d.]+) ([-\d.]+)/g)].map((m) => [
    Number(m[1]),
    Number(m[2]),
  ]);

test("a run is a polyline through only its own stretch of the piece", () => {
  const points = pointsOf(polylineBetween(straightSamples(10), 2.5, 6.25));
  assert.deepEqual(points[0], [12.5, 5]);
  assert.deepEqual(points[points.length - 1], [16.25, 5]);
  for (const [x] of points) assert.ok(x >= 12.5 && x <= 16.25);
  assert.ok(points.length <= 6, "a few pixels of arc, not the whole piece");
});

test("a run that ends past its piece's end carries on along the piece's own last direction", () => {
  const points = pointsOf(polylineBetween(straightSamples(10), 7, 11));
  const last = points[points.length - 1];
  assert.ok(Math.abs(last[0] - 21) < 0.01, `ends at x 21, not ${last[0]}`);
  assert.ok(Math.abs(last[1] - 5) < 0.01, "and stays on the line");
  const atEnd = points.find(([x]) => Math.abs(x - 20) < 0.01);
  assert.ok(atEnd, "it passes through the piece's own end first");
});

test("a run that begins before its piece's start carries on backwards along the piece's own first direction", () => {
  const points = pointsOf(polylineBetween(straightSamples(10), -4, 3));
  const first = points[0];
  assert.ok(Math.abs(first[0] - 6) < 0.01, `begins at x 6, not ${first[0]}`);
  assert.ok(Math.abs(first[1] - 5) < 0.01, "and stays on the line");
  assert.ok(
    points.some(([x]) => Math.abs(x - 10) < 0.01),
    "it passes through the piece's own start",
  );
  assert.ok(Math.abs(points[points.length - 1][0] - 13) < 0.01);
  assert.ok(
    points.every(([x]) => Number.isFinite(x)),
    "no NaN from reading before the array",
  );
});

test("a run that stays inside its piece is not extended", () => {
  const points = pointsOf(polylineBetween(straightSamples(10), 7, 10));
  assert.ok(Math.abs(points[points.length - 1][0] - 20) < 0.01);
});

/* The head's colours and widths are read from the built stylesheet at runtime, so the component
   carries no copy of a token value to diverge from the token — the way a hand-edited JS constant
   once did. This pins that against the BUILT artifact, not the source: the built CSS defines every
   token, and the built script reads them by name and carries no literal in their place. It needs an
   export (`npm run build`), and says so rather than passing without one. */
function builtChunks(extension: string): string {
  const dir = "out/_next/static/chunks";
  return readdirSync(dir)
    .filter((name) => name.endsWith(extension))
    .map((name) => readFileSync(`${dir}/${name}`, "utf8"))
    .join("\n");
}

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

/* ---------------------------------------------------------------------------------------------
   SAMPLING A PIECE FROM ITS OWN `d`. The browser's `getPointAtLength` walks the whole path on every
   call, so sampling a 100-segment motif once per pixel is quadratic: ~1s of main thread for the
   page, in stalls of 25-85ms as the head reaches each piece. The `d` is only ever `M` and `C`, so
   the samples are computed from it directly. */

const circle = (radius: number) => {
  /* A quarter circle as one cubic: the standard 0.5522847498 control offset, good to 2.7e-4 of the
     radius, which is an independent truth for where each arc length lies. */
  const k = 0.5522847498 * radius;
  return `M ${radius} 0 C ${radius} ${k} ${k} ${radius} 0 ${radius}`;
};

test("samples lie one pixel of ARC apart along the curve, not one parameter step apart", () => {
  const radius = 100;
  const length = (Math.PI / 2) * radius;
  const { xy } = samplePath(circle(radius), length);
  for (let i = 0; i <= Math.floor(length); i += 1) {
    const angle = i / radius;
    assert.ok(
      Math.abs(xy[2 * i] - radius * Math.cos(angle)) < 0.06 &&
        Math.abs(xy[2 * i + 1] - radius * Math.sin(angle)) < 0.06,
      `sample ${i} is off the true circle`,
    );
  }
});

test("a sampled piece starts at its M point, ends at its last point, and has the two trailing samples", () => {
  const radius = 100;
  const length = (Math.PI / 2) * radius;
  const { xy, length: sampledLength } = samplePath(circle(radius), length);
  assert.equal(sampledLength, length);
  assert.equal(xy.length / 2, Math.ceil(length) + 2);
  assert.deepEqual([xy[0], xy[1]], [radius, 0]);
  const last = xy.length / 2 - 1;
  assert.ok(
    Math.abs(xy[2 * last]) < 0.01 && Math.abs(xy[2 * last + 1] - radius) < 0.01,
  );
  assert.deepEqual(
    [xy[2 * last], xy[2 * last + 1]],
    [xy[2 * (last - 1)], xy[2 * (last - 1) + 1]],
    "the trailing points sit on the end",
  );
});

test("a piece of several cubics is one continuous run", () => {
  const { xy } = samplePath(
    "M 0 0 C 5 0 10 0 15 0 C 20 0 25 0 30 0 C 35 0 40 0 45 0",
    45,
  );
  for (let i = 0; i <= 45; i += 1) {
    assert.ok(
      Math.abs(xy[2 * i] - i) < 1e-3 && xy[2 * i + 1] === 0,
      `sample ${i}`,
    );
  }
});

test("a path command it does not understand is refused rather than sampled wrong", () => {
  assert.throws(() => samplePath("M 0 0 L 10 0", 10), /command/);
  assert.throws(() => samplePath("M 0 0 C 1 0 2 0 3 0 Z", 3), /command/);
});

test("every piece the thread emits samples, endpoint to endpoint, on the length its own model gives it", () => {
  for (const band of ["tall", "upright", "wide"] as const) {
    let top = 0;
    const sections = THREAD_IDS.map((id) => {
      const card = authoredCard(id, band);
      const section = {
        top,
        height: card.sectionHeight,
        cardLeft: card.cardLeft,
        cardWidth: card.cardWidth,
      };
      top += card.sectionHeight;
      return section;
    });
    const { d, pieces } = threadLine(band, sections);
    const subpaths = d.split(/(?=M )/).filter((part) => part.trim().length > 0);
    assert.equal(subpaths.length, pieces.length);
    subpaths.forEach((subpath, index) => {
      const length = pieces[index].end - pieces[index].start;
      const { xy } = samplePath(subpath, length);
      const numbers =
        subpath.match(/-?\d*\.?\d+(?:[eE][-+]?\d+)?/g)?.map(Number) ?? [];
      const last = xy.length / 2 - 1;
      assert.ok(
        Math.abs(xy[0] - numbers[0]) < 1e-3 &&
          Math.abs(xy[1] - numbers[1]) < 1e-3,
        `${band} piece ${index} start`,
      );
      assert.ok(
        Math.abs(xy[2 * last] - numbers[numbers.length - 2]) < 1e-3 &&
          Math.abs(xy[2 * last + 1] - numbers[numbers.length - 1]) < 1e-3,
        `${band} piece ${index} end`,
      );
    });
  }
});

/* A long, tightly curved cubic — the case a fixed number of chords per cubic got wrong by 0.26px on
   a real 50px-per-cubic connector. The truth is walked by the test itself at a far finer resolution. */
test("a long tightly curved cubic samples true to the arc, not just on the curve", () => {
  const d = "M 0 0 C 240 0 240 60 0 60";
  const dense: [number, number][] = [[0, 0]];
  const along = [0];
  for (let k = 1; k <= 20000; k += 1) {
    const t = k / 20000;
    const u = 1 - t;
    const x = 3 * u * t * t * 240 + 3 * u * u * t * 240;
    const y = 3 * u * t * t * 60 + t * t * t * 60;
    const [px, py] = dense[dense.length - 1];
    dense.push([x, y]);
    along.push(along[along.length - 1] + Math.hypot(x - px, y - py));
  }
  const total = along[along.length - 1];
  const { xy } = samplePath(d, total);
  for (let i = 0; i <= Math.floor(total); i += 7) {
    let at = 1;
    while (along[at] < i) at += 1;
    const blend = (i - along[at - 1]) / (along[at] - along[at - 1]);
    const tx = dense[at - 1][0] + (dense[at][0] - dense[at - 1][0]) * blend;
    const ty = dense[at - 1][1] + (dense[at][1] - dense[at - 1][1]) * blend;
    assert.ok(
      Math.hypot(xy[2 * i] - tx, xy[2 * i + 1] - ty) < 0.02,
      `arc ${i} is off the true curve by more than 0.02px`,
    );
  }
});

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

test("the last group holds the terminal, which has nothing further to cue, and never loops", () => {
  const bottom = { scrollY: 1400, height: 700 };
  assert.deepEqual(
    retraceTargets(
      "complete",
      RECTS,
      { scrollY: 2100, height: 700 },
      undefined,
    ),
    [],
    "at the final terminal nothing loops",
  );
  assert.deepEqual(
    retraceTargets(
      "complete",
      RECTS,
      { scrollY: 1750, height: 700 },
      undefined,
    ),
    [2],
    "the group before it still does",
  );
  assert.deepEqual(
    retraceTargets("drawing", RECTS, { scrollY: 2100, height: 700 }, 3),
    [],
    "nor does a tip that is still drawing it",
  );
  assert.deepEqual(retraceTargets("complete", RECTS, bottom, undefined), [2]);
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

test("the built page reads the re-trace's loop cadence and settle interval from the stylesheet", (t) => {
  assert.match(tokenValue("retrace-duration"), /^[\d.]+m?s$/);
  assert.match(tokenValue("retrace-settle"), /^[\d.]+m?s$/);
  if (!existsSync("out/_next/static/chunks")) {
    t.skip("no static export: run `npm run build` first");
    return;
  }
  const css = builtChunks(".css");
  const script = builtChunks(".js");
  for (const token of ["--retrace-duration", "--retrace-settle"]) {
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
