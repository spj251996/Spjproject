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

/* The hero card has two documented options (DESIGN.md → Foundations → Layout → mounted-sheet), so
   the gallery demonstrates BOTH. The painted specimen is the component's default and the documented
   alternative -- it is correct, not stale -- and the unpainted one is what the invitation ships. */
test("the gallery shows a hero specimen of each option", () => {
  /* Matched on what each specimen SELECTS rather than on a prop's spelling. The previous version
     asserted the literal `<MountedSheet hero unbacked>`, against this file's own header -- and that is
     exactly the failure the header names: when `unbacked` became `paint="none"`, a spelling assertion
     would have failed the correct rewrite while passing any mutation that kept the words. */
  const heroSpecimens = [
    ...foundations.matchAll(/<MountedSheet hero([^>]*)>/g),
  ].map((m) => m[1]);
  assert.ok(
    heroSpecimens.length >= 2,
    `expected at least two hero specimens, found ${heroSpecimens.length}`,
  );
  assert.ok(
    heroSpecimens.some((props) => props.trim() === ""),
    "the painted hero specimen must stay: it is the component default and the documented alternative",
  );
  assert.ok(
    heroSpecimens.some((props) => /paint=\{?"none"/.test(props)),
    "the unpainted hero specimen is missing, so the gallery shows only one of the documented options",
  );
});

/* The shipped sequence is three beats ending at 1600ms. A gallery string still presenting the
   painted option's four-beat, 2400ms sequence as the current one is the drift this file exists to
   catch -- not the mention of it as an alternative, which is why the forbidden strings are the ones
   that only make sense as a claim about what ships. */
test("the gallery does not present the painted option's sequence as the current one", () => {
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
        `${name}.tsx still carries "${stale}", which describes the option the invitation does not take`,
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
    2,
    "app/invite.css should carry two steps — the flowers and the type; the thread's is in thread.module.css",
  );
  assert.match(
    domain,
    /three beats/,
    "the Invite entry must name the sequence's beat count, and it is three",
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
