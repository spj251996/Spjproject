import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const typeScale = readFileSync("app/styles/type-scale.css", "utf8");
// Comments explain the retired design by name, so the assertions read the code alone.
const buttonAction = readFileSync(
  "components/ui/button-action.tsx",
  "utf8",
).replace(/\/\*[\s\S]*?\*\//g, "");
const page = readFileSync("app/page.tsx", "utf8");
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

// The utility also lays the stock's grain, which reads as noise inside a 44px circle.
test("the disc takes the surface colour bare, never the grained utility", () => {
  assert.match(buttonAction, /bg-\(--color-surface-elevated\)/);
  assert.doesNotMatch(buttonAction, /(^|[\s"'`])bg-surface-elevated/);
});

test("the mark is scaled on the disc rather than sized by class", () => {
  assert.match(buttonAction, /\[&_svg\]:\[transform:scale\(/);
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
