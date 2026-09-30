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

function ruleBody(css: string, selector: string) {
  const match = css.match(new RegExp(`${selector}\\s*\\{([^}]*)\\}`));
  assert.ok(match, `${selector} rule not found`);
  return match[1];
}

test("type-action is sentence-case italic at the body size", () => {
  const rule = ruleBody(typeScale, "\\.type-action");
  assert.match(rule, /font-style:\s*italic/);
  assert.match(rule, /font-size:\s*var\(--text-body\)/);
  assert.match(rule, /line-height:\s*var\(--text-body--line-height\)/);
});

test("type-action carries no capitals and no tracking tuned for them", () => {
  const rule = ruleBody(typeScale, "\\.type-action");
  assert.doesNotMatch(rule, /text-transform/);
  assert.doesNotMatch(
    rule,
    /letter-spacing:\s*var\(--text-action--letter-spacing\)/,
  );
  assert.doesNotMatch(rule, /var\(--text-action\)/);
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
