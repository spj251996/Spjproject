import assert from "node:assert/strict";
import test from "node:test";
import { layoutWithout } from "./adapt-photo-states.mjs";
import {
  applyMoves,
  applyPen,
  checkPen,
  chooseMarks,
  cornersOf,
  penMask,
  toDrawn,
  toState,
  zonesOf,
} from "./pen-marks.mjs";

/* Celebrations 1000–2000 on the drawn page, two rituals, strips 100 high. Ritual 0's strip sits
   between its description (bottom 1200) and ritual 1's title (top 1400); ritual 1's between 1500
   and the section's end. */
const LAYOUT = {
  width: 1000,
  strip: 100,
  sections: [
    { id: "family", top: 0, bottom: 1000 },
    { id: "celebrations", top: 1000, bottom: 2000 },
    { id: "wishes", top: 2000, bottom: 2700 },
  ],
  rows: [
    {
      top: 1100,
      descBottom: 1200,
      stripBottom: 1320,
      textLeft: 300,
      textRight: 700,
    },
    {
      top: 1400,
      descBottom: 1500,
      stripBottom: 1620,
      textLeft: 300,
      textRight: 700,
    },
  ],
  glyphs: [
    { left: 300, right: 500, top: 1100, bottom: 1120, text: "Ritual 0" },
    { left: 300, right: 400, top: 1300, bottom: 1315, text: "View photos" },
    { left: 300, right: 500, top: 1400, bottom: 1420, text: "Ritual 1" },
    { left: 300, right: 400, top: 1600, bottom: 1615, text: "View photos" },
  ],
};

const straight = (/** @type {number} */ length, step = 4) =>
  Array.from({ length: length / step + 1 }, (_, k) => ({
    x: k * step,
    y: 500,
  }));

/** The largest turn between consecutive spans inside `keep`, in degrees. */
const maxTurn = (
  /** @type {{ x: number, y: number }[]} */ points,
  /** @type {(p: { x: number, y: number }) => boolean} */ keep,
) => {
  let worst = 0;
  for (let i = 1; i < points.length - 1; i += 1) {
    if (!keep(points[i])) continue;
    const a = Math.atan2(
      points[i].y - points[i - 1].y,
      points[i].x - points[i - 1].x,
    );
    const b = Math.atan2(
      points[i + 1].y - points[i].y,
      points[i + 1].x - points[i].x,
    );
    let d = Math.abs(b - a);
    if (d > Math.PI) d = 2 * Math.PI - d;
    worst = Math.max(worst, (d * 180) / Math.PI);
  }
  return worst;
};

test("a point below Celebrations rises by every missing strip, and one above stays", () => {
  assert.deepEqual(toState({ x: 5, y: 2300 }, LAYOUT, [0, 1]), {
    x: 5,
    y: 2100,
  });
  assert.deepEqual(toState({ x: 5, y: 2300 }, LAYOUT, [1]), { x: 5, y: 2200 });
  assert.deepEqual(toState({ x: 5, y: 600 }, LAYOUT, [0, 1]), { x: 5, y: 600 });
});

test("inside a missing strip's gap the page closes up evenly", () => {
  /* Gap 1200–1400 (description to the next title) closes to 1200–1300. */
  assert.equal(toState({ x: 0, y: 1300 }, LAYOUT, [0]).y, 1250);
  assert.equal(toState({ x: 0, y: 1400 }, LAYOUT, [0]).y, 1300);
  assert.equal(toState({ x: 0, y: 1200 }, LAYOUT, [0]).y, 1200);
});

test("toDrawn undoes toState everywhere on the page", () => {
  for (const removed of [[], [0], [1], [0, 1]])
    for (let y = 0; y <= 2700; y += 37) {
      const back = toDrawn(
        toState({ x: 1, y }, LAYOUT, removed),
        LAYOUT,
        removed,
      );
      assert.ok(
        Math.abs(back.y - y) < 1e-6,
        `${removed}: ${y} came back as ${back.y}`,
      );
    }
});

