import assert from "node:assert/strict";
import { test } from "node:test";
import { MOTIFS } from "./thread-motifs.ts";

/* The routing laws this file used to carry — the handoff between two sections, the page order, and
   which ends are free — moved to `thread-grid.test.ts` with the routing itself. What is left is the
   drawings, which this file has always owned. */

/* ---------- the drawings themselves ---------- */

/* A minimal `getPointAtLength`: a motif's `d` is one `M` and a run of absolute `C`s (asserted
   below), so flattening the cubics into a cumulative-length polyline gives the same answer the
   browser's own method would, without needing a DOM. */
function flatten(d: string) {
  const tokens = d.match(/[A-Za-z]|-?\d*\.?\d+/g) ?? [];
  const points: { x: number; y: number }[] = [];
  const commands: string[] = [];
  let cursor = { x: 0, y: 0 };
  let i = 0;
  while (i < tokens.length) {
    const op = tokens[i];
    commands.push(op);
    if (op === "M") {
      cursor = { x: Number(tokens[i + 1]), y: Number(tokens[i + 2]) };
      points.push(cursor);
      i += 3;
      continue;
    }
    if (op !== "C") throw new Error(`unsupported command ${op}`);
    const n = tokens.slice(i + 1, i + 7).map(Number);
    const p0 = cursor;
    const p1 = { x: n[0], y: n[1] };
    const p2 = { x: n[2], y: n[3] };
    const p3 = { x: n[4], y: n[5] };
    for (let k = 1; k <= 120; k += 1) {
      const t = k / 120;
      const u = 1 - t;
      points.push({
        x:
          u ** 3 * p0.x +
          3 * u * u * t * p1.x +
          3 * u * t * t * p2.x +
          t ** 3 * p3.x,
        y:
          u ** 3 * p0.y +
          3 * u * u * t * p1.y +
          3 * u * t * t * p2.y +
          t ** 3 * p3.y,
      });
    }
    cursor = p3;
    i += 7;
  }
  const cumulative = [0];
  for (let k = 1; k < points.length; k += 1) {
    cumulative.push(
      cumulative[k - 1] +
        Math.hypot(
          points[k].x - points[k - 1].x,
          points[k].y - points[k - 1].y,
        ),
    );
  }
  return {
    points,
    cumulative,
    commands,
    length: cumulative[cumulative.length - 1],
  };
}

function pointAtLength(flat: ReturnType<typeof flatten>, target: number) {
  const { points, cumulative } = flat;
  let i = 1;
  while (i < cumulative.length - 1 && cumulative[i] < target) i += 1;
  const span = cumulative[i] - cumulative[i - 1] || 1;
  const f = (target - cumulative[i - 1]) / span;
  return {
    x: points[i - 1].x + f * (points[i].x - points[i - 1].x),
    y: points[i - 1].y + f * (points[i].y - points[i - 1].y),
  };
}

/* The direction of travel is sampled over a FIXED arc length from each terminal — 1 unit of the
   motif's own 100-unit square. A fraction-of-total-length window would sample a long path further
   from its terminal than a short one, which is not the quantity a connector meets. */
const PROBE_ARC = 1;

/* 5 degrees. The failure this guards is a DECLARED tangent the drawing does not actually leave on,
   which a connector then meets at a visible kink; a misdeclaration of that kind is tens of degrees
   out. Within a few degrees the lateral offset over the first unit of travel is a fraction of the
   stroke's own width at every band, so the seam cannot read. */
const TANGENT_TOLERANCE_DEG = 5;

function angleError(got: number, want: number) {
  let error = got - want;
  while (error > 180) error -= 360;
  while (error < -180) error += 360;
  return Math.abs(error);
}

test("every motif is one continuous open stroke: a single moveto, then curves", () => {
  for (const motif of Object.values(MOTIFS)) {
    const flat = flatten(motif.d);
    assert.equal(
      flat.commands.filter((c) => c === "M").length,
      1,
      `${motif.id} lifts the pen`,
    );
    assert.equal(
      flat.commands[0],
      "M",
      `${motif.id} does not open with a moveto`,
    );
    assert.ok(
      flat.commands.slice(1).every((c) => c === "C"),
      `${motif.id} uses a command other than C`,
    );
  }
});

test("every motif starts at its declared entry point and ends at its declared exit", () => {
  for (const motif of Object.values(MOTIFS)) {
    const { points } = flatten(motif.d);
    const first = points[0];
    const last = points[points.length - 1];
    assert.ok(
      Math.hypot(first.x - motif.entry.x * 100, first.y - motif.entry.y * 100) <
        0.01,
      `${motif.id} starts at (${first.x}, ${first.y}), not its declared entry`,
    );
    assert.ok(
      Math.hypot(last.x - motif.exit.x * 100, last.y - motif.exit.y * 100) <
        0.01,
      `${motif.id} ends at (${last.x}, ${last.y}), not its declared exit`,
    );
  }
});

test("every motif's DRAWN tangent equals its DECLARED tangent at both terminals", () => {
  for (const motif of Object.values(MOTIFS)) {
    const flat = flatten(motif.d);
    const afterEntry = pointAtLength(flat, PROBE_ARC);
    const beforeExit = pointAtLength(flat, flat.length - PROBE_ARC);
    const entryDeg =
      (Math.atan2(
        afterEntry.y - motif.entry.y * 100,
        afterEntry.x - motif.entry.x * 100,
      ) *
        180) /
      Math.PI;
    const exitDeg =
      (Math.atan2(
        motif.exit.y * 100 - beforeExit.y,
        motif.exit.x * 100 - beforeExit.x,
      ) *
        180) /
      Math.PI;
    assert.ok(
      angleError(entryDeg, motif.entry.angle) <= TANGENT_TOLERANCE_DEG,
      `${motif.id} is drawn entering at ${entryDeg.toFixed(2)} but declares ${motif.entry.angle}`,
    );
    assert.ok(
      angleError(exitDeg, motif.exit.angle) <= TANGENT_TOLERANCE_DEG,
      `${motif.id} is drawn leaving at ${exitDeg.toFixed(2)} but declares ${motif.exit.angle}`,
    );
  }
});

/* The recorded aspect is what the composition sizes the motif's square against, so a value that
   disagrees with the drawing silently distorts nothing and mis-sizes everything. */
test("every motif's recorded aspect is its drawn ink's width:height ratio", () => {
  for (const motif of Object.values(MOTIFS)) {
    const { points } = flatten(motif.d);
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const drawn =
      (Math.max(...xs) - Math.min(...xs)) / (Math.max(...ys) - Math.min(...ys));
    assert.ok(
      Math.abs(drawn - motif.aspect) / motif.aspect <= 0.02,
      `${motif.id} draws ${drawn.toFixed(3)} but records ${motif.aspect}`,
    );
  }
});
