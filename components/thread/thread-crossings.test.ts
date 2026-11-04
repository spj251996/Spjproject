import assert from "node:assert/strict";
import test from "node:test";
import {
  type Crossing,
  findCrossings,
  orderCrossings,
} from "./thread-crossings.ts";
import type { MotifId, Over } from "./thread-geometry.ts";
import type { ThreadPiece } from "./thread-line.ts";
import { samplePath } from "./thread-samples.ts";

/* A cubic's own arc length, so a sample at arc `s` lands where the curve really is. */
function cubicLength(d: string): number {
  const [x0, y0, x1, y1, x2, y2, x3, y3] = (d.match(/-?\d*\.?\d+/g) ?? []).map(
    Number,
  );
  let length = 0;
  let [px, py] = [x0, y0];
  for (let i = 1; i <= 4000; i += 1) {
    const t = i / 4000;
    const u = 1 - t;
    const x =
      u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3;
    const y =
      u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3;
    length += Math.hypot(x - px, y - py);
    [px, py] = [x, y];
  }
  return length;
}

/* A chain of pieces laid end to end on one cumulative scale, as `threadLine` builds them. */
function chain(pieces: readonly { d: string; kind?: ThreadPiece["kind"] }[]): {
  samples: ReturnType<typeof samplePath>[];
  pieces: ThreadPiece[];
} {
  let start = 0;
  const spans: ThreadPiece[] = [];
  const samples = pieces.map(({ d, kind }) => {
    const length = cubicLength(d);
    spans.push({
      id: "invite",
      kind: kind ?? "connector",
      start,
      end: start + length,
    });
    start += length;
    return samplePath(d, length);
  });
  return { samples, pieces: spans };
}

/* A cubic whose control points cross, so it loops once and crosses itself. */
const LOOP = "M 0 0 C 200 100 -100 100 100 0";
const MIN_GAP = 6 * 2.2;

test("finds the one crossing of an X made of two pieces", () => {
  /* Two diagonals, joined by a connector that turns the line back across the first. */
  const { samples, pieces } = chain([
    { d: "M 0 0 C 33.33 33.33 66.67 66.67 100 100" },
    { d: "M 100 100 C 100 120 0 120 0 100" },
    { d: "M 0 100 C 33.33 66.67 66.67 33.33 100 0" },
  ]);
  const found = findCrossings(samples, pieces, MIN_GAP);
  assert.equal(found.length, 1);
  const [crossing] = found;
  assert.ok(
    Math.abs(crossing.x - 50) <= 0.5 && Math.abs(crossing.y - 50) <= 0.5,
  );
  assert.equal(crossing.first.piece, 0);
  assert.equal(crossing.second.piece, 2);
  assert.ok(Math.abs(crossing.first.at - Math.SQRT2 * 50) <= 0.5);
});

test("finds a loop's self-crossing in one piece, first pass first", () => {
  const { samples, pieces } = chain([{ d: LOOP }]);
  const found = findCrossings(samples, pieces, MIN_GAP);
  assert.equal(found.length, 1);
  const [crossing] = found;
  assert.equal(crossing.first.piece, 0);
  assert.equal(crossing.second.piece, 0);
  assert.ok(crossing.first.at < crossing.second.at);
});

test("ignores a join and a tight bend", () => {
  const joined = chain([
    { d: "M 0 0 C 33.33 0 66.67 0 100 0" },
    { d: "M 100 0 C 100 33.33 100 66.67 100 100" },
  ]);
  assert.deepEqual(findCrossings(joined.samples, joined.pieces, MIN_GAP), []);
  /* The same loop at a twentieth of the size: its crossing passes are closer than `minGap` along the
     line, so it is one bend of the cord, not a crossing. */
  const tiny = chain([{ d: "M 0 0 C 10 5 -5 5 5 0" }]);
  assert.deepEqual(findCrossings(tiny.samples, tiny.pieces, MIN_GAP), []);
});

function crossingIn(piece: number, first: number, second: number): Crossing {
  return {
    x: 0,
    y: 0,
    first: { piece, at: first },
    second: { piece, at: second },
  };
}

const NO_WEAVE = (_: MotifId): readonly Over[] | undefined => undefined;

test("orders a route crossing later-over-earlier", () => {
  const pieces: ThreadPiece[] = [
    { id: "invite", kind: "connector", start: 0, end: 100 },
    { id: "invite", kind: "heart", start: 100, end: 200 },
  ];
  const across: Crossing = {
    x: 0,
    y: 0,
    first: { piece: 0, at: 20 },
    second: { piece: 1, at: 50 },
  };
  const [ordered] = orderCrossings([across], pieces, () => ["first"]);
  assert.equal(ordered.over, "second");
  assert.equal(ordered.woven, false);
  const [inConnector] = orderCrossings(
    [crossingIn(0, 10, 60)],
    pieces,
    NO_WEAVE,
  );
  assert.equal(inConnector.over, "second");
  assert.equal(inConnector.woven, false);
});

test("weaves a motif's crossings from its data in first-pass order", () => {
  const pieces: ThreadPiece[] = [
    { id: "event-info", kind: "connector", start: 0, end: 50 },
    { id: "event-info", kind: "knot", start: 50, end: 450 },
  ];
  const weave: readonly Over[] = ["first", "second", "first"];
  /* Handed out of order: the motif's k-th crossing is k-th by its first pass. */
  const ordered = orderCrossings(
    [crossingIn(1, 200, 380), crossingIn(1, 30, 120), crossingIn(1, 90, 300)],
    pieces,
    (motif) => (motif === "knot" ? weave : undefined),
  );
  const byFirst = [...ordered].sort((a, b) => a.first.at - b.first.at);
  assert.deepEqual(
    byFirst.map((crossing) => crossing.over),
    ["first", "second", "first"],
  );
  assert.ok(ordered.every((crossing) => crossing.woven));
});

test("falls back when a motif's weave does not match its crossings", () => {
  const pieces: ThreadPiece[] = [
    { id: "event-info", kind: "knot", start: 0, end: 400 },
  ];
  const ordered = orderCrossings(
    [crossingIn(0, 30, 120), crossingIn(0, 90, 300), crossingIn(0, 200, 380)],
    pieces,
    () => ["first", "first"],
  );
  assert.ok(ordered.every((crossing) => crossing.over === "second"));
  assert.ok(ordered.every((crossing) => !crossing.woven));
});
