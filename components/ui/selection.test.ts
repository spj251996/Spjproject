import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/* `app/` is outside this project's test glob (`content/*.test.ts`, `components/**`, `scripts/**`),
   so a test for a global stylesheet lives here and reads it by path -- the same thing
   `contact-actions.test.ts` does for `app/_sections/contact.tsx`.

   Comments are stripped ONCE, up front, and every helper below works on the stripped text. Each rule
   in that file is preceded by a comment explaining it, and those comments quote the selectors and
   values the assertions search for, so an unstripped anchor can resolve inside prose and land on the
   right rule only by luck. */
const globals = readFileSync("app/globals.css", "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  "",
);

function ruleBody(selector: string) {
  const from = globals.indexOf(selector);
  assert.notStrictEqual(from, -1, `no \`${selector}\` rule found`);
  const open = globals.indexOf("{", from);
  const close = globals.indexOf("}", open);
  assert.notStrictEqual(close, -1, `\`${selector}\` has an unclosed rule`);
  return globals.slice(open + 1, close);
}

function selectorListFor(selector: string) {
  const at = globals.indexOf(selector);
  assert.notStrictEqual(at, -1, `no \`${selector}\` rule found`);
  return globals
    .slice(globals.lastIndexOf("}", at) + 1, globals.indexOf("{", at))
    .trim();
}

/* NOTHING ON THE SITE IS SELECTABLE -- owner, 2026-10-03, restated after a round briefly scoped the
   suppression to chrome and let content select. The rule is document-wide on purpose: set on `html`
   so it inherits to every surface without any element opting in, and so no future component can
   become selectable by being added. A guest reads the invitation; they do not harvest it. */
test("nothing on the site is selectable", () => {
  const html = ruleBody("html {");
  assert.match(html, /(^|[^-])user-select:\s*none/);
  /* iOS Safari needs the prefixed form; without it the unprefixed one does nothing there. */
  assert.match(html, /-webkit-user-select:\s*none/);
  assert.match(html, /-webkit-touch-callout:\s*none/);
});

/* The whole point of setting it on `html` is that nothing re-enables it. A single `user-select: text`
   anywhere in this stylesheet reopens whatever it matches, which is how the previous round's change
   went in -- so the absence is asserted FILE-WIDE, not just outside the `html` rule. */
test("no rule re-enables selection anywhere in the stylesheet", () => {
  assert.doesNotMatch(globals, /user-select:\s*(text|auto|all)/);
});

/* The Call action is the ONE exemption, and it is to the long-press callout only -- never to
   selection (owner, 2026-10-03: "this copy number allowed on call via menu is ok... only for phone
   buttons"). Contact prints no number, so the platform's own `tel:` sheet is the only way to offer
   it. That sheet comes from the LINK, not from a text selection, so it works while nothing on the
   page is selectable.

   The descendant `*` is load-bearing: `-webkit-touch-callout` is inherited, and the mark is an
   `aria-hidden` `<svg>` on a 44px disc. Exempting only the anchor would still work by inheritance,
   but naming the descendants keeps the exemption true if any rule ever sets the property on an inner
   element -- which is exactly how the label and the disc came to disagree once already. */
test("the Call action is exempt from the callout, and to the callout only", () => {
  const exemption = ruleBody('a[href^="tel:"]');
  assert.match(exemption, /-webkit-touch-callout:\s*default/);
  assert.doesNotMatch(exemption, /user-select/);
  const members = selectorListFor('a[href^="tel:"]')
    .split(",")
    .map((member) => member.trim());
  assert.ok(
    members.some((member) => /^a\[href\^="tel:"\]\s+\*$/.test(member)),
    `the exemption must reach descendants -- found [${members.join(" | ")}]`,
  );
});

/* FILE-WIDE. The claim is "nothing but the Call action takes the callout back ANYWHERE", so a second
   rule granting `default` to WhatsApp -- whose `wa.me` href would offer "Copy Link" and put the
   number inside a copied URL -- must fail even though it sits in a different rule. */
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

/* The gallery is the visual companion to `DESIGN.md`, so a pointer or note that states the opposite
   of what ships is worse than none. These two strings were edited to describe selectable content
   during the round that briefly shipped it; this pins them back to what the site actually does. */
test("the gallery states that nothing selects", () => {
  assert.match(
    readFileSync("app/design-system/_sections/technical.tsx", "utf8"),
    /nothing selects/,
  );
  assert.match(
    readFileSync("app/design-system/_sections/domain.tsx", "utf8"),
    /nothing on the page is selectable/,
  );
});
