import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const typeScale = readFileSync("app/styles/type-scale.css", "utf8");
// Comments explain the retired design by name, so the assertions read the code alone.
const buttonAction = readFileSync(
  "components/ui/button-action.tsx",
  "utf8",
).replace(/\/\*[\s\S]*?\*\//g, "");
/* Actions appear in four sections, so the one read became a concatenation when the sections moved
   out of `app/page.tsx` -- reading one file would have narrowed the coverage silently. */
const page = ["event-info", "contact", "family", "celebrations"]
  .map((name) => readFileSync(`app/_sections/${name}.tsx`, "utf8"))
  .join("\n");
const tokens = readFileSync("app/styles/tokens.css", "utf8");

function ruleBody(css: string, selector: string) {
  const match = css.match(new RegExp(`${selector}\\s*\\{([^}]*)\\}`));
  assert.ok(match, `${selector} rule not found`);
  return match[1];
}

/* The role owns its own size rather than borrowing `--text-body`'s (owner, 2026-09-30), so an
   action can diverge from prose later without a second edit. The two are set to the SAME values
   today -- the point is that they are separable, not that they differ. */
test("type-action is sentence-case italic at its own size token", () => {
  const rule = ruleBody(typeScale, "\\.type-action");
  assert.match(rule, /font-style:\s*italic/);
  assert.match(rule, /font-size:\s*var\(--text-action\)/);
  assert.match(rule, /line-height:\s*var\(--text-action--line-height\)/);
  assert.doesNotMatch(rule, /var\(--text-body/);
});

/* Pinned because the size token exists to allow divergence, and divergence that happens by
   accident -- a tier edited on one role and not the other -- is the failure it invites. */
test("every tier's action size matches the body size it was set from", () => {
  const sizes = (name: string) =>
    [...tokens.matchAll(new RegExp(`--text-${name}:\\s*(\\d+)px`, "g"))].map(
      (m) => m[1],
    );
  assert.deepEqual(sizes("action"), sizes("body"));
});

test("type-action carries no capitals and no tracking tuned for them", () => {
  const rule = ruleBody(typeScale, "\\.type-action");
  assert.doesNotMatch(rule, /text-transform/);
  assert.doesNotMatch(
    rule,
    /letter-spacing:\s*var\(--text-action--letter-spacing\)/,
  );
});

// The utility also lays the stock's grain, which reads as noise inside a circle this small.
test("the disc takes the surface colour bare, never the grained utility", () => {
  assert.match(buttonAction, /bg-\(--color-surface-elevated\)/);
  assert.doesNotMatch(buttonAction, /(^|[\s"'`])bg-surface-elevated/);
});

test("the mark is scaled on the disc rather than sized by class", () => {
  assert.match(buttonAction, /\[&_svg\]:\[transform:scale\(/);
});

/* The disc was `--touch-target` until 2026-10-07, so its size WAS the 44px accessibility floor.
   Shrinking it to 32 only works because the target carries the floor itself; if that ever moves
   back onto the disc, the disc's size silently becomes the hit area again and no render check
   would report it as a failure — it would just be a smaller tap target. */
test("the disc has its own size token and is no longer the touch target", () => {
  assert.match(tokens, /--action-disc:\s*32px/);
  assert.match(buttonAction, /size-\(--action-disc\)/);
  assert.doesNotMatch(
    buttonAction,
    /size-\(--touch-target\)/,
    "the disc must not be sized by the touch target again",
  );
});

test("the target keeps the touch-target floor on both axes", () => {
  assert.match(buttonAction, /min-h-\(--touch-target\)/);
  assert.match(buttonAction, /min-w-\(--touch-target\)/);
  assert.match(tokens, /--touch-target:\s*44px/);
});

/* An owner-tuned constant with nothing pinning it is how a fitting step silently overwrites a
   value someone chose by eye. 1.2 is 1.65 x 32/44: the scale the 44px disc carried, held in
   proportion as the disc came down, so the mark keeps its share of the circle. The ratio is
   asserted rather than the bare number, so moving the disc without moving the scale fails here
   instead of rendering a crowded or a lost mark. */
test("the mark's scale is in proportion to the disc", () => {
  const scale = /\[&_svg\]:\[transform:scale\(([\d.]+)\)\]/.exec(buttonAction);
  assert.ok(scale, "no mark scale found on the disc");
  const disc = /--action-disc:\s*(\d+)px/.exec(tokens);
  assert.ok(disc, "no --action-disc in tokens.css");
  const expected = (1.65 * Number(disc[1])) / 44;
  assert.ok(
    Math.abs(Number(scale[1]) - expected) < 0.005,
    `the mark is scaled ${scale[1]} on a ${disc[1]}px disc; in proportion it should be ${expected.toFixed(3)}`,
  );
});

test("the flanking hairline rules are gone", () => {
  assert.doesNotMatch(buttonAction, /stroke-divider|<hr|h-px/);
});

test("the map action reads Meet us here", () => {
  assert.match(
    page,
    /mark=\{<MapIcon size=\{24\} \/>\}\s*>\s*Meet us here\s*<\/ButtonAction>/,
  );
});

test("Contact prints no phone number and keeps no selection exception", () => {
  assert.doesNotMatch(page, /readableNumber/);
  assert.doesNotMatch(page, /data-contact-number/);
  assert.doesNotMatch(page, /contact\.css/);
});

// Bold is a deliberate departure from type-body-italic's 400, giving an action presence beside its disc.
test("the action role keeps its bold weight and drops the caps-era tracking", () => {
  assert.match(tokens, /--text-action--font-weight:\s*700/);
  assert.match(
    ruleBody(typeScale, "\\.type-action"),
    /font-weight:\s*var\(--text-action--font-weight\)/,
  );
  /* The tracking was tuned for uppercase and has no meaning for sentence-case italic. */
  assert.doesNotMatch(tokens, /--text-action--letter-spacing:/);
});

/* EVALUATED, not pattern-matched. Pinning a spelling of the predicate passes the mis-refactor as
   well as the correct one: `href.startsWith("tel:") || !href.startsWith("//")` satisfies any regex
   asking for the `//` exclusion, and makes every external `https://` link same-tab with no
   `rel="noopener noreferrer"` -- the exact defect this guard exists to prevent. The predicate is a
   self-contained expression over one variable, so the honest test is to run it.

   A protocol-relative URL is the case that motivated this: it starts with `/` like a root-relative
   path but is an EXTERNAL destination, so treating it as same-tab drops the new tab's protection. */
test("sameTab opens external destinations in a new tab and this site in place", () => {
  const from = buttonAction.indexOf("const sameTab =");
  assert.notStrictEqual(from, -1, "no sameTab predicate found");
  const expression = buttonAction
    .slice(from + "const sameTab =".length, buttonAction.indexOf(";", from))
    .trim();
  const sameTab = new Function("href", `return ${expression};`) as (
    href: string,
  ) => boolean;

  for (const href of ["tel:+919354187793", "/", "/design-system"]) {
    assert.equal(sameTab(href), true, `${href} should replace the page`);
  }
  for (const href of [
    "//evil.example",
    "//wa.me/919354187793",
    "https://wa.me/919354187793",
    "https://maps.google.com/",
    "http://example.com/",
  ]) {
    assert.equal(
      sameTab(href),
      false,
      `${href} is external and must open in its own tab with noopener`,
    );
  }
});
