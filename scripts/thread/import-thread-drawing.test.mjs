/* Round-trip proof for the hand-drawn thread importer, entirely synthetic — no gitignored fixture
 * is read, so this test runs the same in every clone. It builds its own sheet (four registration
 * crosses plus two magenta strokes at known coordinates), abuses it the way a phone export would
 * (a non-integer rescale, re-encoded as JPEG), and asserts the recovered strokes land back on their
 * authored coordinates AND on the correct connector, in the correct orientation.
 *
 * The two strokes are deliberately drawn so the pixel-level loose end nearest the LEFT is the wrong
 * end for the connector it belongs to (see the coordinate comments below) — `walk` always starts
 * from the leftmost loose end regardless of authored path order, so a port that forgot to try both
 * orientations before assigning a stroke to a connector would land these on the wrong point and
 * this test would fail on the join-distance assertions, even though `extract()` alone would still
 * look fine.
 */

import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import sharp from "sharp";
import {
  CROSS_INSET,
  chainStrokes,
  cutAtMotifs,
  detourOffType,
  extract,
  importDrawing,
  joinsOf,
  overlayPatch,
  relaxOffType,
  SECTION_ORDER,
  typeClearanceReport,
  withLoops,
} from "./import-thread-drawing.mjs";

const PAGE = { width: 900, height: 900, crossInset: 64 };
const ARM = 40;
const EXPORT_SCALE = 0.83; // deliberately not a round number

const CROSSES = [
  [64, 64],
  [836, 64],
  [64, 836],
  [836, 836],
];

/* Stroke A serves the connector that runs FREE -> entry. Its authored draw order is
 * free-end(450,130) -> entry(250,300), but entry has the SMALLER x, so the pixel skeleton's
 * leftmost loose end is the entry tick, not the free end — the raw walk comes back backwards. */
const ENTRY = { x: 250, y: 300 };
const FREE_BEFORE = { x: 450, y: 130 };
const STROKE_A = [
  [FREE_BEFORE.x, FREE_BEFORE.y],
  [380, 190],
  [300, 250],
  [ENTRY.x, ENTRY.y],
];

/* Stroke B serves the connector that runs exit -> FREE. Its authored draw order is
 * exit(650,300) -> free-end(500,550), but the free end has the smaller x, so the raw walk again
 * comes back backwards relative to what the connector needs. */
const EXIT = { x: 650, y: 300 };
const FREE_AFTER = { x: 500, y: 550 };
const STROKE_B = [
  [EXIT.x, EXIT.y],
  [600, 380],
  [550, 470],
  [FREE_AFTER.x, FREE_AFTER.y],
];

/** @param {number[]} from @param {number[]} to */
const heading = (from, to) =>
  (Math.atan2(to[1] - from[1], to[0] - from[0]) * 180) / Math.PI;

const ATTACHMENTS = [
  {
    section: "invite",
    motif: "heart",
    which: "entry",
    x: ENTRY.x,
    y: ENTRY.y,
    heading: heading(STROKE_A[1], STROKE_A[2]),
  },
  {
    section: "invite",
    motif: "heart",
    which: "exit",
    x: EXIT.x,
    y: EXIT.y,
    heading: heading(STROKE_B[0], STROKE_B[1]),
  },
];

/* A slight sinusoidal wobble: a dead-straight line thins to a perfectly clean 1px skeleton and
 * proves nothing about handling a real, shaky hand-drawn line. */
/** @param {number[][]} pts */
const wobble = (pts) =>
  pts
    .map(
      ([x, y], i) => `${i === 0 ? "M" : "L"} ${x + Math.sin(i * 2.1) * 3} ${y}`,
    )
    .join(" ");

/** Distance from a point to the recovered POLYLINE, not to its nearest vertex — simplification
 * drops vertices the line still passes through, so a vertex-to-vertex metric would measure the
 * simplification rather than the fit. */
/**
 * @param {number} px
 * @param {number} py
 * @param {{ x: number, y: number }[]} line
 */
