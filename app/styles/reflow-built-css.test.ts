import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { freshExport } from "../../scripts/lib/built-export.ts";
import { linkedStylesheets } from "../../scripts/lib/linked-stylesheets.mjs";

/* Nothing at 320px and up may change — DESIGN.md → Accessibility Rules. The built CSS is where a
   reflow utility that lost its variant would show, so every rule is checked against the sheet. */
/* Lightning CSS may rewrite `(width < 20rem)` as `(width<20rem)` or as a `max-width` just under it. */
const AT_RULE =
  /\(\s*width\s*<\s*20rem\s*\)|\(\s*max-width\s*:\s*(19\.99\d*rem|319\.9\d*px)\s*\)|not\s+(all\s+and\s*)?\(\s*min-width\s*:\s*20rem\s*\)/;
/* The leak this guards against: a min-width:20rem step (not negated) reaches every page at 100%. */
const LEAK = (context: string) =>
  /\(\s*min-width\s*:\s*20rem\s*\)/.test(context) && !/\bnot\b/.test(context);

/* Each rule's chain of enclosing at-rule preludes, found by walking braces. */
function rulesWithContext(css: string) {
  const rules: { selector: string; body: string; context: string }[] = [];
  const stack: string[] = [];
  const bodyStarts: number[] = [];
  let start = 0;
  for (let i = 0; i < css.length; i++) {
    if (css[i] === "{") {
      stack.push(css.slice(start, i).trim());
      bodyStarts.push(i + 1);
      start = i + 1;
    } else if (css[i] === "}") {
      const block = css.slice(bodyStarts[bodyStarts.length - 1], i);
      if (!block.includes("{") && block.includes(":") && stack.length) {
        rules.push({
          selector: stack[stack.length - 1],
          body: block,
          context: stack.slice(0, -1).join(" "),
        });
      }
      stack.pop();
      bodyStarts.pop();
      start = i + 1;
    } else if (css[i] === ";") start = i + 1;
  }
  return rules;
}

const REFLOW_SELECTOR = `${"max-" + "reflow"}\\:`;
const ANYWHERE = /overflow-wrap:\s*anywhere/;

/* Every reflow rule found, each with whether it sits below 20rem. */
function reflowRules(css: string) {
  return rulesWithContext(css)
    .filter(
      ({ selector, body }) =>
        selector.includes(REFLOW_SELECTOR) || ANYWHERE.test(body),
    )
    .map((rule) => ({ ...rule, below: AT_RULE.test(rule.context) }));
}

test("the reflow-rule predicate separates a rule inside the media from one outside it", () => {
  const inside = `@media (width<20rem){html{overflow-wrap:anywhere}.${REFLOW_SELECTOR}hidden{display:none}}`;
  const outside = `@media (width<20rem){.x{color:red}}html{overflow-wrap:anywhere}.${REFLOW_SELECTOR}hidden{display:none}`;
  const wider = `@media (width<30rem){html{overflow-wrap:anywhere}}`;
  const rewritten = `@media (max-width:19.9999rem){html{overflow-wrap:anywhere}}`;
  assert.deepEqual(
    reflowRules(inside).map((r) => r.below),
    [true, true],
  );
  assert.deepEqual(
    reflowRules(outside).map((r) => r.below),
    [false, false],
  );
  assert.deepEqual(
    reflowRules(wider).map((r) => r.below),
    [false],
  );
  assert.deepEqual(
    reflowRules(rewritten).map((r) => r.below),
    [true],
  );
  const multi = `@media not all and (min-width:20rem){html{overflow-wrap:anywhere;-webkit-hyphens:auto;hyphens:auto}}`;
  assert.deepEqual(
    reflowRules(multi).map((r) => r.below),
    [true],
  );
  const notAll = `@media not all and (min-width:20rem){html{overflow-wrap:anywhere}}`;
  const notOnly = `@media not (min-width: 20rem){html{overflow-wrap:anywhere}}`;
  const plainMin = `@media (min-width:20rem){html{overflow-wrap:anywhere}}`;
  assert.equal(LEAK("not all and (min-width:20rem)"), false);
  assert.equal(LEAK("not (min-width: 20rem)"), false);
  assert.equal(LEAK("(min-width:20rem)"), true);
  const notWider = `@media not all and (min-width:48rem){html{overflow-wrap:anywhere}}`;
  for (const [css, expected] of [
    [notAll, true],
    [notOnly, true],
    [plainMin, false],
    [notWider, false],
  ] as const)
    assert.deepEqual(
      reflowRules(css).map((r) => r.below),
      [expected],
      css,
    );
});

test("every reflow rule in the built CSS sits below 20rem", (t) => {
  if (!freshExport(t)) return;
  const html = readFileSync("out/index.html", "utf8");
  const css = linkedStylesheets(html, "out")
    .map((sheet) => {
      assert.notEqual(
        sheet.css,
        null,
        `${sheet.href} is missing from the export`,
      );
      return sheet.css;
    })
    .join("\n");
  const reflow = reflowRules(css);
  assert.ok(
    reflow.some(({ body }) => ANYWHERE.test(body)),
    "the globals.css overflow-wrap: anywhere rule is not shipped",
  );
  assert.ok(
    reflow.some(({ selector }) => selector.includes(REFLOW_SELECTOR)),
    "no max-reflow utilities found in the built CSS",
  );
  for (const { selector, below } of reflow)
    assert.ok(below, `${selector} is not inside (width < 20rem)`);
});

test("the built CSS carries no reflow breakpoint variable or min-width:20rem step", (t) => {
  if (!freshExport(t)) return;
  const html = readFileSync("out/index.html", "utf8");
  const css = linkedStylesheets(html, "out")
    .map((sheet) => sheet.css ?? "")
    .join("\n");
  assert.doesNotMatch(css, /--breakpoint-reflow/);
  const leaked = rulesWithContext(css).filter(({ context }) => LEAK(context));
  assert.deepEqual(
    leaked.map((r) => r.selector),
    [],
    "rules sit under a (min-width:20rem) media that reaches a page at 100%",
  );
});
