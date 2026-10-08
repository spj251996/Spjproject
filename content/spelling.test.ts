/* The couple corrected the state's old spelling to "Kerala". It appeared in nine places across four files, which is
   why this is a gate and not a note: a sweep that reaches eight of nine looks exactly like one that
   reaches all nine.

   `legacy-html/` is excluded deliberately — it is the archived previous site, reference-only, not
   served and not part of the build. Correcting it would misrepresent what that site said. */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const ROOTS = ["content", "app", "components", "scripts"];
const SKIP = new Set(["node_modules", ".next", "out", "legacy-html", "tmp"]);
const TEXT = /\.(ts|tsx|mjs|js|css|json)$/;

function* walk(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* walk(path);
    else if (TEXT.test(name)) yield path;
  }
}

// Built from parts so this file does not contain, and so flag, the spelling it forbids.
const OLD_SPELLING = ["Kera", "lam"].join("");

const files = ROOTS.flatMap((root) => [...walk(root)]);

test("the sweep reaches real files, so the assertion below is not vacuous", () => {
  assert.ok(files.length > 50, `only ${files.length} files walked`);
});

test("the state is spelled Kerala everywhere in shipping source", () => {
  const offenders = files.filter((path) =>
    readFileSync(path, "utf8").includes(OLD_SPELLING),
  );
  assert.deepEqual(offenders, []);
});

test("and Kerala is actually present, so the rule is not passing on absence", () => {
  const found = files.filter((path) =>
    readFileSync(path, "utf8").includes("Kerala"),
  );
  assert.ok(found.length >= 3, `only ${found.length} files mention Kerala`);
});
