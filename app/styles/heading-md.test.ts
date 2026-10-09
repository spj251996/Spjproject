import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

/* `heading-md` exists because nothing sat between `heading-lg` (14px) and `heading-xl` (26px), and
   `heading-lg` could not be grown to reach it — it carries four jobs at one size. The ritual title
   had to leave the role rather than move it (DESIGN.md → Foundations → Typography).

   Two things can go wrong here and neither reports itself:

   - A class whose `font-size` names a token that does not exist resolves to NOTHING. The element
     then paints at its inherited size, `tsc`, lint, the build and every render check stay green,
     and the only symptom is type that looks slightly wrong. So the built CSS is read, not the
     token file: the token file cannot tell you whether the declaration survived the build.
   - The gallery carries each role's figures as STRUCTURED DATA, not as `--token (value)` prose, so
     `token-prose.test.ts` structurally cannot match it. A specimen can therefore drift from the
     token file with every project gate green — which this project has already shipped once. */

const CSS_DIR = "out/_next/static/chunks";
const tokens = readFileSync("app/styles/tokens.css", "utf8");
const typeScale = readFileSync("app/styles/type-scale.css", "utf8");
/* Every declaration of one token, in source order — which is the tier order the tokens file uses:
   the base block, then `md`, `lg` and `xl`. */
function declared(name: string): string[] {
  return [...tokens.matchAll(new RegExp(`${name}:\\s*(\\d+)px`, "g"))].map(
    (match) => match[1],
  );
}

test("heading-md is declared at all four tiers", () => {
  assert.deepStrictEqual(
    declared("--text-heading-md"),
    ["19", "21", "19", "23"],
    "expected a base value and three tier overrides, in tier order",
  );
  assert.deepStrictEqual(declared("--text-heading-md--line-height"), [
    "32",
    "34",
    "32",
    "36",
  ]);
  assert.match(tokens, /--text-heading-md--font-weight:\s*700;/);
});

test("the class reads the tokens rather than literals", () => {
  const at = typeScale.indexOf(".type-heading-md {");
  assert.notStrictEqual(at, -1, "no .type-heading-md rule in type-scale.css");
  const rule = typeScale.slice(at, typeScale.indexOf("}", at));
  assert.match(rule, /font-size:\s*var\(--text-heading-md\)/);
  assert.match(rule, /font-weight:\s*var\(--text-heading-md--font-weight\)/);
  assert.match(rule, /line-height:\s*var\(--text-heading-md--line-height\)/);
});

test("the role survives into the built CSS with a size that resolves", (t) => {
  if (!existsSync(CSS_DIR)) {
    t.skip("no static export: run `npm run build` first");
    return;
  }
  const css = readdirSync(CSS_DIR)
    .filter((name) => name.endsWith(".css"))
    .map((name) => readFileSync(join(CSS_DIR, name), "utf8"))
    .join("\n");
  const rule = /\.type-heading-md\{[^}]*\}/.exec(css);
  assert.notStrictEqual(
    rule,
    null,
    "no .type-heading-md rule in the built CSS",
  );
  assert.match(
    (rule as RegExpExecArray)[0],
    /font-size:var\(--text-heading-md\)/,
  );
  assert.match(
    css,
    /--text-heading-md:\s*\d+px/,
    "the class survived but its token did not — the size resolves to nothing",
  );
});