test("the mapping puts every kept line of type where the generator's page model does", () => {
  /* The owner drew relative to the type, so type is the reference: each glyph that stays maps to
     the place layoutWithout gives it on the page with the strips gone. */
  for (const removed of [[0], [1], [0, 1]]) {
    const target = layoutWithout(LAYOUT, removed);
    const kept = LAYOUT.glyphs.filter((g) =>
      target.glyphs.some(
        (t) =>
          t.text === g.text &&
          t.left === g.left &&
          t.bottom - t.top === g.bottom - g.top &&
          Math.abs(t.top - toState({ x: 0, y: g.top }, LAYOUT, removed).y) <
            1e-9,
      ),
    );
    const expectedKept = target.glyphs.length;
    assert.equal(
      kept.length,
      expectedKept,
      `${removed}: every kept glyph lands where the page model puts it`,
    );
  }
});

test("a state takes the mark drawn on it, else the one drawn nearest in strip count", () => {
  const marks = [
    { group: 0, states: ["0000"], spread: true, id: "a" },
    { group: 0, states: ["1100"], spread: true, id: "b" },
    {
      group: 1,
      states: ["0000", "1000", "1100", "1110", "1111"],
      spread: true,
      id: "c",
    },
  ];
  const ids = (/** @type {string} */ c) =>
    chooseMarks(marks, c).map((m) => m.id);
  assert.deepEqual(ids("0000"), ["a", "c"]);
  assert.deepEqual(ids("1100"), ["b", "c"]);
  assert.deepEqual(ids("1000"), ["a", "c"]); // 1 strip: 0 and 2 tie, the fewer wins
  assert.deepEqual(ids("1111"), ["b", "c"]);
  assert.deepEqual(ids("0110"), ["b", "c"]);
});

test("a stroke replaces the line between where its ends meet it, and nothing else", () => {
  const line = straight(400);
  const stroke = [
    { x: 100, y: 502 },
    { x: 150, y: 480 },
    { x: 200, y: 470 },
    { x: 250, y: 480 },
    { x: 300, y: 498 },
  ];
  for (const points of [stroke, stroke.slice().reverse()]) {
    const [out] = applyPen(
      [{ points: line }],
      { strokes: [{ group: 0, states: ["1111"], points }] },
      "1111",
      (p) => p,
    );
    assert.ok(
      out.points.some((p) => Math.hypot(p.x - 200, p.y - 470) < 1.5),
      "passes through the stroke's top",
    );
    for (const p of out.points)
      if (p.x < 70 || p.x > 330) assert.equal(p.y, 500, `x ${p.x} untouched`);
    assert.deepEqual(out.points[0], line[0]);
    assert.deepEqual(out.points.at(-1), line.at(-1));
    for (let i = 1; i < out.points.length; i += 1)
      assert.ok(out.points[i].x >= out.points[i - 1].x - 1e-9, "runs one way");
  }
});

test("a stroke is drawn on the state's page: a point maps through the state before it is spliced", () => {
  const line = straight(400);
  const stroke = [
    { x: 100, y: 600 },
    { x: 200, y: 560 },
    { x: 300, y: 600 },
  ];
  const down = (/** @type {{x:number,y:number}} */ p) => ({
    x: p.x,
    y: p.y - 100,
  });
  const [out] = applyPen(
    [{ points: line }],
    { strokes: [{ group: 0, states: ["1111"], points: stroke }] },
    "1111",
    down,
  );
  assert.ok(out.points.some((p) => Math.hypot(p.x - 200, p.y - 460) < 1.5));
});

test("a stroke whose ends sit a little off the line is carried onto it, the drift spread along it", () => {
  /* Drawn on another photo state, a stroke can land some pixels off this state's line. Its ends
     move onto the line and the rest follows in proportion, so the line stays continuous. */
  const line = straight(400);
  const stroke = [
    { x: 100, y: 510 },
    { x: 200, y: 480 },
    { x: 300, y: 510 },
  ];
  const [out] = applyPen(
    [{ points: line }],
    { strokes: [{ group: 0, states: ["1111"], points: stroke }] },
    "1111",
    (p) => p,
  );
  assert.ok(
    out.points.some((p) => Math.hypot(p.x - 200, p.y - 470) < 1.5),
    "the stroke's middle carried by the ends' drift",
  );
  /* Between the ends, the new run lies along the carried stroke (the seams' easing aside). */
  const carried = [
    { x: 100, y: 500 },
    { x: 200, y: 470 },
    { x: 300, y: 500 },
  ];
  const offPath = (/** @type {{x:number,y:number}} */ p) => {
    const seg = p.x < 200 ? [carried[0], carried[1]] : [carried[1], carried[2]];
    const t = (p.x - seg[0].x) / (seg[1].x - seg[0].x);
    return Math.abs(p.y - (seg[0].y + (seg[1].y - seg[0].y) * t));
  };
  for (const p of out.points)
    if (p.x > 130 && p.x < 270)
      assert.ok(offPath(p) < 1.5, `x ${p.x.toFixed(1)} on the carried stroke`);
});

