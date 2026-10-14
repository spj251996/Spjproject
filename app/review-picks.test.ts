import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

/* THE OWNER'S AND THE COUPLE'S REVIEW PICKS, CHECKED WHERE THEY LANDED. Each was decided on `/preview`,
   retired 2026-10-14; these assertions moved here from its route test when the route went, because a
   decided value with no guard reads as settled and drifts the first time someone tidies the file.
   DESIGN.md → Iteration Notes → Open Decisions carries each pick and its alternatives. */

const tokens = readFileSync("app/styles/tokens.css", "utf8");

test("/preview is retired", () => {
  assert.ok(!existsSync("app/preview"), "app/preview is back");
});

test("the 2026-10-10 picks: the ritual title's size and the ampersand's scale", () => {
  assert.deepStrictEqual(
    [...tokens.matchAll(/--text-heading-md:\s*(\d+)px/g)].map((m) => m[1]),
    ["18", "20", "18", "21"],
  );
  assert.match(
    readFileSync("components/ui/couple-names.tsx", "utf8"),
    /const AMPERSAND_SCALE = 0\.65;/,
  );
});

test("the 2026-10-11 picks: the date's opening, the day's weight, the glow, the padding, the rituals", () => {
  /* The opening is one token: 8px from the tablet, 7px at laptop (8 refused the compact-touchscreen
     tier line by 2px), and 4px on a phone since the invite came back inside one screen. */
  assert.match(
    tokens,
    /--date-weekday-pull:\s*calc\(var\(--date-open\) - 5px\);/,
  );
  assert.deepStrictEqual(
    [...tokens.matchAll(/--date-open:\s*(\d+)px;/g)].map((m) => m[1]),
    ["4", "8", "7", "8"],
    "the date's opening by tier — phone, tablet, laptop, desktop",
  );
  assert.match(
    readFileSync("app/_sections/invite.tsx", "utf8"),
    /mt-\[calc\(var\(--spacing-space-3xs\)\+var\(--date-open\)-var\(--date-place-pull\)\)\]/,
  );
  assert.match(tokens, /--text-date-day--font-weight:\s*400;/);
  assert.match(tokens, /--shadow-glow-couple:\s*0 0 14px 3px/);
  assert.match(
    readFileSync("components/family/family.tsx", "utf8"),
    /glow=\{COUPLE\.has\(member\.relationship\)\}/,
  );
  assert.match(tokens, /--tall-inline-phone:\s*36px;/);
  const module = readFileSync("app/celebrations.module.css", "utf8");
  const text = module.slice(
    module.indexOf(".text {"),
    module.indexOf("}", module.indexOf(".text {")),
  );
  assert.match(text, /text-align:\s*start/, "the rituals left-aligned");
  assert.match(
    readFileSync("app/_sections/celebrations.tsx", "utf8"),
    /mt-space-sm w-full text-end/,
  );
});

test("the 2026-10-14 picks: the progress line — 2px on a phone, 3px up, the soft glow", () => {
  assert.match(tokens, /--progress-height: 3px;/);
  assert.match(tokens, /@variant max-md \{[^}]*--progress-height: 2px;[^}]*\}/);
  assert.match(
    tokens,
    /--progress-glow: drop-shadow\(\s*0 0 2px color-mix\(in srgb, var\(--color-thread-vermilion\) 55%, transparent\)\s*\);/,
  );
});

/* One 24px INK gap on a phone held upright: the sentence's margin, the date's, and the rule's fixed,
   non-growing spacer — each the figure that lands the ink at 24, measured. */
test("the 2026-10-14 picks: the invite's one 24px phone gap", () => {
  const invite = readFileSync("app/_sections/invite.tsx", "utf8");
  const PHONE = "[@media(width<48rem)_and_(orientation:portrait)]";
  for (const cls of [
    `${PHONE}:mt-space-xs`,
    `${PHONE}:mt-[calc(var(--spacing-space-3xs)/2+var(--date-place-pull))]`,
    `${PHONE}:basis-[15px]`,
    `${PHONE}:grow-0`,
  ]) {
    assert.ok(invite.includes(cls), `the invite lost ${cls}`);
  }
});

test("the 2026-10-14 picks: Event Info's natural phone rhythm", () => {
  const eventInfo = readFileSync("app/_sections/event-info.tsx", "utf8");
  for (const cls of [
    "[@media(width<48rem)]:mt-[calc(var(--spacing-space-sm)+2.5px)]",
    "mt-[calc(var(--spacing-space-lg)+2px)]",
    "gap-y-[calc(var(--spacing-space-md)+2px)]",
  ]) {
    assert.ok(eventInfo.includes(cls), `Event Info lost ${cls}`);
  }
});
