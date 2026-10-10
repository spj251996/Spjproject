import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

/* `heading-md` exists because nothing sat between `heading-lg` (14px) and `heading-xl` (26px), and
   `heading-lg` could not be grown to reach it.
   SETTLED AT 21/23/21/25 (owner, 2026-10-10), up 8% from the 19/21/19/23 it was first built at and
   LANDED AS WHOLE PIXELS rather than a factor, per this project's own rule. The step below it was
   dropped on measurement rather than taste: +5% is a ONE-pixel change on a 19px title, which is
   below the threshold at which anyone sees it without the two side by side — so the real choice
   was +8% or nothing. At 21px the title is 1.62x body against 1.46x before, and it has to lead a
   block holding a 14px gold Malayalam, a 13px italic tagline and 13px body. The ceiling is +37%,
   where it would equal its own section heading.
   The LINE HEIGHTS deliberately did NOT move: 32/34/32/36 against the new sizes is 1.52 at phone,
   and holding them is what keeps the ritual row — and so Celebrations' recorded section height —
   where it is. Measured, not assumed — it carries four jobs at one size. The ritual title
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
const PUBLISHED = "out/index.html";

/* THE STYLESHEETS `/` ITSELF LOADS, not every chunk in the export concatenated. The difference is
   not pedantry: a route-scoped stylesheet gets its own chunk, `/preview` imports one that
   overrides `.type-heading-md` for a tuning lever, and a concatenating read matched THAT rule
   first and failed this gate on correct work. Reading the published document's own `<link>` set
   makes the claim what it was always meant to be — the role resolves on the page that ships. */
function publishedCss(): string {
  const html = readFileSync(PUBLISHED, "utf8");
  const sheets = [
    ...new Set(
      [...html.matchAll(/\/_next\/static\/chunks\/([A-Za-z0-9_-]+\.css)/g)].map(
        (match) => match[1],
      ),
    ),
  ];
  assert.ok(sheets.length > 0, `no stylesheet links in ${PUBLISHED}`);
  return sheets
    .map((name) => readFileSync(join(CSS_DIR, name), "utf8"))
    .join("\n");
}
const tokens = readFileSync("app/styles/tokens.css", "utf8");
const typeScale = readFileSync("app/styles/type-scale.css", "utf8");
const gallery = readFileSync(
  "app/design-system/_sections/foundations.tsx",
  "utf8",
);

/* Every declaration of one token, in source order — which is the tier order the tokens file uses:
   the base block, then `md`, `lg` and `xl`. */
function declared(name: string): string[] {
  return [...tokens.matchAll(new RegExp(`${name}:\\s*(\\d+)px`, "g"))].map(
    (match) => match[1],
  );
}

/* Bounded by the entry's own closing brace at its indent, so the nested per-tier objects cannot end
   the slice early. */
function gallerySpecimen(): string {
  const at = gallery.indexOf('token: "type-heading-md"');
  assert.notStrictEqual(
    at,
    -1,
    "no type-heading-md entry in the gallery's TYPE_TOKENS",
  );
  const end = gallery.indexOf("\n  },", at);
  assert.notStrictEqual(end, -1, "the TYPE_TOKENS entry is unterminated");
  return gallery.slice(at, end);
}

test("heading-md is declared at all four tiers", () => {
  assert.deepStrictEqual(
    declared("--text-heading-md"),
    ["21", "23", "21", "25"],
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
  if (!existsSync(CSS_DIR) || !existsSync(PUBLISHED)) {
    t.skip("no static export: run `npm run build` first");
    return;
  }
  const css = publishedCss();
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

test("the gallery's specimen carries the token file's own figures", () => {
  const specimen = gallerySpecimen();
  const sizes = declared("--text-heading-md");
  const heights = declared("--text-heading-md--line-height");
  const tiers = ["phone", "tablet", "laptop", "desktop"];
  tiers.forEach((tier, index) => {
    const row = new RegExp(
      `${tier}:\\s*\\{\\s*size:\\s*(\\d+),\\s*lh:\\s*(\\d+)`,
    );
    const match = row.exec(specimen);
    assert.notStrictEqual(match, null, `no ${tier} row in the specimen`);
    assert.strictEqual(
      (match as RegExpExecArray)[1],
      sizes[index],
      `the specimen's ${tier} size disagrees with tokens.css`,
    );
    assert.strictEqual(
      (match as RegExpExecArray)[2],
      heights[index],
      `the specimen's ${tier} line height disagrees with tokens.css`,
    );
  });
});
