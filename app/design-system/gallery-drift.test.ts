import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/* The gallery restates `DESIGN.md` by hand. Pin the CLAIM, never a spelling: a test that asserts a
   source spelling passes the mutation that matters and fails the correct rewrite. */

const foundations = readFileSync(
  "app/design-system/_sections/foundations.tsx",
  "utf8",
);
const domain = readFileSync("app/design-system/_sections/domain.tsx", "utf8");

/* Two fixed states: the hero is unpainted, every other card mounted. The gallery shows exactly those, and no
   specimen passes a paint -- the prop is gone, so one would not even compile. */
test("the gallery shows the unpainted hero and a mounted card, and no retired paint", () => {
  const sheets = [...foundations.matchAll(/<MountedSheet\b([^>]*)>/g)].map(
    (m) => m[1],
  );
  assert.ok(
    sheets.some((props) => /\bhero\b/.test(props)),
    "no hero specimen",
  );
  assert.ok(
    sheets.some((props) => !/\bhero\b/.test(props)),
    "no ordinary (mounted) specimen",
  );
  for (const [name, src] of [
    ["foundations", foundations],
    ["domain", domain],
  ] as const) {
    for (const gone of [
      "paint=",
      "/thread/current",
      "/thread/mount",
      "/thread/stock",
      "Stock only",
      "Hero · painted",
    ]) {
      assert.ok(
        !src.includes(gone),
        `${name}.tsx still names the retired "${gone}"`,
      );
    }
  }
});

/* The hero paints no backing at ANY width, so a note saying it keeps its mount's fill below md describes the
   retired painted hero -- and contradicts the specimen rendered beneath it. It keeps its reveal, which is geometry. */
test("the gallery does not claim the hero keeps a fill", () => {
  assert.ok(
    !/hero keeps both/.test(foundations),
    "foundations.tsx says the hero keeps both fill and reveal -- it keeps only the reveal",
  );
});

/* The shipped sequence is Bloom, its type landing at 1800ms. A gallery string still presenting the retired
   painted hero's four-beat, 2400ms sequence is the drift this file exists to catch. */
test("the gallery does not present the retired painted hero's sequence", () => {
  for (const stale of [
    "mount settles",
    "stock settles",
    "four beats",
    "2400ms",
    "2200ms",
  ]) {
    for (const [name, source] of [
      ["foundations", foundations],
      ["domain", domain],
    ] as const) {
      assert.ok(
        !source.includes(stale),
        `${name}.tsx still carries "${stale}", which describes the retired painted hero`,
      );
    }
  }
});

test("the Invite entry names the shipped opening, Bloom", () => {
  assert.match(domain, /The opening is Bloom/);
});

/* A thread entry asserting the thread is on the published page is the drift: it lives on the lab route. */
test("the gallery does not claim the thread is live on the published page", () => {
  const source = readFileSync("app/design-system/_sections/domain.tsx", "utf8");
  /* Bounded by the THREAD_ENTRIES array itself, not by the next entry name: the gallery's section
     entries legitimately say "Live at /." -- the sections ARE on the published page -- so a slice
     wide enough to reach them would fail on correct prose. */
  const start = source.indexOf("const THREAD_ENTRIES");
  const end = source.indexOf("const INVITE_ENTRIES");
  /* A slice that silently returned nothing would make this pass while checking no prose at all. */
  assert.ok(
    start !== -1 && end !== -1 && start < end,
    "the thread entries moved -- re-anchor this test rather than deleting it",
  );
  const threadEntries = source.slice(start, end);
  assert.match(
    threadEntries,
    /note: "/,
    "the slice carries no note prose -- re-anchor it",
  );
  assert.ok(
    !threadEntries.includes("Live at /."),
    'a thread entry still claims "Live at /." -- the thread is on the lab route, not the published page',
  );
});
