import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

/* THE GALLERY RESTATES TOKEN VALUES IN PROSE, AND PROSE DRIFTS SILENTLY (review minor M10).
   A specimen's caption writes pairs like `--retrace-duration (3.2s)` so a reader sees the shipped
   number beside the name. That is a SECOND COPY of a value `tokens.css` already owns, and this
   project has been bitten by exactly that shape before: a hand-copied specimen drifted inside the
   very commit that added the note asking the next person to keep it in sync (`lessons.md` -> Docs).

   Deleting the second copy would be better than guarding it, but the prose genuinely wants the
   number in line with the name, so the next best thing is that no copy can drift unnoticed. This
   asserts the GENERAL rule rather than the twelve pairs that exist today, so a pair added later is
   covered the day it is written and nobody has to remember this file exists. */

const TOKENS_CSS = join(import.meta.dirname, "..", "styles", "tokens.css");
const SECTIONS = join(import.meta.dirname, "_sections");

function declaredTokens(): Map<string, string> {
  const css = readFileSync(TOKENS_CSS, "utf8");
  const declared = new Map<string, string>();
  /* Declarations only — `var(--x)` references are reads, not definitions, and a token redeclared in
     a media block would otherwise overwrite the base value this prose is describing. */
  for (const [, name, value] of css.matchAll(
    /^\s*(--[a-z0-9-]+)\s*:\s*([^;]+);/gim,
  )) {
    if (!declared.has(name)) declared.set(name, value.trim());
  }
  return declared;
}

function prosePairs(): { file: string; token: string; quoted: string }[] {
  const found: { file: string; token: string; quoted: string }[] = [];
  for (const file of readdirSync(SECTIONS).filter((f) => f.endsWith(".tsx"))) {
    const source = readFileSync(join(SECTIONS, file), "utf8");
    for (const [, token, quoted] of source.matchAll(
      /(--[a-z0-9-]+) \(([^)]+)\)/g,
    )) {
      found.push({ file, token, quoted });
    }
  }
  return found;
}

test("every token value the gallery quotes in prose matches tokens.css", () => {
  const declared = declaredTokens();
  const pairs = prosePairs();

  /* Guards the finder itself: a refactor that renames the sections folder, or a formatter that
     breaks the pairs across lines, would otherwise leave this test passing on an empty set — the
     vacuous-check failure this project has already shipped once (`lessons.md` -> Verification). */
  assert.ok(
    pairs.length >= 10,
    `expected the gallery to quote at least 10 token values, found ${pairs.length} — the finder is probably broken, not the prose`,
  );

  for (const { file, token, quoted } of pairs) {
    const value = declared.get(token);
    assert.ok(
      value !== undefined,
      `${file} quotes ${token}, which tokens.css does not declare`,
    );
    /* `--retrace-loops (4)` against a declared `4`, and `(3.2s)` against `3.2s`: the prose carries
       the bare value, so compare on the value alone rather than parsing units per token. */
    assert.equal(
      quoted,
      value,
      `${file} says ${token} is "${quoted}" but tokens.css declares "${value}"`,
    );
  }
});

/* THE SAME DRIFT IN A SECOND SHAPE, WHICH THE PAIR RULE ABOVE CANNOT SEE. The typography specimen
   table carries each role's weight as a bare number in a structured row — `weight: 700` — not as a
   `--token (value)` pair, so it is a hand-maintained copy of `--text-<role>--font-weight` with
   nothing watching it. Found drifted on 2026-10-07: the eyebrow moved to 700 in `tokens.css` while
   the table still said 400, and every gate in the project stayed green.

   Rows whose role declares no weight token are skipped rather than failed — `body-italic` and
   `caption-italic` deliberately inherit from their upright siblings — so the matched count is
   asserted too, or a renamed token would skip every row and pass on nothing. */
test("every type weight the gallery's specimen table states matches tokens.css", () => {
  const declared = declaredTokens();
  const source = readFileSync(join(SECTIONS, "foundations.tsx"), "utf8");
  const rows = [
    ...source.matchAll(
      /token:\s*"type-([a-z0-9-]+)",\s*\n\s*family:[^\n]*\n\s*weight:\s*(\d+)/g,
    ),
  ];
  assert.ok(
    rows.length >= 10,
    `found ${rows.length} typography rows — the finder is probably broken, not the table`,
  );

  let checked = 0;
  for (const [, role, stated] of rows) {
    const value = declared.get(`--text-${role}--font-weight`);
    if (value === undefined) continue;
    checked += 1;
    assert.equal(
      stated,
      value,
      `the gallery states type-${role} at weight ${stated} but tokens.css declares ${value}`,
    );
  }
  assert.ok(
    checked >= 8,
    `only ${checked} of ${rows.length} rows resolved to a weight token — the token naming probably changed`,
  );
});