function toPolyline(px, py, line) {
  let best = Infinity;
  for (let i = 1; i < line.length; i += 1) {
    const a = line[i - 1];
    const b = line[i];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = dx * dx + dy * dy;
    const t =
      len === 0
        ? 0
        : Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / len));
    best = Math.min(best, Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy)));
  }
  return best;
}

/** @param {number[][][]} drawn */
function sheetSvg(drawn) {
  const crosses = CROSSES.flatMap(([x, y]) => [
    `<line x1="${x - ARM}" y1="${y}" x2="${x + ARM}" y2="${y}" stroke="#000" stroke-width="3"/>`,
    `<line x1="${x}" y1="${y - ARM}" x2="${x}" y2="${y + ARM}" stroke="#000" stroke-width="3"/>`,
  ]).join("\n");
  const strokes = drawn
    .map(
      (s) =>
        `<path d="${wobble(s)}" fill="none" stroke="#FF00FF" stroke-width="6" stroke-linecap="round"/>`,
    )
    .join("\n");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${PAGE.width}" height="${PAGE.height}">` +
    `<rect width="100%" height="100%" fill="#fff"/>${crosses}${strokes}</svg>`
  );
}

test("recovers a hand-drawn thread from a rescaled, re-encoded JPEG", async () => {
  const sheet = sheetSvg([STROKE_A, STROKE_B]);

  const dir = mkdtempSync(join(tmpdir(), "thread-import-test-"));
  const jpegPath = join(dir, "drawing.jpg");
  try {
    const w = Math.round(PAGE.width * EXPORT_SCALE);
    const h = Math.round(PAGE.height * EXPORT_SCALE);
    await sharp(Buffer.from(sheet))
      .resize(PAGE.width, PAGE.height, { fit: "fill" })
      .resize(w, h, { fit: "fill" })
      .jpeg({ quality: 82 })
      .toFile(jpegPath);

    const { map, strokes: recovered } = await extract(jpegPath, { page: PAGE });
    assert.equal(recovered.length, 2, "both strokes recovered");
    assert.ok(
      Math.abs(map.scaleX - 1 / EXPORT_SCALE) < 0.02,
      `recovered scale x tracks the export scale (${map.scaleX})`,
    );

    const { line, joints } = chainStrokes(recovered, ATTACHMENTS);
    const cut = cutAtMotifs(line, joints, ATTACHMENTS);
    assert.deepEqual(cut.faults, []);
    assert.equal(
      cut.connectors.length,
      2,
      "one connector before the motif, one after",
    );
    const { joins } = joinsOf(cut.connectors, cut.attachments, PAGE);

    const entryJoin = joins.find((j) => j.connector === 0 && j.end === "to");
    const exitJoin = joins.find((j) => j.connector === 1 && j.end === "from");
    assert.ok(entryJoin, "connector 0 measured against the entry tick");
    assert.ok(exitJoin, "connector 1 measured against the exit tick");
    assert.ok(
      entryJoin.dist < 15,
      `connector 0 lands ${entryJoin.dist.toFixed(1)}px from the entry tick, correctly oriented`,
    );
    assert.ok(
      exitJoin.dist < 15,
      `connector 1 leaves ${exitJoin.dist.toFixed(1)}px from the exit tick, correctly oriented`,
    );

    const control = [
      [FREE_BEFORE, { x: 380, y: 190 }, { x: 300, y: 250 }, ENTRY],
      [EXIT, { x: 600, y: 380 }, { x: 550, y: 470 }, FREE_AFTER],
    ];
    let worst = 0;
    cut.connectors.forEach((stroke, k) => {
      for (const p of control[k].slice(1, -1))
        worst = Math.max(worst, toPolyline(p.x, p.y, stroke));
    });
    assert.ok(
      worst < 10,
      `worst interior deviation ${worst.toFixed(1)}px stays under 10px`,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("relaxes a drawn connector clear of a glyph it crosses, without moving its pinned ends", () => {
  /* One real section ("invite", floor 8px) big enough to hold the whole stroke; the other four are
   * degenerate placeholders — `relaxOffType` and `typeClearanceReport` both index sections by
   * position against the fixed five-section order, so a synthetic geometry still needs all five. */
  const geometry = {
    width: 1000,
    sections: [
      { top: 0, height: 1000 },
      { top: 1000, height: 1 },
      { top: 1001, height: 1 },
      { top: 1002, height: 1 },
      { top: 1003, height: 1 },
    ],
  };
  const glyphs = [
    { left: 140, right: 160, top: 110, bottom: 120, text: "Sebastian" },
  ];
  /* A straight line at the glyph's own height crosses it dead centre (distance 0, a genuine
   * crossing) for the 20px of its width; both ends sit far outside it already — comfortably clear
   * of the 8px floor before relaxing at all — so a correct port must leave them untouched rather
   * than relaxing them too. */
  const points = [
    { x: 50, y: 113 },
    { x: 150, y: 113 },
    { x: 250, y: 113 },
  ];
  const connectors = [{ connector: 0, points }];

  const before = typeClearanceReport(connectors, geometry, glyphs);
  assert.equal(
    before[0].crossings > 0,
    true,
    "the planted stroke does cross the glyph before relaxing",
  );

  const {
    connectors: relaxed,
    moved,
    stuck,
  } = relaxOffType(connectors, geometry, glyphs);
  assert.equal(stuck.length, 0, "a wide-open corridor converges");
  assert.ok(moved > 0, "the crossing vertex actually moved");
  const relaxedPoints = /** @type {{ x: number, y: number }[]} */ (
    relaxed[0].points
  );
  assert.deepEqual(relaxedPoints[0], points[0], "the entry end is pinned");
  assert.deepEqual(
    relaxedPoints.at(-1),
    points.at(-1),
    "the exit end is pinned",
  );

  const after = typeClearanceReport(relaxed, geometry, glyphs);
  assert.equal(
    after[0].crossings,
    0,
    "no sample lands on the glyph after relaxing",
  );
  /* The relax floor is a target, not a guarantee, so only the absence of a crossing is asserted. */
  assert.ok(
    after[0].min > 0,
    `relaxed clearance ${after[0].min.toFixed(1)}px is genuinely off the glyph, not just at its edge`,
  );
});

/* The CLI end to end, in a temp sheet directory, with the live page read injected so no browser
 * runs. The sheet's five sections match `SECTION_ORDER`; only the first holds the drawing. */
const SHEET_GEOMETRY = {
  width: PAGE.width,
  sections: [
    { top: 0, height: 895 },
    { top: 895, height: 1 },
    { top: 896, height: 1 },
    { top: 897, height: 1 },
    { top: 898, height: 1 },
  ],
};
const EARLIER_CONNECTORS = '[{"connector":0,"points":[{"x":1,"y":2}]}]\n';
const EARLIER_JOINS = '[{"connector":0,"end":"to"}]\n';

/**
 * @param {import("node:test").TestContext} t
 * @param {number[][][]} drawn
 * @param {{ glyphs: { left: number, right: number, top: number, bottom: number, text?: string }[], sections: number }} page
 * @param {{ width: number, sections: { top: number, height: number }[] }} [geometry]
 * @param {string[]} [extra] further command-line flags
 */
async function runImport(
  t,
  drawn,
  page,
  geometry = SHEET_GEOMETRY,
  extra = [],
) {
  const dir = mkdtempSync(join(tmpdir(), "thread-import-cli-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, "geometry.json"), JSON.stringify(geometry));
  writeFileSync(join(dir, "attachments.json"), JSON.stringify(ATTACHMENTS));
  writeFileSync(join(dir, "connectors.json"), EARLIER_CONNECTORS);
  writeFileSync(join(dir, "joins.json"), EARLIER_JOINS);
  const drawing = join(dir, "drawing.png");
  await sharp(Buffer.from(sheetSvg(drawn)))
    .png()
    .toFile(drawing);

  /** @type {string[]} */
  const errors = [];
  t.mock.method(console, "log", () => {});
  t.mock.method(console, "error", (/** @type {unknown} */ line) =>
    errors.push(String(line)),
  );
  let reads = 0;
  const code = await importDrawing(
    ["tall", drawing, `--dir=${dir}`, ...extra],
    {
      readPage: async () => {
        reads += 1;
        return { portraits: [], ...page };
      },
    },
  );
  return {
    code,
    reads,
    errors: errors.join("\n"),
    connectors: readFileSync(join(dir, "connectors.json"), "utf8"),
    joins: readFileSync(join(dir, "joins.json"), "utf8"),
    dir,
  };
}

test("a clean drawing imports: exit 0, every connector written with points", async (t) => {
  const run = await runImport(t, [STROKE_A, STROKE_B], {
    glyphs: [],
    sections: SHEET_GEOMETRY.sections.length,
  });
  assert.equal(run.code, 0, run.errors);
  const written = JSON.parse(run.connectors);
  assert.equal(written.length, 2);
  assert.ok(
    written.every((/** @type {{ points: unknown }} */ c) =>
      Array.isArray(c.points),
    ),
  );
  assert.notEqual(run.joins, EARLIER_JOINS);
});

test("a drawing that never reaches a motif's tick is refused before the page is read, and writes nothing", async (t) => {
  const run = await runImport(t, [STROKE_A], {
    glyphs: [],
    sections: SHEET_GEOMETRY.sections.length,
  });
  assert.notEqual(run.code, 0);
  assert.match(run.errors, /REFUSED: the line passes invite\/heart's exit/);
  assert.equal(run.reads, 0, "refused before reading the live page");
  assert.equal(run.connectors, EARLIER_CONNECTORS);
  assert.equal(run.joins, EARLIER_JOINS);
});

test("a stray stroke away from every motif is refused, and writes nothing", async (t) => {
  const stray = [
    [700, 650],
    [740, 700],
    [780, 760],
  ];
  const run = await runImport(t, [STROKE_A, STROKE_B, stray], {
    glyphs: [],
    sections: SHEET_GEOMETRY.sections.length,
  });
  assert.notEqual(run.code, 0);
  assert.match(run.errors, /REFUSED: a gap of \d+px/);
  assert.equal(run.reads, 0, "refused before reading the live page");
  assert.equal(run.connectors, EARLIER_CONNECTORS);
  assert.equal(run.joins, EARLIER_JOINS);
});

test("a drawing that crosses type leaves the sheet's connectors and joins byte-identical", async (t) => {
  /* Over the entry attachment, which relaxing never moves, so the crossing survives the relax. */
  const glyph = { left: 220, right: 280, top: 270, bottom: 330, text: "Flemy" };
  const run = await runImport(t, [STROKE_A, STROKE_B], {
    glyphs: [glyph],
    sections: SHEET_GEOMETRY.sections.length,
  });
  assert.notEqual(run.code, 0);
  assert.match(run.errors, /REFUSED: the drawn thread crosses type/);
  assert.equal(run.connectors, EARLIER_CONNECTORS);
  assert.equal(run.joins, EARLIER_JOINS);
});

test("a sheet whose section count differs from the live page's is refused, and writes nothing", async (t) => {
  const run = await runImport(t, [STROKE_A, STROKE_B], {
    glyphs: [],
    sections: SHEET_GEOMETRY.sections.length - 1,
  });
  assert.notEqual(run.code, 0);
  assert.match(
    run.errors,
    new RegExp(
      `REFUSED: .* the live page has ${SHEET_GEOMETRY.sections.length - 1}\\.`,
    ),
  );
  assert.equal(run.connectors, EARLIER_CONNECTORS);
  assert.equal(run.joins, EARLIER_JOINS);
});

test("a sheet whose section count differs from SECTION_ORDER is refused before the page is read", async (t) => {
  const geometry = {
    ...SHEET_GEOMETRY,
    sections: [{ top: 0, height: 896 }, ...SHEET_GEOMETRY.sections.slice(2)],
  };
  const run = await runImport(
    t,
    [STROKE_A, STROKE_B],
    { glyphs: [], sections: geometry.sections.length },
    geometry,
  );
  assert.notEqual(run.code, 0);
  assert.match(
    run.errors,
    new RegExp(`REFUSED: .* SECTION_ORDER names ${SECTION_ORDER.length}\\.`),
  );
  assert.equal(run.reads, 0, "refused before reading the live page");
  assert.equal(run.connectors, EARLIER_CONNECTORS);
  assert.equal(run.joins, EARLIER_JOINS);
});

/* The final motif sheets (2026-11-01) are drawn on the page as it ships: five sections, Contact retired. */
test("the importer expects the five sections the page has", () => {
  assert.deepEqual(SECTION_ORDER, [
    "invite",
    "event-info",
    "family",
    "celebrations",
    "wishes",
  ]);
});

/* The final sheets carry their registration crosses at one inset on every band; a cross clipped by the canvas
   edge biases its own centroid, which reads as a scale error. */
test("every band's crosses sit at the final sheets' 64px inset", () => {
  assert.deepEqual(CROSS_INSET, { wide: 64, tall: 64, upright: 64 });
});

/* ---- the continuous redraw: one line chained from its strokes, cut at every motif ---- */

/** @param {number} x0 @param {number} y0 @param {number} x1 @param {number} y1 @param {number} [n] */
const segment = (x0, y0, x1, y1, n = 40) =>
  Array.from({ length: n + 1 }, (_, k) => ({
    x: x0 + ((x1 - x0) * k) / n,
    y: y0 + ((y1 - y0) * k) / n,
  }));

test("chainStrokes joins the strokes into one line from the top, each the way it runs", () => {
  const top = segment(100, 0, 100, 100);
  const middle = segment(110, 300, 105, 110); // drawn upward: must be reversed
  const bottom = segment(120, 310, 120, 500);
  const { line, joints } = chainStrokes([bottom, middle, top]);
  assert.deepEqual(line[0], top[0]);
  assert.deepEqual(line[line.length - 1], bottom[bottom.length - 1]);
  assert.deepEqual(joints, [top.length, top.length + middle.length]);
  assert.deepEqual(line[top.length], middle[middle.length - 1]);
});

/** @param {string} motif @param {string} which @param {{ x: number, y: number }} at @param {number} heading */
const tick = (motif, which, at, heading) => ({
  section: "invite",
  motif,
  which,
  ...at,
  heading,
});

test("chainStrokes crosses a motif to its exit before taking the next stroke", () => {
  /* The pen stops at the heart's entry and resumes at its exit, 300px away. Another stroke's far
     end lies nearer the entry than the exit does, which a nearest-end chain would take. */
  const before = segment(100, 0, 100, 200);
  const after = segment(400, 200, 150, 320);
  const attachments = [
    tick("heart", "entry", { x: 100, y: 200 }, 90),
    tick("heart", "exit", { x: 400, y: 200 }, 90),
  ];
  const { line } = chainStrokes([before, after], attachments);
  assert.deepEqual(line[before.length], after[0]);
  assert.deepEqual(line[line.length - 1], after[after.length - 1]);
});

test("cutAtMotifs cuts the line out where it runs through a motif, from entry tick to exit tick", () => {
  const line = segment(100, 0, 100, 600, 600);
  const attachments = [
    tick("heart", "entry", { x: 104, y: 200 }, 90),
    tick("heart", "exit", { x: 97, y: 260 }, 90),
  ];
  const { connectors, faults } = cutAtMotifs(line, [], attachments);
  assert.deepEqual(faults, []);
  assert.equal(connectors.length, 2);
  assert.equal(connectors[0][connectors[0].length - 1].y, 200);
  assert.equal(connectors[1][0].y, 260);
  assert.equal(connectors[1][connectors[1].length - 1].y, 600);
});

test("cutAtMotifs refuses a motif the line never comes near, at either tick", () => {
  const line = segment(100, 0, 100, 600, 600);
  for (const [entryAt, exitAt, which] of /** @type {const} */ ([
    [{ x: 300, y: 200 }, { x: 100, y: 260 }, "entry"],
    [{ x: 100, y: 200 }, { x: 300, y: 260 }, "exit"],
  ])) {
    const { faults } = cutAtMotifs(
      line,
      [],
      [tick("knot", "entry", entryAt, 90), tick("knot", "exit", exitAt, 90)],
    );
    assert.match(faults.join("\n"), new RegExp(`knot's ${which}`));
  }
});

test("cutAtMotifs refuses a long gap inside a connector: a stroke left stray, not a pen lift at a motif", () => {
  const first = segment(100, 0, 100, 200);
  const stray = segment(400, 220, 400, 300);
  const { line, joints } = chainStrokes([first, stray]);
  const { faults } = cutAtMotifs(line, joints, []);
  assert.match(faults.join("\n"), /gap/);
});

test("cutAtMotifs turns a portrait ring about its portrait so its tick sits where the line meets the ring", () => {
  /* A ring of radius 50 about (200, 300), its tick drawn at the top. The line runs down past the
     ring's left side, touching it at (150, 300): the tick turns -90 degrees to meet it. */
  const portrait = { x: 200, y: 300 };
  const line = [
    ...segment(150, 0, 150, 300, 300),
    ...segment(150, 301, 150, 600, 299),
  ];
  const attachments = [
    tick("portraitLoop", "entry", { x: 196, y: 250 }, 0),
    tick("portraitLoop", "exit", { x: 204, y: 250 }, 10),
  ];
  const {
    connectors,
    attachments: turned,
    faults,
  } = cutAtMotifs(line, [], attachments, {
    portraits: [portrait],
  });
  assert.deepEqual(faults, []);
  const end = connectors[0][connectors[0].length - 1];
  assert.ok(
    Math.abs(end.x - 150) < 2 && Math.abs(end.y - 300) < 6,
    `cut at ${end.x},${end.y}`,
  );
  for (const t of turned)
    assert.ok(
      Math.abs(Math.hypot(t.x - portrait.x, t.y - portrait.y) - 50) < 0.5,
      "the tick left the ring",
    );
  assert.ok(
    Math.hypot(turned[0].x - end.x, turned[0].y - end.y) < 1,
    "the entry tick is not on the cut",
  );
  const spacing = Math.hypot(
    turned[1].x - turned[0].x,
    turned[1].y - turned[0].y,
  );
  assert.ok(Math.abs(spacing - 8) < 0.01, `the ticks moved apart: ${spacing}`);
  /* The headings turn with the ring: by the angle the tick moved about the portrait. */
  const moved =
    (Math.atan2(turned[0].y - portrait.y, turned[0].x - portrait.x) -
      Math.atan2(250 - portrait.y, 196 - portrait.x)) *
    (180 / Math.PI);
  for (const [k, t] of turned.entries()) {
    const was = attachments[k].heading;
    const turnedBy =
      ((((t.heading - was - moved + 180) % 360) + 360) % 360) - 180;
    assert.ok(Math.abs(turnedBy) < 1e-6, `heading ${k} off by ${turnedBy}`);
  }
});

test("cutAtMotifs takes the last connector from the kept tail, moved onto the motif's new exit", () => {
  const line = segment(100, 0, 100, 400, 400);
  const attachments = [
    tick("bow", "entry", { x: 100, y: 380 }, 90),
    tick("bow", "exit", { x: 160, y: 300 }, 0),
  ];
  const tail = {
    from: { x: 60, y: 1000 },
    points: [
      { x: 60, y: 1000 },
      { x: 90, y: 1040 },
    ],
  };
  const { connectors, faults } = cutAtMotifs(line, [], attachments, { tail });
  assert.deepEqual(faults, []);
  assert.equal(connectors.length, 2);
  assert.equal(connectors[0][connectors[0].length - 1].y, 380);
  assert.deepEqual(connectors[1], [
    { x: 160, y: 300 },
    { x: 190, y: 340 },
  ]);
});

test("withLoops ties a loop into the line at its nearest point, turning the way the line runs", () => {
  const line = segment(60, 0, 60, 200, 200);
  const looped = withLoops(line, [{ x: 75, y: 100, r: 15 }]);
  const around = looped.filter(
    (p) => Math.abs(Math.hypot(p.x - 75, p.y - 100) - 15) < 1,
  );
  assert.ok(around.length > 40, `${around.length} points on the loop`);
  const at = looped.findIndex(
    (p) => Math.hypot(p.x - 75, p.y - 100) < 16 && p.x > 61,
  );
  /* The line runs down (+y); leaving (60,100) the loop must head down too, not back up. */
  assert.ok(
    looped[at + 2].y >= looped[at].y - 0.5,
    "the loop leaves against the line",
  );
  assert.deepEqual(looped[looped.length - 1], line[line.length - 1]);
});

test("overlayPatch replaces the field's rows with the patch's, from its sheet row down", () => {
  const field = { ink: new Uint8Array(4 * 6).fill(1), width: 4, height: 6 };
  const patch = { ink: new Uint8Array(4 * 2), width: 4, height: 2 };
  patch.ink[1] = 1;
  overlayPatch(field, patch, 3);
  assert.deepEqual([...field.ink.slice(12, 20)], [0, 1, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual([...field.ink.slice(0, 12)], Array(12).fill(1));
  assert.deepEqual([...field.ink.slice(20)], Array(4).fill(1));
});

test("relaxOffType moves a free page end off type, never an end joined to a motif", () => {
  const geometry = {
    width: 1000,
    sections: [
      { top: 0, height: 1000 },
      { top: 1000, height: 1 },
      { top: 1001, height: 1 },
      { top: 1002, height: 1 },
      { top: 1003, height: 1 },
    ],
  };
  /* The line starts at the page's free top end, 3px off the drawn names, and runs to a motif. */
  const names = {
    left: 100,
    right: 300,
    top: 50,
    bottom: 120,
    text: "drawn names",
  };
  const points = segment(303, 60, 450, 400, 40);
  /** @param {boolean} freeStart */
  const relaxed = (freeStart) =>
    relaxOffType([{ connector: 0, points, freeStart }], geometry, [names])
      .connectors;
  const nearest = (/** @type {boolean} */ freeStart) =>
    typeClearanceReport(relaxed(freeStart), geometry, [names])[0].min;
  assert.ok(nearest(false) < 4, "a pinned start cannot leave the names");
  assert.ok(
    nearest(true) > 7.5,
    `the free start sits ${nearest(true).toFixed(1)}px off the names`,
  );
  const after = /** @type {{ x: number, y: number }[]} */ (
    relaxed(true)[0].points
  );
  assert.deepEqual(
    after[after.length - 1],
    points[points.length - 1],
    "the motif end moved",
  );
});

test("a speck of magenta is skipped, not traced as a stroke", async (t) => {
  const run = await runImport(
    t,
    [
      STROKE_A,
      STROKE_B,
      [
        [700, 700],
        [702, 700],
      ],
    ],
    { glyphs: [], sections: SHEET_GEOMETRY.sections.length },
  );
  assert.equal(run.code, 0, run.errors);
  assert.equal(JSON.parse(run.connectors).length, 2);
});

test("cutAtMotifs bridges a gap at a patch's edge, and still refuses one elsewhere", () => {
  /* A patch redrawn down to y 500 leaves its line at x 100; the sheet's line resumes at x 300. */
  const above = segment(100, 0, 100, 499);
  const below = segment(300, 502, 300, 800);
  const { line, joints } = chainStrokes([above, below]);
  assert.deepEqual(cutAtMotifs(line, joints, [], { seams: [500] }).faults, []);
  assert.match(
    cutAtMotifs(line, joints, [], { seams: [200] }).faults.join("\n"),
    /gap/,
  );
});

test("--report writes the attempted line even when the import is refused", async (t) => {
  const glyph = { left: 220, right: 280, top: 270, bottom: 330, text: "Flemy" };
  const report = join(tmpdir(), `thread-import-report-${process.pid}.json`);
  t.after(() => rmSync(report, { force: true }));
  const run = await runImport(
    t,
    [STROKE_A, STROKE_B],
    { glyphs: [glyph], sections: SHEET_GEOMETRY.sections.length },
    SHEET_GEOMETRY,
    [`--report=${report}`],
  );
  assert.notEqual(run.code, 0);
  assert.equal(run.connectors, EARLIER_CONNECTORS);
  const written = JSON.parse(readFileSync(report, "utf8"));
  assert.equal(written.connectors.length, 2);
  assert.equal(written.attachments.length, 2);
});

test("detourOffType takes a line that runs through a label round its nearer end, clear of the floor", () => {
  /* A two-line label the line cuts straight through, too wide to push a vertex out of. */
  const label = [
    { left: 300, right: 420, top: 300, bottom: 320, text: "Sebastian" },
    { left: 320, right: 400, top: 324, bottom: 344, text: "Groom" },
  ];
  const line = segment(330, 200, 360, 460, 80);
  const out = detourOffType(line, label, 8);
  assert.deepEqual(out[0], line[0]);
  assert.deepEqual(out[out.length - 1], line[line.length - 1]);
  const dense = segment(0, 0, 0, 0, 1).slice(0, 0);
  for (let i = 1; i < out.length; i += 1)
    dense.push(...segment(out[i - 1].x, out[i - 1].y, out[i].x, out[i].y, 20));
  const nearest = Math.min(
    ...dense.map((p) =>
      Math.min(
        ...label.map((g) =>
          Math.hypot(
            Math.max(g.left - p.x, 0, p.x - g.right),
            Math.max(g.top - p.y, 0, p.y - g.bottom),
          ),
        ),
      ),
    ),
  );
  assert.ok(
    nearest >= 7.9,
    `the detour passes ${nearest.toFixed(1)}px from the label`,
  );
  /* Round the left end (x 300), which the line crosses nearer than the right (x 420). */
  assert.ok(
    Math.min(...out.map((p) => p.x)) < 300 &&
      Math.max(...out.map((p) => p.x)) < 420,
  );
});

test("detourOffType leaves a line already clear of type untouched", () => {
  const label = [{ left: 300, right: 420, top: 300, bottom: 320 }];
  const line = segment(100, 200, 100, 460, 40);
  assert.deepEqual(detourOffType(line, label, 8), line);
});

/** Distance from a point to a glyph rect. @param {{ x: number, y: number }} p @param {{ left: number, right: number, top: number, bottom: number }} g */
const relaxProbe = (p, g) =>
  Math.hypot(
    Math.max(g.left - p.x, 0, p.x - g.right),
    Math.max(g.top - p.y, 0, p.y - g.bottom),
  );

test("detourOffType passes over a run it cannot fix and reroutes the next", () => {
  /* The line starts pinned 3px under one label, then runs through a second further down. */
  const label = [
    { left: 80, right: 200, top: 180, bottom: 197, text: "Brother-in-law" },
    { left: 300, right: 420, top: 300, bottom: 320, text: "Sebastian" },
  ];
  const line = [
    ...segment(150, 200, 330, 250, 20),
    ...segment(330, 251, 360, 460, 60),
  ];
  const out = detourOffType(line, label, 8);
  const on = out.some((p) => relaxProbe(p, label[1]) === 0);
  assert.ok(!on, "the run through the second label was left");
});
