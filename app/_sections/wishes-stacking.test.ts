import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { topLevelRules } from "../../scripts/lib/css-top-level-rules.mjs";

/* The card thread is absolutely positioned, so any non-positioned text paints UNDER it whatever the
   document order. The raise must hold at every width, not only where the drawing sits beside the text,
   so it lives at the top level rather than inside a media block. */
test("Wishes' text is raised above the card thread at every width", () => {
  const css = readFileSync(
    new URL("./wishes.module.css", import.meta.url),
    "utf8",
  );
  const raise = topLevelRules(css).find((rule) =>
    rule.selectors.some((selector) => selector.includes(":not([aria-hidden])")),
  );
  assert.ok(raise, "a top-level text-raise rule exists");
  assert.match(raise.body, /position:\s*relative/);
  assert.match(raise.body, /z-index:\s*1/);
});
