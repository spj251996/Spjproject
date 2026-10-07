/* The built-export gate: which routes the export contains, and which carry thread roots. A green
 * build proves nothing about the artifact -- a route can be excluded by `pageExtensions`, and a
 * bundler can drop a file without erroring. Reads `out/` directly, never a served URL: `serve -s`
 * rewrites unknown paths to `index.html`, which has twice made a check measure the home page.
 *
 * It also discharges the `[lab]`-matches-reality claim for the thread, which is Plan 1's only `[lab]`
 * entry: asserting `/` carries zero thread roots IS the assertion that its subject is absent from the
 * published page.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";

/* Measured on the export before this gate was written: the trunk's no-JS fallback, the trunk's live
 * root, and the card thread's. Not a remembered figure. */
const LAB_ROOTS = 3;

const EXPECTED = [
  { path: "out/index.html", roots: 0, label: "/ (published)" },
  {
    /* MEASURED, not assumed: under `output: "export"` this version emits a dynamic route as
     * `out/thread/<variant>.html`, NOT `out/thread/<variant>/index.html`. The sibling
     * `out/thread/<variant>/` directory it also writes holds only RSC payload `.txt` files. */
    path: "out/thread/current.html",
    roots: LAB_ROOTS,
    label: "/thread/current (lab)",
  },
];
const FORBIDDEN = ["out/design-system/index.html", "out/lab-scratch"];
/* The exact SET of lab routes, so an extra one cannot appear unnoticed. Asserting the set rather than
 * listing forbidden paths means Plan 2 updates one line instead of remembering to delete a guard. */
const LAB_ROUTES = ["current"];

let failed = false;
for (const { path, roots, label } of EXPECTED) {
  if (!existsSync(path)) {
    console.error(`FAIL ${label}: ${path} is missing from the export`);
    failed = true;
    continue;
  }
  const found = (readFileSync(path, "utf8").match(/data-thread-svg/g) ?? [])
    .length;
  const ok = found === roots;
  console.log(
    `${ok ? "ok  " : "FAIL"} ${label}: ${found} thread roots, expected ${roots}`,
  );
  if (!ok) failed = true;
}
for (const path of FORBIDDEN) {
  if (existsSync(path)) {
    console.error(`FAIL: ${path} must not be in the export`);
    failed = true;
  }
}
if (existsSync("out/thread")) {
  /* The variant names are read off the emitted HTML documents alone -- the same directory also holds
   * each route's RSC payload directory and `.txt` files, which are not routes. */
  const actual = readdirSync("out/thread")
    .filter((name) => name.endsWith(".html"))
    .map((name) => name.replace(/\.html$/, ""))
    .sort();
  const expected = [...LAB_ROUTES].sort();
  const ok =
    actual.length === expected.length &&
    actual.every((name, i) => name === expected[i]);
  console.log(
    `${ok ? "ok  " : "FAIL"} lab routes: [${actual}], expected [${expected}]`,
  );
  if (!ok) failed = true;
} else {
  console.error(
    "FAIL: out/thread is missing -- the lab route was not exported",
  );
  failed = true;
}
console.log(failed ? "VERDICT: FAIL" : "VERDICT: PASS");
process.exit(failed ? 1 : 0);
