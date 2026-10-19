/* The register is a list of things we have promised to delete. Its failure mode is silent: an entry
   whose subject is already gone leaves the removal working from a list that no longer describes the tree,
   and nothing else in the build would ever say so. */
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative } from "node:path";
import { test } from "node:test";
import { RETIRE_REGISTER } from "./retire-register.mjs";

/* One label per entry, whichever shape it takes, so every failure below names its subject. */
function subjectOf(entry) {
  return entry.path ?? `${entry.in}::${entry.symbol}`;
}

test("the register is not empty, so the checks below cannot pass vacuously", () => {
  assert.ok(
    RETIRE_REGISTER.length > 0,
    "RETIRE_REGISTER is empty — every assertion in this file would pass over nothing",
  );
});

test("every entry takes exactly one shape — a path or a symbol, never both", () => {
  /* Both at once is the shape that would pass vacuously: the checks below branch on `path`, so a
     symbol smuggled alongside one would never be read. */
  const bad = RETIRE_REGISTER.filter(
    (entry) =>
      (entry.path === undefined) === (entry.symbol === undefined) ||
      (entry.symbol !== undefined && typeof entry.in !== "string"),
  );
  assert.deepEqual(
    bad.map(subjectOf),
    [],
    "an entry is { path } or { symbol, in } — never both, and a symbol always names its file",
  );
});

/* Whether an entry's subject is still in the tree, a relative path resolving from `root` (the repo
   root, where the suite runs). */
function stillPresent(entry, root = process.cwd()) {
  const at = (path) => (isAbsolute(path) ? path : join(root, path));
  return entry.path !== undefined
    ? existsSync(at(entry.path))
    : existsSync(at(entry.in)) &&
        readFileSync(at(entry.in), "utf8").includes(entry.symbol);
}

test("every register entry still exists in the tree", () => {
  const gone = RETIRE_REGISTER.filter((entry) => !stillPresent(entry));
  assert.deepEqual(
    gone.map(subjectOf),
    [],
    "a register entry names something already removed — delete the entry in the same commit as the thing",
  );
});

test("every entry states which kind of removal it owes", () => {
  const wrong = RETIRE_REGISTER.filter(
    (entry) => entry.kind !== "unused" && entry.kind !== "temporary",
  );
  assert.deepEqual(wrong.map(subjectOf), []);
});

test("every entry says why, so the removal does not have to reconstruct it", () => {
  const silent = RETIRE_REGISTER.filter(
    (entry) => typeof entry.why !== "string" || entry.why.trim().length === 0,
  );
  assert.deepEqual(silent.map(subjectOf), []);
});

test("no subject is registered twice", () => {
  const subjects = RETIRE_REGISTER.map(subjectOf);
  assert.equal(new Set(subjects).size, subjects.length);
});

test("a symbol entry is present while its file holds the symbol and gone once it does not", () => {
  const dir = mkdtempSync(join(tmpdir(), "retire-"));
  const file = join(dir, "subject.ts");
  writeFileSync(file, "export const RETIRED_THING = 1;\n");
  const entry = {
    symbol: "RETIRED_THING",
    in: file,
    kind: "unused",
    why: "a test",
  };
  assert.equal(stillPresent(entry), true);
  writeFileSync(file, "export const SOMETHING_ELSE = 1;\n");
  assert.equal(stillPresent(entry), false);
});

test("a relative `in` resolves from the repo root", () => {
  const entry = {
    symbol: "RETIRE_REGISTER",
    in: relative(process.cwd(), "scripts/retire-register.mjs"),
  };
  assert.equal(stillPresent(entry), true);
  assert.equal(
    stillPresent(entry, mkdtempSync(join(tmpdir(), "elsewhere-"))),
    false,
  );
});
