import assert from "node:assert/strict";
import test from "node:test";
import { adaptCelebrations, layoutWithout } from "./adapt-photo-states.mjs";

/* One ritual row on a 400px-wide page: its text in the column 100–300, its photo strip 150px tall
   beneath the description, and the next ritual's heading below that. The thread runs down the left
   gutter at x 40, past all of it. */
const STRIP = 150;
const LAYOUT = {
  width: 400,
  strip: STRIP,
  sections: [
    { id: "celebrations", top: 0, bottom: 1000 },
    { id: "wishes", top: 1000, bottom: 1400 },
  ],
  rows: [
    {
      top: 100,
      descBottom: 300,
      stripBottom: 310 + STRIP,
      textLeft: 100,
      textRight: 300,
    },
    {
      top: 500,
      descBottom: 700,
      stripBottom: 710 + STRIP,
      textLeft: 100,
      textRight: 300,
    },
  ],
  glyphs: [
    { left: 100, right: 300, top: 100, bottom: 300, text: "first ritual" },
    { left: 100, right: 300, top: 500, bottom: 700, text: "second ritual" },
  ],
};

/** @param {number} x @param {number} y0 @param {number} y1 */
const vertical = (x, y0, y1) =>
  Array.from({ length: Math.round((y1 - y0) / 4) + 1 }, (_, k) => ({
    x,
    y: y0 + k * 4,
  }));

test("layoutWithout lifts everything below a removed strip by the strip's height", () => {
  const without = layoutWithout(LAYOUT, [0]);
  assert.deepEqual(
    without.glyphs.map((g) => g.top),
    [100, 500 - STRIP],
  );
  assert.equal(without.sections[0].bottom, 1000 - STRIP);
  assert.equal(without.sections[1].top, 1000 - STRIP);
});

test("with every strip kept, the line is only rounded, and its ends stay put", () => {
  const line = vertical(40, 0, 1000);
  const { points } = adaptCelebrations(line, LAYOUT, []);
  assert.deepEqual(points[0], line[0]);
  assert.deepEqual(points[points.length - 1], line[line.length - 1]);
  for (const p of points) assert.ok(Math.abs(p.x - 40) < 0.5);
});

test("a removed strip takes its height out of the line below it, and the line clears type", () => {
  const line = vertical(40, 0, 1000);
  const { points, report } = adaptCelebrations(line, LAYOUT, [0]);
  assert.deepEqual(points[0], line[0], "the top end moved");
  assert.ok(
    Math.abs(points[points.length - 1].y - (1000 - STRIP)) < 0.5,
    `the bottom end sits at ${points[points.length - 1].y}`,
  );
  assert.equal(report.crossings, 0);
  for (let i = 1; i < points.length; i += 1)
    assert.ok(
      points[i].y >= points[i - 1].y - 0.01,
      "the line folds back on itself",
    );
});

test("a loop in the line is carried whole, keeping its drawn shape", () => {
  /* A loop of radius 20 tied into the gutter line inside the first ritual's emptied gap, where a
     point's rise follows its height and would squash a loop that was not carried whole. */
  const loop = Array.from({ length: 64 }, (_, k) => {
    const a = (2 * Math.PI * k) / 63;
    return { x: 60 - 20 * Math.cos(a), y: 400 - 20 * Math.sin(a) };
  });
  const line = [...vertical(40, 0, 400), ...loop, ...vertical(40, 404, 1000)];
  const { points } = adaptCelebrations(line, LAYOUT, [0]);
  /** Distance from p to the adapted line. @param {{ x: number, y: number }} p */
  const offLine = (p) => {
    let best = Infinity;
    for (let k = 1; k < points.length; k += 1) {
      const a = points[k - 1];
      const b = points[k];
      const len2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2 || 1;
      const t = Math.max(
        0,
        Math.min(
          1,
          ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / len2,
        ),
      );
      best = Math.min(
        best,
        Math.hypot(p.x - a.x - t * (b.x - a.x), p.y - a.y - t * (b.y - a.y)),
      );
    }
    return best;
  };
  /* Wherever it is carried to, it arrives unbent: some single rise lays it on the line. */
  let worst = Infinity;
  for (let rise = 0; rise <= STRIP; rise += 0.5)
    worst = Math.min(
      worst,
      Math.max(...loop.map((p) => offLine({ x: p.x, y: p.y - rise }))),
    );
  assert.ok(
    worst < 2,
    `the loop's shape is off by up to ${worst.toFixed(2)}px`,
  );
});

test("layoutWithout drops a removed strip's own text", () => {
  const withLink = {
    ...LAYOUT,
    glyphs: [
      ...LAYOUT.glyphs,
      { left: 250, right: 300, top: 440, bottom: 455, text: "View photos" },
    ],
  };
  const without = layoutWithout(withLink, [0]);
  assert.ok(!without.glyphs.some((g) => g.text === "View photos"));
});

test("a run across an emptied gap stays level: its rise follows its height, not its length", () => {
  /* Down the left gutter, sideways across it at y 400 inside the first ritual's emptied gap, and
     down again: easing the rise along the line's length would tip the sideways run. */
  const across = Array.from({ length: 21 }, (_, k) => ({
    x: 10 + k * 4,
    y: 400,
  }));
  const line = [...vertical(10, 0, 396), ...across, ...vertical(90, 404, 1000)];
  const { points } = adaptCelebrations(line, LAYOUT, [0], {
    shiftSigma: 1,
    roundSigma: 0,
  });
  const ys = points.filter((p) => p.x > 20 && p.x < 80).map((p) => p.y);
  assert.ok(ys.length > 0);
  const tip = Math.max(...ys) - Math.min(...ys);
  assert.ok(tip < 1, `the run tips by ${tip.toFixed(1)}px`);
});

test("the adapted line keeps the floor off type", () => {
  /* The line runs 5px left of the second ritual's text, under the 8px floor. */
  const line = [
    ...vertical(40, 0, 480),
    ...vertical(95, 484, 720),
    ...vertical(40, 724, 1000),
  ];
  const { report } = adaptCelebrations(line, LAYOUT, [0]);
  assert.ok(report.min > 7.5, `nearest type ${report.min.toFixed(1)}px`);
});
