import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/* Composed at run time: Tailwind scans test files, so a literal here would keep the class in the
   build on its own. */
const utility = (...parts: string[]) => parts.join("-");
const R = `${utility("max", "reflow")}:`;
const GRID_COLS_1 = R + utility("grid", "cols", "1");
const W_FULL = R + utility("w", "full");
const JUSTIFY_START = R + utility("justify", "start");
const WRAP_NORMAL = R + utility("whitespace", "normal");
const HIDDEN = R + utility("hid" + "den");
const MAX_W_FULL = R + utility("max", "w", "full");
const FLOW_ROW = R + utility("grid", "flow", "row");
const W_AUTO = R + utility("w", "auto");
const WRAP_NONE = utility("whitespace", "nowrap");

const source = (path: string) =>
  readFileSync(path, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

const CASES: [string, string[]][] = [
  [
    "app/_sections/event-info.tsx",
    [GRID_COLS_1, W_FULL, JUSTIFY_START, WRAP_NORMAL],
  ],
  ["components/ui/button-action.tsx", [WRAP_NORMAL]],
  ["components/ui/sprig-ornament.tsx", [HIDDEN]],
  ["components/ui/couple-names.tsx", [MAX_W_FULL]],
  ["components/family/family.tsx", [FLOW_ROW, W_AUTO]],
];

for (const [path, classes] of CASES) {
  test(`${path} carries its reflow classes`, () => {
    const code = source(path);
    for (const name of classes)
      assert.ok(code.includes(name), `${name} missing`);
  });
}

test("event-info wraps all four nowrap spans below the reflow width", () => {
  const code = source("app/_sections/event-info.tsx");
  const declaration = new RegExp(
    `const NOWRAP_UNTIL_REFLOW = "${WRAP_NONE} ${WRAP_NORMAL}"`,
  );
  assert.match(code, declaration);
  assert.equal(
    code.match(/\{NOWRAP_UNTIL_REFLOW\}|\$\{NOWRAP_UNTIL_REFLOW\}/g)?.length,
    4,
  );
  assert.equal(code.match(new RegExp(WRAP_NONE, "g"))?.length, 1);
});

test("sprig-ornament hides the rule and both sprigs below the reflow width", () => {
  const code = source("components/ui/sprig-ornament.tsx");
  assert.equal(code.match(new RegExp(HIDDEN, "g"))?.length, 2);
  assert.equal(code.match(/<SprigIcon className=\{[^}]*\bSPRIG\b/g)?.length, 2);
});

test("couple-names gives all four lockup strings the cap", () => {
  const code = source("components/ui/couple-names.tsx");
  assert.equal(code.match(new RegExp(MAX_W_FULL, "g"))?.length, 4);
});

test("portrait's caption span drops its overrun below the reflow width", () => {
  const code = source("components/ui/portrait.tsx");
  assert.ok(code.includes(`${R}${utility("mx", "0")}`));
  assert.ok(code.includes(`${R}${utility("w", "(--portrait", "diameter)")}`));
});

test("the hero's reveal drops to zero below the reflow width", () => {
  const code = source("components/layout/mounted-sheet.tsx");
  assert.ok(code.includes(`${R}${utility("p", "0")}`));
});

test("globals.css breaks long words anywhere below 20rem, at top level", () => {
  const css = source("app/globals.css");
  assert.match(
    css,
    /@media \(width < 20rem\) \{\s*html \{\s*overflow-wrap: anywhere;\s*hyphens: auto;\s*\}\s*\}/,
  );
});
