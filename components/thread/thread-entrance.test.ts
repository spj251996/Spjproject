import assert from "node:assert/strict";
import test from "node:test";
import {
  type Box,
  coreWidth,
  type EntranceInput,
  entranceScene,
  entranceStartAt,
  makeWiggle,
  type Point,
} from "./thread-entrance.ts";

/* The thread's start and the invite's eyebrow as probed on /thread (spec → Known facts), each route a straight
   piece 0 leaving the start along the thread's direction. */
function fixture(
  view: Box,
  start: Point,
  direction: Point,
  eyebrow: Box,
  drawSpeed: number,
): EntranceInput {
  const length = Math.hypot(direction.x, direction.y);
  const route: Point[] = [];
  for (let u = 0; u <= 300; u += 1)
    route.push({
      x: start.x + (direction.x / length) * u,
      y: start.y + (direction.y / length) * u,
    });
  return {
    route,
    eyebrow,
    view,
    drawSpeed,
    cordWidth: 2.2,
    frayLength: 7.9,
    seed: 7,
  };
}

const PHONE = fixture(
  { left: 0, top: 0, right: 393, bottom: 700 },
  { x: 316, y: 235 },
  { x: -0.4, y: 0.92 },
  { left: 134, top: 112, right: 259, bottom: 132 },
  0.36,
);
const TABLET = fixture(
  { left: 0, top: 0, right: 820, bottom: 1180 },
  { x: 510, y: 153 },
  { x: -0.33, y: 0.94 },
  { left: 341, top: 331, right: 479, bottom: 351 },
  0.8,
);
const DESKTOP = fixture(
  { left: 0, top: 0, right: 1536, bottom: 695 },
  { x: 1233, y: 163 },
  { x: 0.14, y: 0.99 },
  { left: 705, top: 108, right: 831, bottom: 128 },
  0.62,
);
const FIXTURES = { phone: PHONE, tablet: TABLET, desktop: DESKTOP };

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/* The arc length along `line` of the point on it nearest `point`, and how far `point` lies off it. */
function nearestArc(line: readonly Point[], point: Point) {
  let best = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  let arc = 0;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1];
    const b = line[i];
    const span = distance(a, b);
    const f =
      span === 0
        ? 0
        : Math.min(
            1,
            Math.max(
              0,
              ((point.x - a.x) * (b.x - a.x) + (point.y - a.y) * (b.y - a.y)) /
                span ** 2,
            ),
          );
    const d = distance(point, {
      x: a.x + (b.x - a.x) * f,
      y: a.y + (b.y - a.y) * f,
    });
    if (d < bestDistance) {
      bestDistance = d;
      best = arc + span * f;
    }
    arc += span;
  }
  return { arc: best, offset: bestDistance };
}

test("every fibre sets off beyond the top-left edges, within the owner's limits", () => {
  for (const [name, input] of Object.entries(FIXTURES)) {
    const scene = entranceScene(input);
    const { view } = input;
    const width = view.right - view.left;
    const height = view.bottom - view.top;
    const edges: string[] = [];
    for (let fibre = 0; fibre < 5; fibre++) {
      let first: Point | undefined;
      for (let t = 0; t <= scene.land && first === undefined; t += 5) {
        const points = scene.frame(t, Number.NEGATIVE_INFINITY).fibres[fibre];
        if (points && points.length > 0) first = points[0];
      }
      assert.ok(first, `${name}: fibre ${fibre} never appears`);
      const onTop =
        first.y <= view.top - 29 && first.x <= view.left + width / 3 + 1;
      const onLeft =
        first.x <= view.left - 29 && first.y <= view.top + (2 / 3) * height + 1;
      assert.ok(
        onTop || onLeft,
        `${name}: fibre ${fibre} sets off at ${first.x.toFixed(1)},${first.y.toFixed(1)}`,
      );
      if (fibre > 0) edges.push(onTop ? "top" : "left");
    }
    for (let i = 1; i < edges.length; i++)
      assert.notEqual(edges[i], edges[i - 1], `${name}: ${edges.join(" ")}`);
  }
});