test("a stroke whose end is off the line, or that skips a connector, is refused by name", () => {
  const line = straight(400);
  const far = {
    strokes: [
      {
        group: 0,
        states: ["1111"],
        points: [
          { x: 100, y: 560 },
          { x: 300, y: 500 },
        ],
      },
    ],
  };
  assert.throws(
    () => applyPen([{ points: line }], far, "1111", (p) => p),
    /stroke 0.*1111.*off the line/,
  );
  /* Three connectors: a stroke from the first to the third skips one, so it is not a way through. */
  const row = (/** @type {number} */ y) =>
    straight(400).map((p) => ({ x: p.x, y }));
  const skipping = {
    strokes: [
      {
        group: 0,
        states: ["1111"],
        points: [
          { x: 100, y: 500 },
          { x: 200, y: 700 },
          { x: 300, y: 900 },
        ],
      },
    ],
  };
  assert.throws(
    () =>
      applyPen(
        [{ points: row(500) }, { points: row(700) }, { points: row(900) }],
        skipping,
        "1111",
        (p) => p,
      ),
    /stroke 0.*connectors that do not meet/,
  );
});

test("a mark that does not spread applies only to the photo states it was drawn on", () => {
  const marks = [
    { group: 0, states: ["1111"], id: "kept" },
    { group: 1, states: ["1111"], spread: true, id: "spread" },
  ];
  assert.deepEqual(
    chooseMarks(marks, "0000").map((m) => m.id),
    ["spread"],
  );
  assert.deepEqual(
    chooseMarks(marks, "1111").map((m) => m.id),
    ["kept", "spread"],
  );
});

test("a drift at one end only is eased out near that end, and the stroke keeps its drawn shape", () => {
  /* The line moved under one end since the stroke was drawn (a ring re-fitted beside it): spread
     along the whole stroke, that end's 30px dragged its middle 15px off where it was drawn. */
  const line = straight(400);
  const stroke = [
    { x: 100, y: 470 },
    { x: 150, y: 440 },
    { x: 200, y: 430 },
    { x: 250, y: 440 },
    { x: 300, y: 500 },
  ];
  const [out] = applyPen(
    [{ points: line }],
    { strokes: [{ group: 0, states: ["1111"], points: stroke }] },
    "1111",
    (p) => p,
  );
  assert.ok(
    out.points.some((p) => Math.hypot(p.x - 200, p.y - 430) < 2),
    "the stroke's middle stays where it was drawn",
  );
  assert.ok(
    out.points.some((p) => Math.hypot(p.x - 100, p.y - 500) < 5),
    "the drifted end still lands on the line (its corner eased over the blend)",
  );
});

test("a traced stroke's corner between two long runs is found; its short traced steps are not corners", () => {
  assert.deepEqual(
    cornersOf([
      { x: 60, y: 500 },
      { x: 200, y: 500 },
      { x: 300, y: 400 },
    ]),
    [1],
  );
  assert.deepEqual(
    cornersOf([
      { x: 100, y: 500 },
      { x: 150, y: 450 },
      { x: 154, y: 450 },
      { x: 156, y: 446 },
      { x: 170, y: 440 },
    ]),
    [],
  );
});

test("corners closer than their two reaches are not both kept, so rounding one cannot move the other", () => {
  const zigzag = [];
  for (let k = 0; k <= 6; k += 1)
    zigzag.push({ x: k * 30, y: k % 2 === 0 ? 0 : 30 });
  const corners = cornersOf(zigzag);
  assert.ok(corners.length > 0, "the zig-zag has corners");
  for (let k = 1; k < corners.length; k += 1)
    assert.ok(
      corners[k] - corners[k - 1] >= 3,
      `corners ${corners[k - 1]} and ${corners[k]} lie within each other's reach`,
    );
});

test("checkPen refuses corners out of order or named twice", () => {
  const stroke = {
    group: 0,
    states: ["1111"],
    points: [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 200, y: 100 },
      { x: 300, y: 100 },
    ],
  };
  assert.throws(() =>
    checkPen("tall", { strokes: [{ ...stroke, corners: [2, 1] }] }),
  );
  assert.throws(() =>
    checkPen("tall", { strokes: [{ ...stroke, corners: [1, 1] }] }),
  );
  assert.doesNotThrow(() =>
    checkPen("tall", { strokes: [{ ...stroke, corners: [1, 2] }] }),
  );
});

