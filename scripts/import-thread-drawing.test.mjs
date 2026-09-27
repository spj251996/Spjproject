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
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import sharp from "sharp";
import { assignConnectors, extract } from "./import-thread-drawing.mjs";

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

test("recovers a hand-drawn thread from a rescaled, re-encoded JPEG", async () => {
  const crosses = CROSSES.flatMap(([x, y]) => [
    `<line x1="${x - ARM}" y1="${y}" x2="${x + ARM}" y2="${y}" stroke="#000" stroke-width="3"/>`,
    `<line x1="${x}" y1="${y - ARM}" x2="${x}" y2="${y + ARM}" stroke="#000" stroke-width="3"/>`,
  ]).join("\n");
  const strokes = [STROKE_A, STROKE_B]
    .map(
      (s) =>
        `<path d="${wobble(s)}" fill="none" stroke="#FF00FF" stroke-width="6" stroke-linecap="round"/>`,
    )
    .join("\n");
  const sheet =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${PAGE.width}" height="${PAGE.height}">` +
    `<rect width="100%" height="100%" fill="#fff"/>${crosses}${strokes}</svg>`;

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
