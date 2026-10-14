import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

/* THE OWNER'S PICKS FROM /preview ROUNDS 7-9 (2026-10-11) AND THE INVITE'S ONE-SCREEN ROUND
   (2026-10-14), each pinned where it landed. They shipped from the section files with no test
   behind them, so any one of them could be reverted by a later edit with every gate green. Source
   assertions, one fact per test, each mutation-proven when written. */

const read = (path: string) => readFileSync(path, "utf8");

test("accent-gold is the owner's deep gold", () => {
  assert.match(
    read("app/styles/tokens.css"),
    /--color-accent-gold:\s*#b88528;/,
  );
});

test("the stacked ampersand is lifted above centre", () => {
  assert.match(
    read("components/ui/couple-names.tsx"),
    /const AMPERSAND_LIFT = 24;/,
  );
});

test("a photographed ritual closes to space-md from 64rem", () => {
  assert.match(
    read("app/celebrations.module.css"),
    /\.row:has\(\[data-photo-ready\]\)\s*\{\s*margin-block-end:\s*calc\(var\(--spacing-space-md\) - var\(--spacing-space-xl\)\)/,
  );
});

test("the ritual leaf shows from 64rem only; the phone Malayalam sits right", () => {
  const celebrations = read("app/_sections/celebrations.tsx");
  assert.match(
    celebrations,
    /className="shrink-0 self-center text-accent-gold max-lg:hidden"/,
  );
  assert.match(celebrations, /leading-tight max-md:ms-auto"/);
});

test("the invite's day numeral is gold", () => {
  assert.match(
    read("app/_sections/invite.tsx"),
    /type-date-day col-start-3 row-start-2 justify-self-center text-accent-gold/,
  );
});

test("Event Info is two columns at every tier, details left, map disc on the venue", () => {
  const eventInfo = read("app/_sections/event-info.tsx");
  assert.match(eventInfo, /grid-cols-\[auto_minmax\(0,auto\)\]/);
  assert.doesNotMatch(eventInfo, /grid-cols-1\b/);
  assert.match(eventInfo, /flex min-w-0 flex-col items-start text-left/);
  assert.match(eventInfo, /mt-space-2xs -ms-space-sm/);
});

test("only the couple's portraits glow", () => {
  assert.match(
    read("components/family/family.tsx"),
    /new Set\(\["Bride", "Groom"\]\)/,
  );
});

test("the phone names are 40% larger than the tier's 1.85em, both layouts", () => {
  const names = read("components/ui/couple-names.tsx");
  assert.equal(
    (names.match(/w-\[2\.59em\] md:w-\[2\.513em\]/g) ?? []).length,
    2,
    "the stacked lockup's phone width — 1.85em x 1.40 — in both its layout arms",
  );
});

test("the invite's phone gaps that brought it inside one screen", () => {
  const tokens = read("app/styles/tokens.css");
  assert.match(
    tokens,
    /--invite-names-gap:\s*4px;/,
    "names to line, within a beat",
  );
  assert.match(
    read("app/_sections/invite.tsx"),
    /mt-\[calc\(var\(--spacing-space-3xs\)\+var\(--date-place-pull\)\)\] md:mt-\[calc\(var\(--spacing-space-md\)\+var\(--date-place-pull\)\)\]/,
    "line to date: space-3xs on a phone, space-md from the tablet",
  );
});
