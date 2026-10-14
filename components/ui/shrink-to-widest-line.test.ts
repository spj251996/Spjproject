import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const leaf = readFileSync("components/ui/shrink-to-widest-line.tsx", "utf8");
const section = readFileSync("app/_sections/event-info.tsx", "utf8");
const fit = readFileSync("scripts/measure-section-fit.mjs", "utf8");

test("it waits for the fonts before measuring a line", () => {
  assert.match(leaf, /document\.fonts\.ready/);
});

test("it clears its own width before it measures, so it never measures its own result", () => {
  const clear = leaf.indexOf('removeProperty("max-width")');
  const measure = leaf.indexOf("getClientRects");
  assert.ok(clear !== -1 && measure !== -1 && clear < measure);
});

test("it narrows only a venue that wrapped, with 1px of headroom", () => {
  assert.match(leaf, /lines > 1/);
  assert.match(leaf, /Math\.ceil\((?:line\.)?width\) \+ 1/);
});

test("every Event Info venue goes through it", () => {
  assert.match(
    section,
    /<ShrinkToWidestLine[\s\S]*?<VenueName venue=\{segment\.venue\} \/>/,
  );
});

test("measure:fit strips it from the clones it sweeps", () => {
  assert.match(
    fit,
    /\[data-shrink-to-line\][\s\S]*?removeProperty\("max-width"\)/,
  );
});
