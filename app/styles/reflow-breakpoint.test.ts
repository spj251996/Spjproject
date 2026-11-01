import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/* BELOW 20rem THE PAGE REFLOWS UNDER BROWSER ZOOM — DESIGN.md → Accessibility Rules. 20rem is the
   unzoomed minimum (320px), so the `max-reflow:` variant can never reach a screen viewed at 100%; a
   larger value would change the normal page. Comments are stripped first, as in `selection.test.ts`. */
const tokens = readFileSync("app/styles/tokens.css", "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  "",
);

test("the reflow variant is below 20rem and adds no breakpoint token", () => {
  assert.match(
    tokens,
    /@custom-variant\s+max-reflow\s+\(\s*@media\s*\(\s*width\s*<\s*20rem\s*\)\s*\)\s*;/,
  );
  assert.doesNotMatch(tokens, /--breakpoint-reflow/);
});
