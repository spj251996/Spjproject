import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

/* THE OWNER'S DESIGN PICKS AND THE INVITE'S ONE-SCREEN VALUES, each pinned where it landed, so none
   can be reverted by a later edit with every gate green. Source assertions, one fact per test, each
   mutation-proven when written. */

const read = (path: string) => readFileSync(path, "utf8");

/* Every quoted string in a source file read as a class list, so a test names the classes a fact
   needs rather than the whole string — a reordered or reflowed list still passes, a dropped class
   does not. */
const classLists = (source: string) =>
  [...source.matchAll(/"([^"\n]*)"/g)].map((match) => match[1].split(/\s+/));
const withClasses = (source: string, ...classes: string[]) =>
  classLists(source).filter((list) =>
    classes.every((name) => list.includes(name)),
  );

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
    read("app/_sections/celebrations.module.css"),
    /\.row:has\(\[data-photo-ready\]\)\s*\{\s*margin-block-end:\s*calc\(var\(--spacing-space-md\) - var\(--spacing-space-xl\)\)/,
  );
});

test("the ritual leaf shows from 64rem only; the phone Malayalam sits right", () => {
  const celebrations = read("app/_sections/celebrations.tsx");
  assert.equal(
    withClasses(celebrations, "text-accent-gold", "max-lg:hidden").length,
    1,
    "the ritual leaf, gold and hidden below 64rem",
  );
  assert.equal(withClasses(celebrations, "max-md:ms-auto").length, 1);
});

test("the invite's day numeral is gold", () => {
  assert.equal(
    withClasses(
      read("app/_sections/invite.tsx"),
      "type-date-day",
      "text-accent-gold",
    ).length,
    1,
  );
});

test("Event Info is two columns at every tier, details left, map disc on the venue", () => {
  const eventInfo = read("app/_sections/event-info.tsx");
  assert.equal(
    withClasses(eventInfo, "grid-cols-[auto_minmax(0,auto)]").length,
    1,
  );
  assert.equal(withClasses(eventInfo, "grid-cols-1").length, 0);
  assert.ok(withClasses(eventInfo, "items-start", "text-left").length > 0);
  assert.equal(
    withClasses(eventInfo, "mt-space-2xs", "-ms-space-sm").length,
    1,
  );
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
    withClasses(names, "w-[2.59em]", "md:w-[2.513em]").length,
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