test("where a stroke left the line, its corner is rounded on the photo state's page, and the line bends gently", () => {
  /* The pen traced the red line, then left it at a single point; spliced as it is, the line kinks
     there. */
  const line = straight(400);
  const [rounded] = applyPen(
    [{ points: line }],
    {
      strokes: [
        {
          group: 0,
          states: ["1111"],
          points: [
            { x: 60, y: 500 },
            { x: 200, y: 500 },
            { x: 300, y: 400 },
            { x: 400, y: 500 },
          ],
          corners: [1],
        },
      ],
    },
    "1111",
    (p) => p,
  );
  assert.ok(
    !rounded.points.some((p) => Math.hypot(p.x - 200, p.y - 500) < 3),
    "the corner is rounded away",
  );
  const near = rounded.points.filter(
    (p) => Math.hypot(p.x - 200, p.y - 500) < 60,
  );
  assert.ok(
    maxTurn(near, () => true) < 20,
    `turn at the rounded corner ${maxTurn(near, () => true).toFixed(0)}°`,
  );
  assert.ok(
    rounded.points.some((p) => Math.hypot(p.x - 300, p.y - 400) < 1),
    "a corner it does not name stays as drawn",
  );
});

test("each half of a stroke past a motif bends onto the motif's end, with no hook", () => {
  /* The stroke comes nearest the motif's entry 30px short of it; cut there and joined straight to
     the entry, the line would turn back on itself. */
  const into = straight(400);
  const outOf = straight(400)
    .reverse()
    .map((p) => ({ x: p.x, y: 600 }));
  const stroke = [
    { x: 300, y: 500 },
    { x: 330, y: 470 },
    { x: 360, y: 450 },
    { x: 390, y: 445 },
    { x: 440, y: 470 },
    { x: 450, y: 560 },
    { x: 380, y: 630 },
    { x: 340, y: 625 },
    { x: 300, y: 600 },
  ];
  const [a] = applyPen(
    [{ points: into }, { points: outOf }],
    { strokes: [{ group: 0, states: ["1111"], points: stroke }] },
    "1111",
    (p) => p,
  );
  const near = a.points.filter((p) => Math.hypot(p.x - 400, p.y - 500) < 80);
  assert.ok(
    maxTurn(near, () => true) < 70,
    `turn near the motif ${maxTurn(near, () => true).toFixed(0)}°`,
  );
});

test("a stroke whose ends both lie near one connector stays on it, though an end is nearer the next", () => {
  /* Connector 0 runs along y 500 and turns down to its motif at (400,600); connector 1 leaves the
     motif up and to the right. The stroke ends on connector 0's downturn, a few px from connector
     1's start: both ends are on connector 0, so connector 1 is left alone. */
  const into = [
    ...straight(400),
    { x: 400, y: 540 },
    { x: 400, y: 580 },
    { x: 400, y: 600 },
  ];
  const outOf = [
    { x: 400, y: 600 },
    { x: 420, y: 560 },
    { x: 800, y: 560 },
  ];
  const stroke = [
    { x: 200, y: 500 },
    { x: 300, y: 470 },
    { x: 380, y: 500 },
    { x: 408, y: 575 },
  ];
  const [a, b] = applyPen(
    [{ points: into }, { points: outOf }],
    { strokes: [{ group: 0, states: ["1111"], points: stroke }] },
    "1111",
    (p) => p,
  );
  assert.deepEqual(b.points, outOf, "connector 1 untouched");
  /* The stroke's end is carried 8px onto the downturn, so its middle follows by about half that. */
  assert.ok(a.points.some((p) => Math.hypot(p.x - 300, p.y - 470) < 5));
  assert.deepEqual(a.points.at(-1), into.at(-1));
});

