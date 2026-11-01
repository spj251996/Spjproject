import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path: string) => readFileSync(path, "utf8");
const tokens = readFileSync("app/styles/tokens.css", "utf8");

test("accent-gold is the owner's deep gold", () => {
  assert.match(
    read("app/styles/tokens.css"),
    /--color-accent-gold:\s*#b88528;/,
  );
});

test("the 2026-10-11 picks: the date's opening, the day's weight, the glow, the padding, the rituals", () => {
  /* The opening is one token: 8px from the tablet, 7px at laptop (8 refused the laptop tier line by
     2px), and 4px on a phone, which keeps the invite inside one screen. */
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
  const module = readFileSync("app/_sections/celebrations.module.css", "utf8");
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
