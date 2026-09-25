import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const icon = readFileSync("components/icons/sprig.tsx", "utf8");
const symbol = readFileSync("components/icons/sprig-symbol.tsx", "utf8");
const reference = readFileSync(
  "/home/ag-95/.claude/plans/leaf-mark-sprig-path.txt",
  "utf8",
).trim();

test("the traced path lives in exactly one file", () => {
  assert.equal(icon.includes(reference), false);
  assert.equal(symbol.includes(reference), true);
});

test("the symbol carries the traced viewBox, not a re-fitted one", () => {
  assert.match(symbol, /viewBox="0 0 174\.6 169\.8"/);
});

test("the symbol is one path — the trace is a single contour set", () => {
  assert.equal(symbol.match(/<path/g)?.length, 1);
});

test("the icon references the symbol rather than drawing it", () => {
  assert.match(icon, /<use href="#sprig-mark"/);
  assert.equal(icon.match(/<path/g), null);
});

test("neither file hardcodes a colour", () => {
  for (const source of [icon, symbol]) {
    assert.doesNotMatch(source, /#[0-9a-fA-F]{3,8}/);
  }
});

test("the icon goes through IconBase and sets no nudge", () => {
  assert.match(icon, /<IconBase/);
  assert.doesNotMatch(icon, /nudge/);
});
