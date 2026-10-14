import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/* `app/` is outside this project's test glob (`content/*.test.ts`, `components/**`, `scripts/**`),
   so a test for a global stylesheet lives here and reads it by path.

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

/* NOTHING TAKES THE LONG-PRESS CALLOUT BACK. The one exemption there was — the Call action's `tel:`
   link, so a guest could copy a number the page never printed — left with Contact (2026-10-14), and
   the page carries no `tel:` link. A rule granting `default` anywhere would reopen the iOS sheet on
   whatever it matched, including a portrait's save menu. */
test("no rule takes the long-press callout back", () => {
  assert.doesNotMatch(globals, /-webkit-touch-callout:\s*default/);
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
