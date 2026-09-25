import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync("components/icons/sprig.tsx", "utf8");

test("sprig carries the traced viewBox, not a re-fitted one", () => {
  assert.match(source, /viewBox="0 0 174\.6 169\.8"/);
});

test("sprig is one path — the trace is a single contour set", () => {
  assert.equal(source.match(/<path/g)?.length, 1);
});

test("sprig hardcodes no colour", () => {
  assert.doesNotMatch(source, /#[0-9a-fA-F]{3,8}/);
  assert.doesNotMatch(source, /fill="(?!currentColor)/);
});

test("sprig goes through IconBase rather than its own svg", () => {
  assert.match(source, /<IconBase/);
  assert.doesNotMatch(source, /<svg/);
});
