/* Document ORDER is the claim, not the spelling. The owner settled the sequence
   eyebrow -> names -> line -> date -> place, and the failure mode is the line landing on the wrong
   side of the date, which renders perfectly and is simply wrong. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { withClasses } from "../../scripts/source-classes.ts";

const read = (path: string) => readFileSync(path, "utf8");
const source = readFileSync("app/_sections/invite.tsx", "utf8");

const AT = {
  eyebrow: source.indexOf("type-eyebrow"),
  /* The anchor is `<CoupleNames`; the typeset-names class was retired and is no longer a stable
     anchor. */
  names: source.indexOf("<CoupleNames"),
  line: source.indexOf("data-invite-line"),
  /* The COMPOSITION site, not the definition: `<InviteDate` matches only the JSX usage, where
     `function InviteDate(` sits above the eyebrow and would invert the order this test checks. */
  date: source.indexOf("<InviteDate"),
  place: source.indexOf("data-invite-place"),
};

test("every anchor is present, so the ordering below is not comparing -1s", () => {
  const missing = Object.entries(AT)
    .filter(([, at]) => at === -1)
    .map(([name]) => name);
  assert.deepEqual(missing, []);
});

test("the card reads eyebrow, names, line, date, place", () => {
  assert.deepEqual(
    Object.entries(AT)
      .sort((a, b) => a[1] - b[1])
      .map(([name]) => name),
    ["eyebrow", "names", "line", "date", "place"],
  );
});

test("the line is the invitation's own voice, not a content field", () => {
  assert.match(
    source,
    /joyfully invite you to share in the celebration of their wedding/,
  );
  assert.doesNotMatch(
    source,
    /invite\.(invitationLine|line)\b/,
    "the line moved into content — update this test and PROJECT.md together, or move it back",
  );
});

test("the invite's phone gaps that brought it inside one screen", () => {
  const tokens = read("app/styles/tokens.css");
  assert.match(
    tokens,
    /--invite-names-gap:\s*4px;/,
    "names to line, within a beat",
  );
  assert.equal(
    withClasses(
      read("app/_sections/invite.tsx"),
      "mt-[calc(var(--spacing-space-3xs)+var(--date-place-pull))]",
      "md:mt-[calc(var(--spacing-space-md)+var(--date-place-pull))]",
    ).length,
    1,
    "line to date: space-3xs on a phone, space-md from the tablet",
  );
});

/* One 22px INK gap on a phone held upright: the sentence's margin, the date's, and the rule's fixed,
   non-growing spacer — each the figure that lands the ink at 22, measured. */
test("the 2026-10-14 picks: the invite's one 22px phone gap", () => {
  const invite = readFileSync("app/_sections/invite.tsx", "utf8");
  const PHONE = "[@media(width<48rem)_and_(orientation:portrait)]";
  for (const cls of [
    `${PHONE}:mt-[calc(var(--spacing-space-xs)-2px)]`,
    `${PHONE}:mt-(--date-place-pull)`,
    `${PHONE}:basis-[13px]`,
    `${PHONE}:grow-0`,
  ]) {
    assert.ok(invite.includes(cls), `the invite lost ${cls}`);
  }
});