test("fibres join the moving head 180ms apart", () => {
  for (const [name, input] of Object.entries(FIXTURES)) {
    const { joinTimes } = entranceScene(input);
    assert.equal(joinTimes.length, 4);
    for (let i = 1; i < 4; i++)
      assert.ok(
        Math.abs(joinTimes[i] - joinTimes[i - 1] - 180) <= 10,
        `${name}: joins ${joinTimes.map(Math.round).join(", ")}`,
      );
  }
  const small = entranceScene({
    ...fixture(
      { left: 0, top: 0, right: 320, bottom: 568 },
      { x: 258, y: 200 },
      { x: -0.4, y: 0.92 },
      { left: 108, top: 92, right: 212, bottom: 110 },
      0.3,
    ),
  });
  for (let i = 1; i < 4; i++)
    assert.ok(small.joinTimes[i] > small.joinTimes[i - 1]);
});

test("the bundle starts at three quarters of the draw's speed and passes the start at the draw's speed", () => {
  for (const [name, input] of Object.entries(FIXTURES)) {
    const scene = entranceScene(input);
    const speed = (t: number) =>
      (scene.headAt(t + 2) - scene.headAt(t - 2)) / 4;
    const passes = scene.release + 16;
    const atJoin = speed(scene.joinTimes[0]);
    assert.ok(
      Math.abs(atJoin / input.drawSpeed - 0.75) <= 0.03,
      `${name}: ${(atJoin / input.drawSpeed).toFixed(3)} at the first join`,
    );
    let last = 0;
    for (let t = scene.joinTimes[0]; t < passes - 4; t += 10) {
      const now = speed(t);
      assert.ok(now >= last - 1e-6, `${name}: slows at ${t}ms`);
      last = now;
    }
    assert.ok(
      Math.abs(speed(passes) / input.drawSpeed - 1) <= 0.02,
      `${name}: ${(speed(passes) / input.drawSpeed).toFixed(3)} at the start`,
    );
  }
});

test("the draw is released a frame before the head passes the start", () => {
  for (const input of Object.values(FIXTURES)) {
    const scene = entranceScene(input);
    assert.ok(Math.abs(scene.headAt(scene.release + 16) - scene.startArc) <= 1);
  }
});

test("the cord never covers the real ink", () => {
  for (const [name, input] of Object.entries(FIXTURES)) {
    const scene = entranceScene(input);
    const cut = input.frayLength;
    for (let t = scene.release; t <= scene.land; t += 10) {
      const drawn = Math.max(0, input.drawSpeed * (t - scene.release - 16));
      for (const span of scene.frame(t, drawn).cord)
        for (const point of span)
          for (
            let u = Math.ceil(cut + 1);
            u < drawn - 1 && u < input.route.length;
            u++
          )
            assert.ok(
              distance(point, input.route[u]) > 0.5,
              `${name}: the cord covers drawn ink at ${t}ms`,
            );
    }
  }
});

test("at rest nothing is left", () => {
  for (const [name, input] of Object.entries(FIXTURES)) {
    const scene = entranceScene(input);
    for (const [t, drawn] of [
      [scene.land, 500],
      [scene.land + 100, 600],
    ]) {
      const frame = scene.frame(t, drawn);
      assert.ok(
        frame.fibres.every((fibre) => fibre === null),
        name,
      );
      assert.equal(frame.cores.length, 0, name);
      assert.equal(frame.cord.length, 0, name);
      assert.ok(
        distance(frame.tail, input.route[Math.round(input.frayLength)]) <= 0.6,
        name,
      );
      assert.equal(frame.frayOpacity, 1, name);
    }
  }
});

