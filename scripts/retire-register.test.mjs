/* The register is a list of things we have promised to delete. Its failure mode is silent: an entry
   whose subject is already gone leaves Phase 9 working from a list that no longer describes the tree,
   and nothing else in the build would ever say so. */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { test } from "node:test";
import { RETIRE_REGISTER } from "./retire-register.mjs";

test("the register is not empty, so the checks below cannot pass vacuously", () => {
  assert.ok(
    RETIRE_REGISTER.length > 0,
    "RETIRE_REGISTER is empty — every assertion in this file would pass over nothing",
  );
});

test("every register entry still exists in the tree", () => {
  const gone = RETIRE_REGISTER.filter((entry) => !existsSync(entry.path));
  assert.deepEqual(
    gone.map((entry) => entry.path),
    [],
    "a register entry names something already removed — delete the entry in the same commit as the thing",
  );
});

test("every entry states which kind of removal it owes", () => {
  const bad = RETIRE_REGISTER.filter(
    (entry) => entry.kind !== "unused" && entry.kind !== "temporary",
  );
  assert.deepEqual(
    bad.map((entry) => entry.path),
    [],
  );
});

test("every entry says why, so Phase 9 does not have to reconstruct it", () => {
  const silent = RETIRE_REGISTER.filter(
    (entry) => typeof entry.why !== "string" || entry.why.trim().length === 0,
  );
  assert.deepEqual(
    silent.map((entry) => entry.path),
    [],
  );
});

test("no path is registered twice", () => {
  const paths = RETIRE_REGISTER.map((entry) => entry.path);
  assert.equal(new Set(paths).size, paths.length);
});
