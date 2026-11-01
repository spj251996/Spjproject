import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

/* The typeset names, their two script roles and the script face were retired together (owner,
   2026-10-14). The drawn names still size from the two roles' SIZE tokens, which therefore stay. */
const read = (path: string) => readFileSync(path, "utf8");

test("no source names the typeset names, the two script roles or the script face", () => {
  for (const path of [
    "app/_sections/invite.tsx",
    "app/_sections/wishes.tsx",
    "app/_sections/shared.tsx",
    "app/styles/type-scale.css",
    "app/styles/tokens.css",
    "app/layout.tsx",
  ]) {
    const source = read(path);
    for (const gone of [
      "splitCoupleNames",
      "data-names-alt",
      "couple-names.css",
      "type-display-name",
      "type-heading-script",
      "__joiner",
      "Corinthia",
      "--font-script",
    ]) {
      assert.ok(!source.includes(gone), `${path} still names ${gone}`);
    }
  }
  assert.ok(!existsSync("app/couple-names.css"));
});

test("the drawn names keep their size from the two surviving size tokens", () => {
  assert.match(
    read("app/_sections/invite.tsx"),
    /text-\(length:--text-display-name\)/,
  );
  assert.match(
    read("app/_sections/wishes.tsx"),
    /text-\(length:--text-heading-script\)/,
  );
  const tokens = read("app/styles/tokens.css");
  assert.match(tokens, /--text-display-name:\s*94px;/);
  assert.match(tokens, /--text-heading-script:\s*56px;/);
});