test("the bundle thickens with each closed fibre", () => {
  assert.ok(Math.abs(coreWidth(2, 0.9, 2.2) - 1.225) < 1e-9);
  assert.ok(Math.abs(coreWidth(3, 0.9, 2.2) - 1.55) < 1e-9);
  assert.ok(Math.abs(coreWidth(4, 0.9, 2.2) - 1.875) < 1e-9);
  const widths = new Set([1.225, 1.55, 1.875].map((w) => w.toFixed(3)));
  const scene = entranceScene(PHONE);
  let seen = 0;
  for (let t = 0; t < scene.land; t += 20)
    for (const core of scene.frame(t, Number.NEGATIVE_INFINITY).cores) {
      assert.ok(widths.has(core.width.toFixed(3)), `width ${core.width}`);
      seen++;
    }
  assert.ok(seen > 0, "no core was ever drawn");
});

test("the joined bundle stays clear of the eyebrow", () => {
  for (const [name, input] of Object.entries(FIXTURES)) {
    const scene = entranceScene(input);
    const e = input.eyebrow as Box;
    for (let t = 0; t <= scene.land; t += 10) {
      const frame = scene.frame(t, Number.NEGATIVE_INFINITY);
      const points = [
        ...frame.cord.flat(),
        ...frame.cores.flatMap((core) => core.points),
      ];
      for (const p of points)
        assert.ok(
          !(
            p.x > e.left - 4 &&
            p.x < e.right + 4 &&
            p.y > e.top - 4 &&
            p.y < e.bottom + 4
          ),
          `${name}: ${p.x.toFixed(1)},${p.y.toFixed(1)} at ${t}ms is on the eyebrow`,
        );
      for (const p of frame.cord.flat())
        if (p.x >= e.left && p.x <= e.right && p.y < e.top)
          assert.ok(
            p.y <= e.top - 16 + 5,
            `${name}: the cord sits ${e.top - p.y}px above the eyebrow`,
          );
    }
  }
});

test("the wiggle wanders", () => {
  let state = 3;
  const random = () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
  const crossingSpread = (sample: (p: number) => number) => {
    const crossings: number[] = [];
    let previous = sample(0);
    for (let p = 2; p <= 4000; p += 2) {
      const value = sample(p);
      if (Math.sign(value) !== Math.sign(previous) && value !== 0)
        crossings.push(p);
      previous = value;
    }
    const gaps = crossings.slice(1).map((p, i) => p - crossings[i]);
    const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const deviation = Math.sqrt(
      gaps.reduce((a, b) => a + (b - mean) ** 2, 0) / gaps.length,
    );
    return deviation / mean;
  };
  assert.ok(
    crossingSpread((p) => Math.sin(p / 17.5)) < 0.1,
    "the measure cannot see a sine",
  );
  const wiggle = makeWiggle(random);
  assert.ok(crossingSpread((p) => wiggle(p, 900)) > 0.25);
});

test("past the eyebrow the bundle calms", () => {
  const scene = entranceScene(DESKTOP);
  const e = DESKTOP.eyebrow as Box;
  const past = scene.line.findIndex((p) => p.x >= e.right && p.y >= 0);
  const pastArc = nearestArc(scene.line, scene.line[past]).arc;
  let checked = 0;
  for (let t = 0; t < scene.release; t += 20)
    for (const point of scene.frame(t, Number.NEGATIVE_INFINITY).cord.flat()) {
      const { arc, offset } = nearestArc(scene.line, point);
      if (arc < pastArc + 60 || arc > scene.startArc - 80) continue;
      assert.ok(offset <= 0.15 * 4 + 0.05, `${offset.toFixed(2)}px at ${t}ms`);
      checked++;
    }
  assert.ok(checked > 0, "no cord point past the eyebrow was checked");
});

test("a late start plays in full", () => {
  assert.equal(entranceStartAt(1800, 2600), 2600);
  assert.equal(entranceStartAt(1800, 1200), 1800);
});

test("one seed, one entrance", () => {
  assert.deepEqual(
    entranceScene(PHONE).frame(1000, Number.NEGATIVE_INFINITY),
    entranceScene(PHONE).frame(1000, Number.NEGATIVE_INFINITY),
  );
});
