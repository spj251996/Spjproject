import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync("app/celebrations.module.css", "utf8");

test("celebrations has no spine", () => {
  // The retired spine's own selector — narrower than banning every `::before`, which would also
  // forbid a future, unrelated pseudo-element this file has every right to use.
  assert.doesNotMatch(css, /\.row:not\(:last-child\)::before/);
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
    "--celebrations-row-gap",
  ]) {
    assert.doesNotMatch(page, new RegExp(name.replace(/-/g, "\\-")));
  }
});
