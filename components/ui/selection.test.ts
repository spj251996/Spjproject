import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/* `app/` is outside this project's test glob (`content/*.test.ts`, `components/**`, `scripts/**`),
   so a test for a global stylesheet lives here and reads it by path -- the same thing
   `contact-actions.test.ts` does for `app/page.tsx`.

   Comments are stripped ONCE, up front, and every helper below works on the stripped text. Each rule
   in that file is preceded by a comment explaining it, and those comments quote the selectors and
   values the assertions search for -- so an unstripped anchor can resolve inside prose and land on
   the right rule only by luck. Review found exactly that: two of three anchors were matching comment
   text. */
const globals = readFileSync("app/globals.css", "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  "",
);

/* The whole `selector { ... }` block, found by the selector's own text. */
function ruleBody(selector: string) {
  const from = globals.indexOf(selector);
  assert.notStrictEqual(from, -1, `no \`${selector}\` rule found`);
  const open = globals.indexOf("{", from);
  const close = globals.indexOf("}", open);
  assert.notStrictEqual(close, -1, `\`${selector}\` has an unclosed rule`);
  return globals.slice(open + 1, close);
}

/* The selector list a rule declares, i.e. everything between the previous `}` and this rule's `{`. */
function selectorListFor(selector: string) {
  const at = globals.indexOf(selector);
  assert.notStrictEqual(at, -1, `no \`${selector}\` rule found`);
  return globals
    .slice(globals.lastIndexOf("}", at) + 1, globals.indexOf("{", at))
    .trim();
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

/* Each property by name. A suppression rule that still exists but has quietly lost the callout reads
   identical to a complete one, and the callout is the half the portraits depend on. */
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

/* `[aria-hidden="true"]` is the member the family portraits' hit-test overlay relies on: the overlay
   IS an aria-hidden span, so this selector is what keeps the iOS long-press sheet closed on a photo
   (DESIGN.md -> Interaction States -> Image saving). `img` is kept for the ritual gallery's tiles,
   not written yet. Matched as whole selectors, not substrings: `includes("svg")` is satisfied by
   `.decorative-svg`, so a narrower lookalike would pass a containment check. */
test("the suppression list names every surface that depends on it", () => {
  const members = selectorListFor("[aria-hidden=")
    .split(",")
    .map((member) => member.trim());
  for (const selector of [
    "svg",
    '[aria-hidden="true"]',
    "img",
    ".type-action",
  ]) {
    assert.ok(
      members.includes(selector),
      `\`${selector}\` must stay in the suppression list -- found [${members.join(" | ")}]`,
    );
  }
});

/* The Call action is exempt so the number can be copied from the platform's own sheet (owner,
   2026-10-03: "only for phone buttons").

   THE EXEMPTION MUST REACH THE WHOLE TARGET, not just the label. The mark is an `aria-hidden` `<svg>`
   on a 44px disc, so the chrome rule above hits it directly and a direct declaration beats an
   inherited one -- an exemption naming only the anchor and `.type-action` leaves `callout: none` over
   the disc, which is the obvious thing to press. Review found this: the feature would have been
   invisible to anyone pressing the icon rather than the word. */
test("the Call exemption covers the whole target, mark included", () => {
  const exemption = ruleBody('a[href^="tel:"]');
  assert.match(exemption, /-webkit-touch-callout:\s*default/);
  /* Selection stays suppressed on the label -- the sheet is the affordance, not a text selection. */
  assert.doesNotMatch(exemption, /user-select:\s*(text|auto|all)/);

  const members = selectorListFor('a[href^="tel:"]')
    .split(",")
    .map((member) => member.trim());
  assert.ok(
    members.some((member) => /^a\[href\^="tel:"\]\s+\*$/.test(member)),
    `the exemption must reach descendants (\`a[href^="tel:"] *\`), or the mark keeps \`callout: none\` -- found [${members.join(" | ")}]`,
  );
});

/* WhatsApp must offer no sheet: its href is a `wa.me` web URL, so the sheet would offer "Copy Link"
   and put the number inside a copied URL -- the outcome the owner's scoping removes.

   Asserted as its OWN rule rather than left to layout. The chrome rule matches the label and the
   mark but not the `<a>`, and `html` no longer sets the callout, so WhatsApp was protected only
   because its children happen to cover the whole anchor box. Review found that: a caller passing
   `align="center"` or dropping `items-stretch` would expose a long-pressable band of bare anchor. */
test("WhatsApp suppresses the callout by its own rule, not by coincidence", () => {
  const rule = ruleBody('a[href^="https://wa.me');
  assert.match(rule, /-webkit-touch-callout:\s*none/);
});

/* FILE-WIDE, not scoped to the exemption's own selector list. The claim is "nothing but the Call
   action takes the callout back ANYWHERE", and a second rule elsewhere in the file granting
   `default` to `wa.me` would satisfy a check that only read the tel: rule's own selectors. */
test("no selector other than the Call action takes the callout back", () => {
  const granting = [
    ...globals.matchAll(
      /([^{}]+)\{[^}]*-webkit-touch-callout:\s*default[^}]*\}/g,
    ),
  ].map((match) => match[1].trim());
  assert.ok(granting.length > 0, "no rule grants the callout back at all");
  for (const selectorList of granting) {
    for (const member of selectorList.split(",").map((m) => m.trim())) {
      assert.match(
        member,
        /^a\[href\^="tel:"\]/,
        `only the Call action may take the callout back -- \`${member}\` also does`,
      );
    }
  }
});

/* The gallery is the visual companion to `DESIGN.md`, so a specimen or pointer that states the
   opposite of what ships is worse than none. Both strings below described the OLD document-wide
   suppression and survived the change that falsified them -- the third such drift recorded on this
   branch, which is why this is a test and not a note asking the next person to remember. */
test("the gallery does not claim the page is unselectable", () => {
  for (const path of [
    "app/design-system/_sections/technical.tsx",
    "app/design-system/_sections/domain.tsx",
  ]) {
    const source = readFileSync(path, "utf8");
    for (const claim of [
      /nothing selects/i,
      /nothing on the page is selectable/i,
      /nothing is selectable/i,
    ]) {
      assert.doesNotMatch(
        source,
        claim,
        `${path} still states the pre-2026-10-03 behaviour; content is selectable now`,
      );
    }
  }
});
