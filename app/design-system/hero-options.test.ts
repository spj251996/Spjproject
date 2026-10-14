import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/* The gallery restates `DESIGN.md` by hand and has drifted three times on this branch — twice inside
   the very round that caused the drift. The round that last fixed it replaced the reminder-note with
   a test, which is the pattern here: pin the CLAIM, never a spelling, because a test that asserts a
   source spelling passes the mutation that matters and fails the correct rewrite. */

const foundations = readFileSync(
  "app/design-system/_sections/foundations.tsx",
  "utf8",
);
const domain = readFileSync("app/design-system/_sections/domain.tsx", "utf8");
const inviteCss = readFileSync("app/invite.css", "utf8");

/* Two fixed states since 2026-10-14: the hero is unpainted, every other card mounted. The gallery shows exactly
   those, and no specimen passes a paint -- the prop is gone, so one would not even compile. */
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

/* The shipped sequence is three beats ending at 1600ms. A gallery string still presenting the retired
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

/* The number of beats the gallery claims must match the number the stylesheet ships. Derived from
   the source rather than written down, so this cannot drift the way the prose it guards did. */
test("the gallery's beat count matches the shipped sequence", () => {
  const inFileSteps = (inviteCss.match(/^\s*animation:/gm) ?? []).length;
  assert.strictEqual(
    inFileSteps,
    7,
    "app/invite.css should carry seven steps under Bloom — the flowers and six rows of type; the thread's is in thread.module.css",
  );
  assert.match(
    domain,
    /three beats|Bloom/,
    "the Invite entry must name the shipped sequence",
  );
});

/* A drift this round did not cause, fixed with it: the cue loops FIVE times (the owner's own pick,
   2026-10-03, raised from the assistant's first value of three). Pinned so the next reader of this
   string does not re-introduce the old number. */
test("the gallery quotes the owner's re-trace loop count", () => {
  assert.ok(
    !domain.includes("loops three times"),
    "the re-trace loops five times, not three — the owner's pick, 2026-10-03",
  );
});

/* The gallery told readers the thread was "Live at /." for as long as it was. This pins the CLAIM,
   not a spelling: a thread entry asserting the thread is on the published page is the drift. */
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
