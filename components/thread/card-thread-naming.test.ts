import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

/* A half-rename is how a gate goes blind: `scripts/check-thread-clearance.mjs` locates this
   component by its DOM attribute, so renaming the export without the attribute leaves that gate
   passing while measuring nothing. This asserts the whole namespace is closed -- comments and
   scripts included, because a comment naming a symbol that no longer exists is the drift class this
   branch has recorded four times. */
const RETIRED = [
  "WishesWeave",
  "pageWeave",
  "WEAVE_CUT_ID",
  "weaveRetraces",
  "data-thread-weave",
];

function sources(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next" || entry === "out")
      continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      out.push(...sources(path));
    } else if (/\.(ts|tsx|mjs|css)$/.test(entry)) {
      out.push(path);
    }
  }
  return out;
}

test("no retired weave identifier survives anywhere in the tree", () => {
  const files = ["app", "components", "scripts", "content"].flatMap(sources);
  /* A walk that silently returned nothing would make this test pass while checking no file at all. */
  assert.ok(
    files.length > 50,
    `the walk found only ${files.length} files -- it is not reaching the tree`,
  );
  const found: string[] = [];
  for (const file of files) {
    if (file.endsWith("card-thread-naming.test.ts")) continue;
    const text = readFileSync(file, "utf8");
    for (const name of RETIRED) {
      if (text.includes(name)) found.push(`${file}: ${name}`);
    }
  }
  assert.deepStrictEqual(
    found,
    [],
    `retired identifiers still present:\n${found.join("\n")}`,
  );
});
