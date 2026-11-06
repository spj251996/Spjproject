import assert from "node:assert/strict";
import { test } from "node:test";
import {
  centreline,
  neighboursOf,
  pruneSpurs,
  thin,
  walkThrough,
} from "./trace-motif.mjs";

test("a rectangle's centreline is its long axis", async () => {
  // A 200x20 filled rectangle is a straight stroke 20 wide; its skeleton is the horizontal midline.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 60"><path fill="#000" d="M 20 20 H 220 V 40 H 20 Z"/></svg>`;
  const { points } = await centreline(svg, { width: 240 });
  const ys = points.map((p) => p.y);
  const spread = Math.max(...ys) - Math.min(...ys);
  assert.ok(
    spread < 2,
    `centreline wanders ${spread.toFixed(2)}px off the midline`,
  );
  assert.ok(points.length > 20, "too few points to fit a curve");
});

/* The junction rule is the whole reason a self-crossing motif comes out as one rope: at a crossing
   the walk must carry on rather than turn into the other stroke. Falsified by swapping
   `chooseContinuation` for a nearest-branch rule: this X measures a 0.0deg turn under the shipped
   best-continuation rule and 90.0deg under the nearest-branch one, which fails the assertion. */
test("the walk passes straight through a crossing rather than turning", async () => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240"><path fill="none" stroke="#000" stroke-width="14" d="M 20 20 L 220 220 M 220 20 L 20 220"/></svg>`;
  const { points } = await centreline(svg, { width: 240 });

  const crossing = points.reduce(
    (best, p, i) => {
      const distance = Math.hypot(p.x - 120, p.y - 120);
      return distance < best.distance ? { index: i, distance } : best;
    },
    { index: -1, distance: Infinity },
  );
  assert.ok(crossing.distance < 6, "the walk never reached the crossing");
  assert.ok(
    crossing.index > 30 && crossing.index < points.length - 30,
    `the walk stopped at the crossing instead of passing through it (${crossing.index} of ${points.length})`,
  );

  /** @param {number} a @param {number} b */
  const heading = (a, b) =>
    Math.atan2(points[b].y - points[a].y, points[b].x - points[a].x);
  const before = heading(crossing.index - 30, crossing.index - 10);
  const after = heading(crossing.index + 10, crossing.index + 30);
  const turn =
    Math.abs(((before - after + Math.PI) % (2 * Math.PI)) - Math.PI) *
    (180 / Math.PI);
  assert.ok(
    turn < 30,
    `the walk turned ${turn.toFixed(1)} degrees at the crossing`,
  );
});

/* Without the 8-connectivity rule in `neighboursOf` every staircase pixel of a 1px diagonal counts
   three or four neighbours purely from the staircase and reads as a junction — `heart` measured 393
   of them against its true 2, which fragmented the skeleton, made spur pruning match nothing and cut
   the walk's coverage from 65.4% to 51.8%. Nothing else in this file fails when that rule is
   removed, so this is its only guard. */
/** @param {number} width @param {number} height @param {number[][]} pixels */
const fieldOf = (width, height, pixels) => {
  const ink = new Uint8Array(width * height);
  for (const [x, y] of pixels) ink[y * width + x] = 1;
  return { ink, width, height };
};

/** @param {{ ink: Uint8Array, width: number, height: number }} field */
const degrees = (field) => {
  const histogram = new Map();
  for (let at = 0; at < field.ink.length; at += 1) {
    if (field.ink[at] !== 1) continue;
    const degree = neighboursOf(field, at).length;
    histogram.set(degree, (histogram.get(degree) ?? 0) + 1);
  }
  return histogram;
};

