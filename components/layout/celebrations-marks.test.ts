import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync("app/celebrations.module.css", "utf8");

test("celebrations has no spine", () => {
  assert.doesNotMatch(css, /::before/);
  assert.doesNotMatch(css, /--celebrations-spine-x/);
});

test("celebrations has no dot mark", () => {
  assert.doesNotMatch(css, /\.mark\b/);
  assert.doesNotMatch(css, /--celebrations-mark-(size|offset)/);
});

test("the retired custom properties are gone from the page too", () => {
  const page = readFileSync("app/page.tsx", "utf8");
  for (const name of [
    "--celebrations-spine-x",
    "--celebrations-mark-size",
    "--celebrations-mark-offset",
    "--celebrations-row-indent",
  ]) {
    assert.doesNotMatch(page, new RegExp(name.replace(/-/g, "\\-")));
  }
});
