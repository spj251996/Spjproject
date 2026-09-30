import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
  polylineBetween,
  type Rgb,
  samplePath,
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

test("each step runs under the one in front of it, so abutting ends leave no hairline", () => {
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

test("a tip at a piece's end is covered by a round-capped overrun, not by a butt step past the path", () => {
  const pieces = [
    { start: 0, end: 300 },
    { start: 300, end: 700 },
  ];
  /* Piece 0 fully painted, piece 1 not begun: the ink's round cap sits at the end of piece 0 and a
     butt cannot extend past a path. */
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

test("a run that stays inside its piece is not extended", () => {
  const points = pointsOf(polylineBetween(straightSamples(10), 7, 10));
  assert.ok(Math.abs(points[points.length - 1][0] - 20) < 0.01);
});

/* The head's colours and widths are read from the built stylesheet at runtime, so there is no copy
   of a token value in the component to diverge from the token — the way a hand-edited JS constant
   once did. This pins that it stays so: every token by name, and no literal in its place. */
test("the component reads the head's values from the stylesheet rather than carrying copies", () => {
  const component = readFileSync("components/thread/page-thread.tsx", "utf8");
  for (const token of [
    "--stroke-thread",
    "--stroke-thread-head",
    "--color-thread-red",
    "--color-thread-vermilion",
    "--color-thread-core",
  ]) {
    assert.ok(component.includes(`"${token}"`), `${token} is not read by name`);
  }
  assert.doesNotMatch(component, /#[0-9a-fA-F]{6}\b/, "a raw hex colour");
  assert.doesNotMatch(component, /\b3\.2\b/, "a copy of the tip width");
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