test("a 1px diagonal is a path of degree-2 pixels, not a row of junctions", () => {
  /* A unit staircase, which is what Zhang-Suen leaves on any near-diagonal stroke: each pixel sits
     both orthogonally and diagonally next to its neighbours' neighbours. */
  const stair = [];
  for (let step = 0; step < 12; step += 1)
    stair.push([step, step], [step + 1, step]);
  const staircase = degrees(fieldOf(20, 20, stair));
  assert.equal(
    staircase.get(1),
    2,
    "a staircase should have exactly two loose ends",
  );
  assert.equal(
    [...staircase.keys()].filter((degree) => degree > 2).length,
    0,
    `a staircase should hold no junction, measured degrees ${JSON.stringify([...staircase])}`,
  );

  /* The other direction: a true 45-degree diagonal shares no orthogonal neighbour, so its diagonal
     links are the only connection there is and must survive. A rule that dropped them would leave
     every pixel isolated at degree 0. */
  const diagonal = degrees(
    fieldOf(
      20,
      20,
      Array.from({ length: 12 }, (_, i) => [i + 2, i + 2]),
    ),
  );
  assert.equal(
    diagonal.get(1),
    2,
    "a 45-degree diagonal should stay one connected path",
  );
  assert.equal(
    diagonal.get(2),
    10,
    "a 45-degree diagonal should be degree-2 throughout",
  );
});

/* A lobe hanging off a crossing is the shape of every motif here: `heart` is one long line with the
   heart itself on a single self-crossing, and the best-continuation rule correctly runs straight on
   past it, which left the heart undrawn at 65.4% coverage. Two things draw the lobe and neither is
   guarded anywhere else: merging the two halves of a thinned crossing, without which every crossing
   is odd and no route can cover the drawing (mutated to 0 stroke widths, coverage falls to 0.503),
   and splicing the leftover circuit back in (mutated away, 0.497). It must also draw the lobe
   WITHOUT lifting the pen, which is what the jump bound below holds. */
test("a lobe hanging off a crossing is drawn, and drawn without lifting the pen", async () => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200"><path fill="none" stroke="#000" stroke-width="8" d="M 20 170 C 90 170, 120 170, 150 150 C 190 110, 190 40, 150 40 C 110 40, 110 110, 150 150 C 180 170, 230 170, 300 170"/></svg>`;
  const { points, coverage } = await centreline(svg, { width: 320 });

  assert.ok(
    coverage.fraction > 0.95,
    `the lobe was left undrawn: coverage ${coverage.fraction.toFixed(3)}`,
  );
  assert.ok(
    points.some((p) => p.y < 70),
    "the walk never climbed into the lobe",
  );

  /* One continuous stroke: consecutive points are pixel neighbours, bar the width of a junction
     cluster the walk steps across. A spliced detour that did not close would show here as a jump
     the length of the lobe. */
  const jump = points.reduce(
    (worst, p, i) =>
      i === 0
        ? worst
        : Math.max(
            worst,
            Math.hypot(p.x - points[i - 1].x, p.y - points[i - 1].y),
          ),
    0,
  );
  assert.ok(jump < 6, `the walk jumped ${jump.toFixed(1)}px, lifting the pen`);
});

/* A skeleton with more than two loose ends is traced only in part and `fitPath`'s aspect is the
   fragment's. Coverage is the one figure that tells a fragment from the whole drawing without a
   render. */
test("coverage reports how much of the skeleton the walk reached", async () => {
  const rectangle = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 60"><path fill="#000" d="M 20 20 H 220 V 40 H 20 Z"/></svg>`;
  const straight = await centreline(rectangle, { width: 240 });
  assert.equal(
    straight.coverage.walked,
    straight.coverage.skeleton,
    "a single open stroke should be walked end to end",
  );
  assert.equal(straight.coverage.closedLoop, 0);

  /* An X has four loose ends; one open path can hold two of its four arms. */
  const cross = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240"><path fill="none" stroke="#000" stroke-width="14" d="M 20 20 L 220 220 M 220 20 L 20 220"/></svg>`;
  const crossing = await centreline(cross, { width: 240 });
  assert.ok(
    crossing.coverage.fraction < 0.75,
    `a four-armed skeleton cannot be one open path, yet coverage read ${crossing.coverage.fraction.toFixed(3)}`,
  );
  assert.ok(crossing.coverage.walked < crossing.coverage.skeleton);
});