test("a stroke from one connector to the next is a way past the motif between them", () => {
  /* Connector 0 runs to a motif at (400,500); connector 1 leaves it at (400,600). The stroke leaves
     connector 0 at x 300, swings past the motif and joins connector 1 at x 300. Each connector
     keeps the end that meets the motif, and takes the stroke's half nearest it, bent onto the
     motif's own end (so its points shift by at most the gap that bend closes). */
  const into = straight(400);
  const outOf = straight(400)
    .reverse()
    .map((p) => ({ x: p.x, y: 600 }));
  const stroke = [
    { x: 300, y: 500 },
    { x: 360, y: 470 },
    { x: 420, y: 520 },
    { x: 430, y: 560 },
    { x: 380, y: 630 },
    { x: 340, y: 625 },
    { x: 300, y: 600 },
  ];
  const [a, b] = applyPen(
    [{ points: into }, { points: outOf }],
    { strokes: [{ group: 0, states: ["1111"], points: stroke }] },
    "1111",
    (p) => p,
  );
  assert.deepEqual(
    a.points.at(-1),
    into.at(-1),
    "connector 0 still meets the motif",
  );
  assert.deepEqual(b.points[0], outOf[0], "connector 1 still leaves it");
  assert.ok(
    a.points.some((p) => Math.hypot(p.x - 360, p.y - 470) < 20),
    "connector 0 takes the stroke's first half",
  );
  /* The bend closes the gap from the stroke's nearest point (380,630) to the motif's end (400,600). */
  const gap = Math.hypot(400 - 380, 600 - 630);
  assert.ok(
    b.points.some((p) => Math.hypot(p.x - 340, p.y - 625) < gap),
    "connector 1 takes its second half",
  );
  for (const p of a.points) if (p.x < 270) assert.equal(p.y, 500);
  for (const p of b.points) if (p.x < 270) assert.equal(p.y, 600);
});

test("a smoothing zone calms the line inside it and leaves the rest as drawn", () => {
  const zig = Array.from({ length: 101 }, (_, k) => ({
    x: k * 4,
    y: 500 + (k >= 45 && k <= 55 ? (k % 2 ? 6 : -6) : 0),
  }));
  const inside = (/** @type {{x:number,y:number}} */ p) =>
    Math.hypot(p.x - 200, p.y - 500) < 40;
  const [out] = applyPen(
    [{ points: zig }],
    { zones: [{ group: 0, states: ["1111"], x: 200, y: 500, r: 40 }] },
    "1111",
    (p) => p,
  );
  assert.ok(
    maxTurn(out.points, inside) < maxTurn(zig, inside) / 2,
    "inside calmer",
  );
  for (const p of out.points)
    if (Math.abs(p.x - 200) > 90) assert.equal(p.y, 500);
});

test("a move carries the line and the attachments inside its box down, easing out beyond it", () => {
  const line = straight(800);
  const attachments = [
    {
      section: "wishes",
      motif: "bow",
      which: "entry",
      x: 400,
      y: 500,
      heading: 0,
    },
    {
      section: "wishes",
      motif: "rings",
      which: "entry",
      x: 50,
      y: 500,
      heading: 0,
    },
  ];
  const pen = {
    moves: [{ box: { x0: 300, y0: 450, x1: 500, y1: 550 }, dy: 30, ease: 60 }],
  };
  const {
    connectors: [out],
    attachments: moved,
  } = applyMoves([{ points: line }], attachments, pen.moves, (p) => p);
  for (const p of out.points) {
    if (p.x >= 300 && p.x <= 500) assert.equal(p.y, 530, `x ${p.x} carried`);
    if (p.x < 230 || p.x > 570) assert.equal(p.y, 500, `x ${p.x} untouched`);
  }
  assert.equal(moved[0].y, 530);
  assert.equal(moved[1].y, 500);
});

