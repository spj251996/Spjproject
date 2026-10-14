import assert from "node:assert/strict";
import test from "node:test";
import { widestLine } from "./widest-line.ts";

test("one line, however many inline boxes it holds, is one line", () => {
  const r = widestLine([
    { top: 10, left: 0, right: 60 },
    { top: 10.4, left: 60, right: 140 },
  ]);
  assert.deepEqual(r, { lines: 1, width: 140 });
});

test("a wrapped venue's width is its widest line, not the box it was offered", () => {
  const r = widestLine([
    { top: 10, left: 0, right: 180 },
    { top: 30, left: 0, right: 120 },
  ]);
  assert.deepEqual(r, { lines: 2, width: 180 });
});

test("empty rects count for nothing", () => {
  assert.deepEqual(widestLine([{ top: 10, left: 5, right: 5 }]), {
    lines: 0,
    width: 0,
  });
});

/* A real `DOMRect` exposes its edges as prototype getters, so a spread of one copies nothing. */
class GetterRect {
  #top: number;
  #left: number;
  #right: number;
  constructor(top: number, left: number, right: number) {
    this.#top = top;
    this.#left = left;
    this.#right = right;
  }
  get top() {
    return this.#top;
  }
  get left() {
    return this.#left;
  }
  get right() {
    return this.#right;
  }
}

test("it reads rects whose edges are getters, as a DOMRect's are", () => {
  const r = widestLine([
    new GetterRect(10, 0, 180),
    new GetterRect(10.5, 180, 200),
    new GetterRect(30, 0, 120),
  ]);
  assert.deepEqual(r, { lines: 2, width: 200 });
});