/* `walkThrough` is the walk for a long hand-drawn route rather than a motif: one stroke that may
   cross itself many times, with loops the owner draws as joins. A stroke is painted here as discs
   along a polyline, then thinned and pruned exactly as a drawing is. */
/** @param {number} width @param {number} height @param {{ x: number, y: number }[]} line @param {number} radius */
const strokeField = (width, height, line, radius) => {
  const ink = new Uint8Array(width * height);
  for (let i = 0; i < line.length - 1; i += 1) {
    const a = line[i];
    const b = line[i + 1];
    const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y));
    for (let s = 0; s <= steps; s += 1) {
      const cx = a.x + ((b.x - a.x) * s) / steps;
      const cy = a.y + ((b.y - a.y) * s) / steps;
      for (let y = Math.floor(cy - radius); y <= cy + radius; y += 1)
        for (let x = Math.floor(cx - radius); x <= cx + radius; x += 1)
          if (Math.hypot(x - cx, y - cy) <= radius) ink[y * width + x] = 1;
    }
  }
  return { ink, width, height };
};

/* The alpha curve (t^2 - 1, t^3 - t) crosses itself once, at t = -1 and t = 1, with two tails. */
/** @param {number} sx @param {number} sy @param {number} ox @param {number} oy @param {number} [reach] */
const alpha = (sx, sy, ox, oy, reach = 1.7) => {
  const line = [];
  for (let t = -reach; t <= reach; t += 0.002)
    line.push({ x: ox + sx * (t * t - 1), y: oy + sy * (t * t * t - t) });
  return line;
};

/** @param {{ ink: Uint8Array, width: number }} skeleton @param {{ x: number, y: number }[]} points */
const unreached = (skeleton, points) => {
  let missed = 0;
  for (let at = 0; at < skeleton.ink.length; at += 1) {
    if (!skeleton.ink[at]) continue;
    const x = at % skeleton.width;
    const y = Math.floor(at / skeleton.width);
    if (!points.some((p) => Math.hypot(p.x - x, p.y - y) <= 3)) missed += 1;
  }
  return missed;
};

/** @param {{ x: number, y: number }[]} points @param {number} index @param {number} reach */
const turnAt = (points, index, reach) => {
  const before = points[Math.max(0, index - reach)];
  const at = points[index];
  const after = points[Math.min(points.length - 1, index + reach)];
  const a = Math.atan2(at.y - before.y, at.x - before.x);
  const b = Math.atan2(after.y - at.y, after.x - at.x);
  return (
    Math.abs(((b - a + 3 * Math.PI) % (2 * Math.PI)) - Math.PI) *
    (180 / Math.PI)
  );
};

test("walkThrough walks a self-crossing stroke end to end, through its crossing", () => {
  const line = alpha(70, 45, 90, 200);
  const skeleton = pruneSpurs(thin(strokeField(300, 400, line, 5)));
  const points = walkThrough(skeleton);
  assert.equal(
    unreached(skeleton, points),
    0,
    "part of the stroke was never walked",
  );
  const first = points[0];
  const last = points[points.length - 1];
  const tails = [line[0], line[line.length - 1]];
  for (const end of [first, last])
    assert.ok(
      tails.some((t) => Math.hypot(t.x - end.x, t.y - end.y) < 12),
      `the walk ends at ${end.x},${end.y}, not at a tail`,
    );
});

