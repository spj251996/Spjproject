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
  assignConnectors,
  extract,
  importDrawing,
  relaxOffType,
  typeClearanceReport,
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

/* A slight sinusoidal wobble, same as the proven scratch self-test — a dead-straight line thins to
 * a perfectly clean 1px skeleton and proves nothing about handling a real, shaky hand-drawn line. */
const wobble = (pts) =>
  pts
    .map(
      ([x, y], i) => `${i === 0 ? "M" : "L"} ${x + Math.sin(i * 2.1) * 3} ${y}`,
    )
    .join(" ");

/** Distance from a point to the recovered POLYLINE, not to its nearest vertex — simplification
 * drops vertices the line still passes through, so a vertex-to-vertex metric would measure the
 * simplification rather than the fit. */
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

    const { assigned, joins, unassigned } = assignConnectors(
      recovered,
      ATTACHMENTS,
      PAGE,
    );
    assert.equal(unassigned, 0, "no stroke left unassigned");
    assert.equal(
      assigned.length,
      2,
      "one connector before the motif, one after",
    );
    assert.ok(assigned[0].stroke, "connector 0 (free -> entry) got a stroke");
    assert.ok(assigned[1].stroke, "connector 1 (exit -> free) got a stroke");

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
    assigned.forEach((a, k) => {
      if (!a.stroke) return;
      const interior = control[k].slice(1, -1);
      for (const p of interior)
        worst = Math.max(worst, toPolyline(p.x, p.y, a.stroke));
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
  /* One real section ("invite", floor 8px) big enough to hold the whole stroke; the other five are
   * degenerate placeholders — `relaxOffType` and `typeClearanceReport` both index sections by
   * position against the fixed six-section order, so a synthetic geometry still needs all six. */
  const geometry = {
    width: 1000,
    sections: [
      { top: 0, height: 1000 },
      { top: 1000, height: 1 },
      { top: 1001, height: 1 },
      { top: 1002, height: 1 },
      { top: 1003, height: 1 },
      { top: 1004, height: 1 },
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
  assert.deepEqual(relaxed[0].points[0], points[0], "the entry end is pinned");
  assert.deepEqual(
    relaxed[0].points.at(-1),
    points.at(-1),
    "the exit end is pinned",
  );

  const after = typeClearanceReport(relaxed, geometry, glyphs);
  assert.equal(
    after[0].crossings,
    0,
    "no sample lands on the glyph after relaxing",
  );
  /* The floor is a TARGET the relax step aims for, not a guarantee: the real `tall`/wishes case
     this ports (see the report) settles at 3.1px against an 8px floor because the bow's own pinned
     attachment point sits that close to a glyph already. The one guarantee this test enforces is
     the one the placement law actually states — no longer an outright crossing. Anything still
     under the floor is the CLI's job to report as a warning, not this function's to hide. */
  assert.ok(
    after[0].min > 0,
    `relaxed clearance ${after[0].min.toFixed(1)}px is genuinely off the glyph, not just at its edge`,
  );
});

/* The CLI end to end, in a temp sheet directory, with the live page read injected so no browser
 * runs. The sheet's six sections match `SECTION_ORDER`; only the first holds the drawing. */
const SHEET_GEOMETRY = {
  width: PAGE.width,
  sections: [
    { top: 0, height: 895 },
    { top: 895, height: 1 },
    { top: 896, height: 1 },
    { top: 897, height: 1 },
    { top: 898, height: 1 },
    { top: 899, height: 1 },
  ],
};
const EARLIER_CONNECTORS = '[{"connector":0,"points":[{"x":1,"y":2}]}]\n';
const EARLIER_JOINS = '[{"connector":0,"end":"to"}]\n';

async function runImport(t, drawn, page, geometry = SHEET_GEOMETRY) {
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

  const errors = [];
  t.mock.method(console, "log", () => {});
  t.mock.method(console, "error", (line) => errors.push(String(line)));
  let reads = 0;
  const code = await importDrawing(["tall", drawing, `--dir=${dir}`], {
    readPage: async () => {
      reads += 1;
      return page;
    },
  });
  return {
    code,
    reads,
    errors: errors.join("\n"),
    connectors: readFileSync(join(dir, "connectors.json"), "utf8"),
    joins: readFileSync(join(dir, "joins.json"), "utf8"),
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
  assert.ok(written.every((c) => Array.isArray(c.points)));
  assert.notEqual(run.joins, EARLIER_JOINS);
});

test("a drawing missing a stroke is refused before the page is read, and writes nothing", async (t) => {
  const run = await runImport(t, [STROKE_A], {
    glyphs: [],
    sections: SHEET_GEOMETRY.sections.length,
  });
  assert.notEqual(run.code, 0);
  assert.match(run.errors, /REFUSED.*NO STROKE/s);
  assert.equal(run.reads, 0, "refused before reading the live page");
  assert.equal(run.connectors, EARLIER_CONNECTORS);
  assert.equal(run.joins, EARLIER_JOINS);
});

test("a drawing with a stroke no connector takes is refused, and writes nothing", async (t) => {
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
  assert.match(run.errors, /REFUSED: 1 drawn stroke\(s\) left unassigned/);
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
  assert.match(run.errors, /REFUSED: .* the live page has 5\./);
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
  assert.match(run.errors, /REFUSED: .* SECTION_ORDER names 6\./);
  assert.equal(run.reads, 0, "refused before reading the live page");
  assert.equal(run.connectors, EARLIER_CONNECTORS);
  assert.equal(run.joins, EARLIER_JOINS);
});
