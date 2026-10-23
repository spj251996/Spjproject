import assert from "node:assert/strict";
import test from "node:test";
import { authoredCard } from "./thread-authored-layout.ts";
import { threadLine } from "./thread-line.ts";
import { THREAD_IDS } from "./thread-paths.ts";
import { polylineBetween, samplePath } from "./thread-samples.ts";

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

test("a piece whose length is not a whole pixel ends a run on its own end", () => {
  const samples = straightSamples(10.5);
  const toEnd = pointsOf(polylineBetween(samples, 0, 10.5));
  const last = toEnd[toEnd.length - 1][0];
  assert.ok(Math.abs(last - 20.5) < 0.01, `ends at x 20.5, not ${last}`);
  const past = pointsOf(polylineBetween(samples, 5, 12.5));
  const beyond = past[past.length - 1][0];
  assert.ok(
    Math.abs(beyond - 22.5) < 0.01,
    `the extension starts from the end: x 22.5, not ${beyond}`,
  );
});

test("a run that stays inside its piece is not extended", () => {
  const points = pointsOf(polylineBetween(straightSamples(10), 7, 10));
  assert.ok(Math.abs(points[points.length - 1][0] - 20) < 0.01);
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
