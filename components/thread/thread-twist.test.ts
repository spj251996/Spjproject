import assert from "node:assert/strict";
import test from "node:test";
import { samplePath } from "./thread-samples.ts";
import {
  chunkShown,
  GAP_FLOOR,
  gapWidth,
  ROPE,
  ropeGaps,
} from "./thread-twist.ts";

const LENGTH = 200;
const straight = samplePath("M 0 0 C 66.67 0 133.33 0 200 0", LENGTH);
const HALF = 1.1;
const gapCentres = (d: string) =>
  [
    ...d.matchAll(
      /M(-?[\d.]+) (-?[\d.]+)Q(-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+)/g,
    ),
  ].map((match) => (Number(match[1]) + Number(match[5])) / 2);

/* Measured off a long-lay rope and rounded on a render (DESIGN.md -> Thread -> The twist): pinned so a
   stray edit cannot change the cord's lay unseen. */
test("the rope is the long lay with rounder strands", () => {
  assert.deepEqual(ROPE, {
    pitch: 1.94,
    gap: 0.2,
    slant: 28,
    bow: 0.4,
    lighter: 0.18,
  });
  assert.equal(GAP_FLOOR, 0.6);
});

/* A gap sits on the whole-pixel sample at or before its pitch point, so neighbours are a pitch apart
   to within a pixel. */
test("one gap per pitch, none within one cord width of either end", () => {
  const centres = gapCentres(ropeGaps(straight, 0, LENGTH, LENGTH, HALF));
  const pitch = ROPE.pitch * HALF * 2;
  assert.ok(centres.length > 0);
  assert.ok(
    centres.every((x) => x >= HALF * 2 - 1e-6 && x <= LENGTH - HALF * 2 + 1e-6),
  );
  for (let i = 1; i < centres.length; i += 1) {
    assert.ok(
      Math.abs(centres[i] - centres[i - 1] - pitch) <= 1,
      `gap ${i} off the pitch`,
    );
  }
});

test("chunked ranges together hold exactly the whole piece's gaps, each once", () => {
  const whole = gapCentres(ropeGaps(straight, 0, LENGTH, LENGTH, HALF));
  const chunked = [
    0, 12, 24, 36, 48, 60, 72, 84, 96, 108, 120, 132, 144, 156, 168, 180, 192,
  ].flatMap((from) =>
    gapCentres(
      ropeGaps(straight, from, Math.min(LENGTH, from + 12), LENGTH, HALF),
    ),
  );
  assert.deepEqual(chunked, whole);
});

test("a gap is held at least the floor wide, and wider on a wider cord", () => {
  assert.equal(gapWidth(0.1), GAP_FLOOR);
  assert.ok(gapWidth(5) > gapWidth(1.1));
});

/* The ratchet hands the painter a growing length, but the predicate must not hide a chunk again if a
   smaller length ever reaches it: a gap shows once the ink has passed its chunk and stays shown. */
test("a chunk shows only once the ink has reached its end", () => {
  assert.equal(chunkShown(24, 23.5), false);
  assert.equal(chunkShown(24, 24), true);
  assert.equal(chunkShown(24, 400), true);
});
