/* Document ORDER is the claim, not the spelling. The owner settled the sequence
   eyebrow -> names -> line -> date -> place, and the failure mode is the line landing on the wrong
   side of the date, which renders perfectly and is simply wrong. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync("app/_sections/invite.tsx", "utf8");

const AT = {
  eyebrow: source.indexOf("type-eyebrow"),
  names: source.indexOf("type-display-name"),
  line: source.indexOf("data-invite-line"),
  date: source.indexOf("<PrimaryDate"),
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
  assert.match(source, /invite you to celebrate our wedding/);
  assert.doesNotMatch(
    source,
    /invite\.(invitationLine|line)\b/,
    "the line moved into content — update this test and PROJECT.md together, or move it back",
  );
});
