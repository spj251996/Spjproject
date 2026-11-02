import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { BASE_WIDTH, OPTIONS } from "../../scripts/lib/built-tokens.ts";
import type { Rgb } from "./thread-head.ts";
import { RETRACE_LENGTH_RATIO } from "./thread-retrace.ts";
import { retraceFrom, sheenColours } from "./thread-tokens.ts";

const hex = ([r, g, b]: Rgb) =>
  `#${[r, g, b].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;

/* The sheen's colours are computed, not left to the browser's relative-colour support, and they are the
   DESIGN.md registry's: `thread-sheen` and `thread-sheen-mid`. */
test("the sheen lifts the thread's red to the registry's two colours, at the ink's width", () => {
  const sheen = sheenColours(OPTIONS.tailColor, 0.12, BASE_WIDTH);
  assert.equal(hex(sheen.tipColor as Rgb), "#cd4a3f");
  assert.equal(hex(sheen.midColor as Rgb), "#b8352d");
  assert.equal(sheen.tipWidth, BASE_WIDTH);
});

/* The head and the re-trace are one look as a pair: the re-trace differs only in its length. */
test("the re-trace takes every look value from the head and only its own length", () => {
  const head = {
    ...OPTIONS,
    ...sheenColours(OPTIONS.tailColor, 0.2, BASE_WIDTH),
  };
  const retrace = retraceFrom(head, BASE_WIDTH);
  assert.deepEqual({ ...retrace, length: head.length }, head);
  assert.equal(retrace.length, RETRACE_LENGTH_RATIO * BASE_WIDTH);
});

/* The owner finalised the sheen with half glow (2026-11-02), so the head reads only the thread's red and the sheen
   tokens: the earlier orange head's vermilion and hot core are retired from it. Read from the source, because
   the readers need a browser. */
test("the drawing head reads only the thread red and the sheen tokens", () => {
  const source = readFileSync(
    new URL("./thread-tokens.ts", import.meta.url),
    "utf8",
  );
  const shipped =
    /function shippedHead\(\)[\s\S]*?\n}\n/.exec(source)?.[0] ?? "";
  assert.deepEqual(
    [...shipped.matchAll(/"(--[\w-]+)"/g)].map((match) => match[1]).sort(),
    [
      "--color-thread-red",
      "--color-thread-sheen",
      "--color-thread-sheen-mid",
      "--stroke-thread",
    ],
  );
  assert.doesNotMatch(source, /--color-thread-core|--color-thread-vermilion/);
});
