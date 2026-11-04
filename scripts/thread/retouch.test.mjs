import assert from "node:assert/strict";
import test from "node:test";
import { checkEdits, editsFor, retouchPiece } from "./retouch.mjs";

const SECTIONS = ["invite", "event-info", "family", "celebrations", "wishes"];

/** A straight run along y = 0, a vertex every `step` px. */
const straight = (/** @type {number} */ length, step = 20) =>
  Array.from({ length: length / step + 1 }, (_, k) => ({ x: k * step, y: 0 }));

/** The largest turn between consecutive spans, in degrees. */
const maxTurn = (/** @type {{ x: number, y: number }[]} */ points) => {
  let worst = 0;
  for (let i = 1; i < points.length - 1; i += 1) {
    const a = Math.atan2(
      points[i].y - points[i - 1].y,
      points[i].x - points[i - 1].x,
    );
    const b = Math.atan2(
      points[i + 1].y - points[i].y,
      points[i + 1].x - points[i].x,
    );
    const turn = Math.abs(Math.atan2(Math.sin(b - a), Math.cos(b - a)));
    worst = Math.max(worst, (turn * 180) / Math.PI);
  }
  return worst;
};

test("no edits leave the piece as drawn", () => {
  const line = straight(400);
  assert.deepEqual(retouchPiece(line, []), line);
});

test("a nudge moves the point it names by exactly its offset", () => {
  const out = retouchPiece(straight(400), [
    { at: 0.5, dx: 3, dy: -8, reach: 40 },
  ]);
  const moved = out.find((p) => Math.abs(p.x - 203) < 1e-6);
  assert.ok(moved, "a vertex sits at the nudged point");
  assert.ok(Math.abs(moved.y + 8) < 1e-6);
});

test("nothing past the nudge's reach moves", () => {
  const line = straight(400);
  const out = retouchPiece(line, [{ at: 0.5, dx: 0, dy: 10, reach: 40 }]);
  for (const p of line)
    if (Math.abs(p.x - 200) >= 40)
      assert.ok(
        out.some((q) => q.x === p.x && q.y === p.y),
        `vertex at x ${p.x} kept`,
      );
  assert.ok(out.every((q) => Math.abs(q.x - 200) < 40 || q.y === 0));
});

test("a piece's two ends never move, even for a nudge right beside one", () => {
  const line = straight(400);
  for (const at of [0, 0.02, 0.98, 1]) {
    const out = retouchPiece(line, [{ at, dx: 12, dy: 12, reach: 60 }]);
    assert.deepEqual(out[0], line[0], `start held at ${at}`);
    assert.deepEqual(out.at(-1), line.at(-1), `end held at ${at}`);
  }
});

test("a later pass of the line close by in space but far along it stays put", () => {
  /* Out along y = 0, down, and back along y = 10: the return pass runs 10px from the nudged
     point, well inside its 40px reach, but some 400px further along the line. */
  const out_ = straight(400).map((p) => ({ x: p.x, y: 0 }));
  const back = straight(400)
    .reverse()
    .map((p) => ({ x: p.x, y: 10 }));
  const line = [...out_, ...back];
  const at = 200 / 810;
  const result = retouchPiece(line, [{ at, dx: 0, dy: -6, reach: 40 }]);
  for (const p of back)
    assert.ok(
      result.some((q) => q.x === p.x && q.y === p.y),
      `return pass vertex at x ${p.x} kept`,
    );
});

test("smoothing calms a zig-zag inside its reach and leaves the rest as drawn", () => {
  const line = Array.from({ length: 41 }, (_, k) => ({
    x: k * 10,
    y: k % 2 === 0 ? 0 : 8,
  }));
  const out = retouchPiece(line, [{ at: 0.5, reach: 60, smooth: true }]);
  const inside = (/** @type {{ x: number }} */ p) => Math.abs(p.x - 200) < 15;
  assert.ok(maxTurn(out.filter(inside)) < maxTurn(line.filter(inside)) / 2);
  for (const p of line)
    if (Math.abs(p.x - 200) >= 60)
      assert.ok(out.some((q) => q.x === p.x && q.y === p.y));
});

test("two nudges at the same place add up", () => {
  const out = retouchPiece(straight(400), [
    { at: 0.5, dx: 0, dy: 4, reach: 40 },
    { at: 0.5, dx: 0, dy: 6, reach: 40 },
  ]);
  const anchor = out.find((p) => Math.abs(p.x - 200) < 1e-6);
  assert.ok(anchor && Math.abs(anchor.y - 10) < 1e-6);
});

test("editsFor picks one piece's edits, in file order", () => {
  const edits = [
    { section: "invite", piece: 1, at: 0.2, dx: 1, dy: 0, reach: 40 },
    { section: "family", piece: 1, at: 0.4, dx: 2, dy: 0, reach: 40 },
    { section: "invite", piece: 1, at: 0.6, dx: 3, dy: 0, reach: 40 },
  ];
  assert.deepEqual(
    editsFor(edits, "invite", 1).map((e) => e.dx),
    [1, 3],
  );
  assert.deepEqual(editsFor(edits, "invite", 0), []);
});

test("checkEdits refuses an edit it cannot place, naming the band and the edit", () => {
  const good = {
    section: "invite",
    piece: 0,
    at: 0.5,
    dx: 1,
    dy: 1,
    reach: 40,
  };
  assert.doesNotThrow(() => checkEdits("wide", [good], SECTIONS));
  assert.doesNotThrow(() =>
    checkEdits(
      "wide",
      [{ section: "wishes", piece: 2, at: 0, reach: 30, smooth: true }],
      SECTIONS,
    ),
  );
  for (const bad of [
    { ...good, section: "contact" },
    { ...good, piece: -1 },
    { ...good, piece: 1.5 },
    { ...good, at: 1.2 },
    { ...good, reach: 0 },
    { ...good, dx: undefined },
  ])
    assert.throws(
      () => checkEdits("wide", [good, bad], SECTIONS),
      /wide.*edit 1/,
    );
});
