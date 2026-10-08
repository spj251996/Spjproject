/* `/` drops Contact; the lab routes keep it, and that asymmetry is load-bearing rather than untidy:
   `contact` is in `THREAD_IDS`, and `page-thread.tsx` bails out of measuring when the section count
   does not match it — so a lab route without Contact renders no thread, with no error anywhere.

   Asserted on the source rather than on a render because the claim is about which route passes which
   prop, which a render of either page alone cannot show. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const sections = readFileSync("app/_sections/index.tsx", "utf8");
const home = readFileSync("app/page.tsx", "utf8");
const lab = readFileSync("app/thread/[variant]/page.tsx", "utf8");

test("Sections takes a contact flag that defaults to on", () => {
  assert.match(sections, /contact\s*=\s*true/);
});

test("Contact is rendered conditionally, not unconditionally", () => {
  assert.match(sections, /contact\s*\?\s*<ContactSection/);
});

test("the published page turns it off", () => {
  /* No `s` flag: this project's tsconfig target predates it, and the pattern uses `[^>]*` rather
     than `.` so the flag was inert anyway. */
  assert.match(home, /<Sections[^>]*contact=\{false\}/);
});

test("the lab route does not, so the thread keeps its six sections", () => {
  assert.doesNotMatch(lab, /contact=/);
});

test("THREAD_IDS still contains contact, which is why the lab keeps it", () => {
  const paths = readFileSync("components/thread/thread-paths.ts", "utf8");
  assert.match(
    paths,
    /"contact"/,
    "contact left THREAD_IDS — if that was deliberate, this whole test is obsolete and the lab route can drop the section too",
  );
});
