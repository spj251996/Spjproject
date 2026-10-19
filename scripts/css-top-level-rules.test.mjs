import assert from "node:assert/strict";
import { test } from "node:test";
import { splitAtRuleBlocks, topLevelRules } from "./css-top-level-rules.mjs";

const rule = (
  /** @type {string[]} */ selectors,
  /** @type {string} */ body,
) => ({
  selectors,
  body,
});

test("comments, statement at-rules, string braces and at-rule blocks leave only the real rules", () => {
  const css = `@charset "utf-8";
@layer a,b;
/* a { x: y } */
.keep{justify-content:center;align-items:center}
@import url("x{y}.css");
.str{content:"}{";justify-content:center}
@media (x){.inner{a:b}}
.after , .also{k:v}`;
  assert.deepEqual(topLevelRules(css), [
    rule([".keep"], "justify-content:center;align-items:center"),
    rule([".str"], 'content:"}{";justify-content:center'),
    rule([".after", ".also"], "k:v"),
  ]);
});

test("a backslash outside a string escapes the next character", () => {
  assert.deepEqual(topLevelRules('.a\\{b{k:v}.c\\"d{x:y}'), [
    rule([".a\\{b"], "k:v"),
    rule(['.c\\"d'], "x:y"),
  ]);
});

test("an unquoted url() is opaque", () => {
  assert.deepEqual(
    topLevelRules(".a{background:url(data:image/svg+xml,{'}\")}.b{k:v}"),
    [
      rule([".a"], "background:url(data:image/svg+xml,{'}\")"),
      rule([".b"], "k:v"),
    ],
  );
});

test("an escaped quote does not end a string", () => {
  assert.deepEqual(topLevelRules('.a{content:"x\\"}{"}.b{k:v}'), [
    rule([".a"], 'content:"x\\"}{"'),
    rule([".b"], "k:v"),
  ]);
});

test("an @media nested in an @supports is skipped whole, and the next rule still parses", () => {
  assert.deepEqual(
    topLevelRules("@supports (a:b){@media (x){.in{a:b}}.in2{c:d}}.out{e:f}"),
    [rule([".out"], "e:f")],
  );
});

test("a minified frame chunk yields its scope rule, sheet rule and @supports block as the gate reads them", () => {
  const chunk =
    ".mounted-sheet-frame--wishes{display:flex;justify-content:center;align-items:center}" +
    ".mounted-sheet-frame--wishes>.mounted-sheet-frame__box>.mounted-sheet-frame__mount>.mounted-sheet-frame__sheet{flex-direction:column;flex:1 0 auto;justify-content:center;align-items:center;display:flex}" +
    "@supports (justify-content:safe center){.mounted-sheet-frame--wishes,.mounted-sheet-frame--wishes>.mounted-sheet-frame__box>.mounted-sheet-frame__mount>.mounted-sheet-frame__sheet{justify-content:safe center;align-items:safe center}}";
  const sheet =
    ".mounted-sheet-frame--wishes>.mounted-sheet-frame__box>.mounted-sheet-frame__mount>.mounted-sheet-frame__sheet";
  assert.deepEqual(topLevelRules(chunk), [
    rule(
      [".mounted-sheet-frame--wishes"],
      "display:flex;justify-content:center;align-items:center",
    ),
    rule(
      [sheet],
      "flex-direction:column;flex:1 0 auto;justify-content:center;align-items:center;display:flex",
    ),
  ]);
  const block = chunk.slice(chunk.indexOf("@supports"));
  const inner = block.slice(block.indexOf("{") + 1, -1);
  assert.deepEqual(topLevelRules(inner), [
    rule(
      [".mounted-sheet-frame--wishes", sheet],
      "justify-content:safe center;align-items:safe center",
    ),
  ]);
});

test("splitAtRuleBlocks separates the matching blocks from the rest", () => {
  const css = ".a{k:v}@supports (x:y){.b{k:v}}.c{k:v}@media (m){.d{k:v}}";
  assert.deepEqual(splitAtRuleBlocks(css, /^@supports/), {
    outside: ".a{k:v}.c{k:v}@media (m){.d{k:v}}",
    blocks: ["@supports (x:y){.b{k:v}}"],
  });
});

test("splitAtRuleBlocks ignores a brace in a string and a comment inside the block", () => {
  const css =
    '.a{k:v}@supports (x:y){.b{content:"}";k:v}/* } */.e{k:v}}.c{k:v}';
  assert.deepEqual(splitAtRuleBlocks(css, /^@supports/), {
    outside: ".a{k:v}.c{k:v}",
    blocks: ['@supports (x:y){.b{content:"}";k:v}/* } */.e{k:v}}'],
  });
});

test("splitAtRuleBlocks leaves the text untouched when nothing matches", () => {
  const css = ".a{k:v}@media (m){.d{k:v}}";
  assert.deepEqual(splitAtRuleBlocks(css, /^@supports/), {
    outside: css,
    blocks: [],
  });
});