test("a smoothing zone keeps a loop inside it and smooths the line either side", () => {
  /* A line along y 500 with a kink at x 150 and a small loop at x 200: the zone covers both. The
     loop must still cross itself afterwards; the kink must calm. */
  /* Runs right to x 205, rises round anticlockwise and crosses its own way in near x 200. */
  const loop = [
    { x: 212, y: 494 },
    { x: 212, y: 484 },
    { x: 204, y: 477 },
    { x: 195, y: 480 },
    { x: 192, y: 488 },
    { x: 196, y: 496 },
    { x: 203, y: 504 },
  ];
  const line = [
    ...Array.from({ length: 30 }, (_, k) => ({ x: k * 4, y: 500 })),
    { x: 125, y: 500 },
    { x: 140, y: 485 },
    { x: 155, y: 500 },
    { x: 170, y: 500 },
    { x: 185, y: 500 },
    { x: 205, y: 500 },
    ...loop,
    { x: 220, y: 503 },
    ...Array.from({ length: 30 }, (_, k) => ({ x: 230 + k * 4, y: 500 })),
  ];
  const [out] = applyPen(
    [{ points: line }],
    { zones: [{ group: 0, states: ["1111"], x: 175, y: 495, r: 50 }] },
    "1111",
    (p) => p,
  );
  const crosses = (/** @type {{x:number,y:number}[]} */ pts) => {
    for (let i = 0; i < pts.length - 1; i += 1)
      for (let j = i + 2; j < pts.length - 1; j += 1) {
        const [a, b, c, d] = [pts[i], pts[i + 1], pts[j], pts[j + 1]];
        const o = (
          /** @type {any} */ p,
          /** @type {any} */ q,
          /** @type {any} */ r,
        ) => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
        if (o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0)
          return true;
      }
    return false;
  };
  assert.ok(crosses(out.points), "the loop still crosses itself");
  const nearKink = (/** @type {{x:number,y:number}} */ p) =>
    p.x > 120 && p.x < 165;
  assert.ok(
    maxTurn(out.points, nearKink) < maxTurn(line, nearKink) / 2,
    "the kink calmed",
  );
});

test("the points a mark adds are thinned, and the line's own points stay", () => {
  /* A smoothing zone on a long straight run adds a point every few pixels; on a straight line none
     of them carries shape. Beyond the zone's reach every point the line had is still there. */
  const line = straight(800, 40);
  const [out] = applyPen(
    [{ points: line }],
    { zones: [{ group: 0, states: ["1111"], x: 400, y: 500, r: 60 }] },
    "1111",
    (p) => p,
  );
  /* The zone reaches 310–490 along the line; outside it every point of the line is its own. */
  for (const p of line.filter((q) => q.x < 300 || q.x > 500))
    assert.ok(
      out.points.some((q) => q.x === p.x && q.y === p.y),
      `x ${p.x} kept`,
    );
  assert.ok(
    out.points.length <= line.length + 2,
    `${out.points.length} points`,
  );
});

test("no pen leaves every connector as drawn", () => {
  const connectors = [{ points: straight(400) }];
  assert.deepEqual(
    applyPen(connectors, {}, "1010", (p) => p),
    connectors,
  );
});

test("the pen's colours are read only where the drawing differs from the sheet sent", () => {
  /* Three pixels: magenta pen on a changed pixel, cyan pen on a changed pixel, and a magenta-looking
     pixel that was already on the sheet (a flower). */
  const sent = Uint8Array.from([250, 240, 230, 250, 240, 230, 200, 10, 80]);
  const drawn = Uint8Array.from([200, 10, 80, 40, 200, 235, 200, 10, 80]);
  const { magenta, cyan } = penMask(sent, drawn, 3);
  assert.deepEqual([...magenta], [1, 0, 0]);
  assert.deepEqual([...cyan], [0, 1, 0]);
});

test("a cyan blob becomes a zone that encloses it, and a speck is no zone", () => {
  const w = 60;
  const h = 40;
  const mask = new Uint8Array(w * h);
  for (let y = 10; y < 30; y += 1)
    for (let x = 10; x < 30; x += 1)
      if (Math.hypot(x - 20, y - 20) <= 9) mask[y * w + x] = 1;
  mask[5 * w + 50] = 1;
  const zones = zonesOf(mask, w, h);
  assert.equal(zones.length, 1);
  assert.ok(Math.abs(zones[0].x - 20) < 0.5 && Math.abs(zones[0].y - 20) < 0.5);
  assert.ok(zones[0].r >= 9 && zones[0].r < 11);
});

test("checkPen refuses a mark it cannot read, naming the band and the mark", () => {
  assert.throws(
    () =>
      checkPen("wide", {
        strokes: [{ group: 0, states: ["1111"], points: [{ x: 1, y: 1 }] }],
      }),
    /wide.*stroke 0/,
  );
  assert.throws(
    () =>
      checkPen("wide", {
        zones: [{ group: 0, states: ["2"], x: 1, y: 1, r: 4 }],
      }),
    /wide.*zone 0/,
  );
  assert.throws(
    () =>
      checkPen("tall", {
        moves: [{ box: { x0: 1, y0: 1, x1: 0, y1: 2 }, dy: 3, ease: 10 }],
      }),
    /tall.*move 0/,
  );
  checkPen("wide", { strokes: [], zones: [], moves: [] });
});
