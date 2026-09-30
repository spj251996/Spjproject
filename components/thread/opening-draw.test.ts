import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync("components/thread/page-thread.tsx", "utf8");
const moduleCss = readFileSync("components/thread/thread.module.css", "utf8");
const tokens = readFileSync("app/styles/tokens.css", "utf8");

function constant(name: string) {
  const match = source.match(new RegExp(`const ${name} = ([0-9.]+);`));
  assert.ok(match, `${name} not found`);
  return Number(match[1]);
}

function tokenMs(name: string) {
  const match = tokens.match(new RegExp(`--${name}:\\s*(\\d+)ms`));
  assert.ok(match, `--${name} not found`);
  return Number(match[1]);
}

// The draw must start exactly as the fade ends, or the sequence's last beat is a fade over an empty
// stroke (draw late) or a line drawing before it is visible (draw early).
test("the timed draw begins as the thread's fade completes", () => {
  const delay = moduleCss.match(
    /animation:\s*pageThreadFadeIn[^;]*?calc\(var\(--duration-fast\) \* (\d+) \+ var\(--duration-base\) \* (\d+)\)/,
  );
  assert.ok(delay, "fade delay expression not found");
  const fadeStart =
    Number(delay[1]) * tokenMs("duration-fast") +
    Number(delay[2]) * tokenMs("duration-base");
  assert.equal(
    constant("OPENING_DRAW_DELAY"),
    fadeStart + tokenMs("duration-base"),
  );
});

test("the fade begins as the type lands, not a beat after it", () => {
  const typeEnd =
    3 * tokenMs("duration-fast") +
    2 * tokenMs("duration-base") +
    tokenMs("duration-base");
  const fadeStart = 3 * tokenMs("duration-fast") + 3 * tokenMs("duration-base");
  assert.equal(fadeStart, typeEnd);
});

test("the opening draw runs 1200ms and holds back a quarter of the last connector", () => {
  assert.equal(constant("OPENING_DRAW_DURATION"), 1200);
  assert.equal(constant("CROSSING_HOLD_BACK"), 0.25);
});
