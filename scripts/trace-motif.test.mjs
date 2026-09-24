// scripts/trace-motif.test.mjs — a straight stroke's centreline is a straight line
import assert from "node:assert/strict";
import { test } from "node:test";
import { centreline, neighboursOf } from "./trace-motif.mjs";

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
const fieldOf = (width, height, pixels) => {
  const ink = new Uint8Array(width * height);
  for (const [x, y] of pixels) ink[y * width + x] = 1;
  return { ink, width, height };
};

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
