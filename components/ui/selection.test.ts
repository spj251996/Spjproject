import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/* `app/` is outside this project's test glob (`content/*.test.ts`, `components/**`, `scripts/**`),
   so a test for a global stylesheet lives here and reads it by path -- the same thing
   `contact-actions.test.ts` does for `app/page.tsx`. */
const globals = readFileSync("app/globals.css", "utf8");

/* Bounded by the rule's own braces rather than by the next newline: the properties are what matter
   and they are spread over several lines. */
function ruleBody(selector: string) {
  const from = globals.indexOf(selector);
  assert.notStrictEqual(from, -1, `no \`${selector}\` rule found`);
  const open = globals.indexOf("{", from);
  const close = globals.indexOf("}", open);
  assert.notStrictEqual(close, -1, `\`${selector}\` has an unclosed rule`);
  return globals.slice(open + 1, close);
}

/* The selector list sits between the previous rule's `}` and this rule's `{`. Comments are STRIPPED
   from that span: each rule here is preceded by a comment explaining it, and those comments name the
   very things the assertions look for -- the `wa.me` exemption comment says "wa.me", so an unstripped
   slice reports WhatsApp as exempted when the selector list plainly does not include it. */
function selectorListFor(selector: string) {
  const at = globals.indexOf(selector);
  assert.notStrictEqual(at, -1, `no \`${selector}\` rule found`);
  return globals
    .slice(globals.lastIndexOf("}", at) + 1, globals.indexOf("{", at))
    .replace(/\/\*[\s\S]*?\*\//g, "");
}

test("the document makes content selectable", () => {
  const html = ruleBody("html {");
  assert.match(html, /(^|[^-])user-select:\s*text/);
  assert.match(html, /-webkit-user-select:\s*text/);
  /* The whole defect was this property sitting here. On `html` it reaches every name, date and
     address on the page; the suppression belongs on the chrome selectors below. */
  assert.doesNotMatch(html, /user-select:\s*none/);
  assert.doesNotMatch(html, /-webkit-touch-callout/);
});

/* Each property is asserted by name. A suppression rule that still exists but has quietly lost the
   callout reads identical to a complete one, and the callout is the half the portraits depend on. */
test("selection and the long-press callout stay suppressed on chrome", () => {
  const chrome = ruleBody("[aria-hidden=");
  for (const property of [
    /(^|[^-])user-select:\s*none/,
    /-webkit-user-select:\s*none/,
    /-webkit-touch-callout:\s*none/,
  ]) {
    assert.match(chrome, property);
  }
});

/* The Call action is exempt so the number can be copied from the platform's own sheet, and WhatsApp
   is NOT, because its `wa.me` href would offer "Copy Link" and put the number inside a copied URL
   (owner, 2026-10-03: "only for phone buttons"). Both halves are asserted: an exemption that
   widened to every action would pass a test that only checked the exemption exists. */
test("the Call action is exempt from the callout, and only the Call action", () => {
  const exemption = ruleBody('a[href^="tel:"]');
  assert.match(exemption, /-webkit-touch-callout:\s*default/);
  /* Selection stays suppressed on the label -- the sheet is the affordance, not a text selection. */
  assert.doesNotMatch(exemption, /user-select:\s*(text|auto|all)/);
  assert.doesNotMatch(
    selectorListFor('a[href^="tel:"]'),
    /wa\.me|href\^="https/,
    "WhatsApp must not be exempted -- its sheet would offer Copy Link",
  );
});

/* `[aria-hidden="true"]` is the member the family portraits' hit-test overlay relies on: the overlay
   IS an aria-hidden span, so this selector is what keeps the iOS long-press sheet closed on a photo
   (DESIGN.md -> Interaction States -> Image saving). `img` is kept for the Phase 8 gallery tiles,
   which are not written yet and would otherwise ship with no suppression at all. */
test("the suppression list names every surface that depends on it", () => {
  const selectorList = selectorListFor("[aria-hidden=");
  for (const selector of [
    "svg",
    '[aria-hidden="true"]',
    "img",
    ".type-action",
  ]) {
    assert.ok(
      selectorList.includes(selector),
      `\`${selector}\` must stay in the suppression list -- ${selectorList.trim()}`,
    );
  }
});