test("walkThrough goes straight through a shallow crossing that thins to two T-nodes", () => {
  /* Stretched tall, the alpha curve crosses itself at about 15 degrees; at this stroke width the
     two strands overlap for ~88px, which thins into two odd nodes further apart than one crossing's
     radius, joined by a stub both strands share. */
  const line = alpha(40, 300, 60, 250, 1.25);
  const skeleton = pruneSpurs(thin(strokeField(140, 500, line, 7)));
  const points = walkThrough(skeleton);
  assert.equal(
    unreached(skeleton, points),
    0,
    "part of the stroke was never walked",
  );
  const crossing = { x: 60, y: 250 };
  const visits = points
    .map((p, i) => ({ i, d: Math.hypot(p.x - crossing.x, p.y - crossing.y) }))
    .filter((v) => v.d < 4);
  assert.ok(visits.length > 0, "the walk never reached the crossing");
  for (const v of visits)
    assert.ok(
      turnAt(points, v.i, 20) < 35,
      `the walk turns ${turnAt(points, v.i, 20).toFixed(0)}deg at the crossing`,
    );
});

test("walkThrough keeps a small loop drawn as a join", () => {
  /* A vertical stroke with a 14px-radius loop (88px around) tied into it: the loop's skeleton is a short branch
     returning to its own crossing, the shape a stub filter mistakes for noise. */
  const line = [];
  for (let y = 10; y <= 100; y += 1) line.push({ x: 60, y });
  for (let a = 0; a <= 2 * Math.PI; a += 0.05)
    line.push({
      x: 74 - 14 * Math.cos(a),
      y: 100 - 14 * Math.sin(a),
    });
  for (let y = 100; y <= 190; y += 1) line.push({ x: 60, y });
  const skeleton = pruneSpurs(thin(strokeField(120, 200, line, 2)));
  const points = walkThrough(skeleton);
  assert.equal(
    unreached(skeleton, points),
    0,
    "the loop was dropped from the walk",
  );
});

test("walkThrough never lifts the pen: consecutive points are neighbours", () => {
  /* Merging a shallow crossing's two T-nodes removes the stub between them from the graph; the walk
     must still run along it rather than jump the gap. */
  /** @type {[{ x: number, y: number }[], number, number, number][]} */
  const cases = [
    [alpha(70, 45, 90, 200), 300, 400, 5],
    [alpha(40, 300, 60, 250, 1.25), 140, 500, 7],
  ];
  for (const [line, w, h, r] of cases) {
    const points = walkThrough(pruneSpurs(thin(strokeField(w, h, line, r))));
    let step = 0;
    for (let i = 1; i < points.length; i += 1)
      step = Math.max(
        step,
        Math.hypot(
          points[i].x - points[i - 1].x,
          points[i].y - points[i - 1].y,
        ),
      );
    assert.ok(step <= 1.5, `the walk jumps ${step.toFixed(1)}px`);
  }
});

test("walkThrough treats a clump of touching junction pixels as one crossing", () => {
  /* A 1px skeleton drawn by hand: down the left, round a square loop to the right, back across the
     first stroke and out to the left edge. Two stray pixels at the crossing make five touching
     junction pixels with no run between them, as a thick crossing thins. Both free ends sit near
     the crossing, and must stay ends. */
  /** @type {number[][]} */
  const pixels = [];
  for (let y = 2; y <= 60; y += 1) pixels.push([30, y]);
  for (let x = 31; x <= 60; x += 1) pixels.push([x, 60]);
  for (let y = 59; y >= 30; y -= 1) pixels.push([60, y]);
  for (let x = 59; x >= 2; x -= 1) pixels.push([x, 30]);
  pixels.push([31, 31], [29, 29]);
  const skeleton = fieldOf(70, 70, pixels);
  const points = walkThrough(skeleton);
  assert.equal(
    unreached(skeleton, points),
    0,
    "part of the stroke was never walked",
  );
  const ends = [points[0], points[points.length - 1]];
  assert.ok(
    ends.some((p) => p.x === 30 && p.y === 2) &&
      ends.some((p) => p.x === 2 && p.y === 30),
    `the walk runs ${JSON.stringify(ends)}, not from one free end to the other`,
  );
});
