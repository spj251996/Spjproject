import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { familyGroups } from "../../content/family.ts";
import type { FamilyMember } from "../../content/types.ts";

const read = (path: string) => readFileSync(path, "utf8");

test("each family's origin is the couple's words", () => {
  assert.deepEqual(
    Object.fromEntries(
      familyGroups.map((group) => [group.familyName, group.origin]),
    ),
    {
      "Edatt Family": "Harinagar, New Delhi",
      "Plackeel Family": "Vadakara, Koothattukulam, Kerala",
    },
  );
});

test("the origin renders directly under the family name, and the rows follow 8px below (4px on a laptop)", () => {
  const source = read("components/family/family.tsx");
  const origin = source.match(
    /<\/h2>\s*<p className="([^"]+)">\s*\{group\.origin\}\s*<\/p>/,
  );
  assert.ok(
    origin,
    "no <p>{group.origin}</p> directly after the family name's h2",
  );
  assert.deepEqual(origin[1].split(" ").sort(), [
    "mt-space-3xs",
    "text-ink-muted",
    "type-caption-italic",
  ]);
  const rows = source.match(/const ROWS_CLASS =\s*"([^"]+)"/)?.[1];
  assert.ok(rows, "no ROWS_CLASS in family.tsx");
  const margins = rows.split(" ").filter((name) => /(^|:)mt-/.test(name));
  assert.deepEqual(margins, [
    "mt-space-2xs",
    "lg:mt-space-3xs",
    "xl:mt-space-2xs",
  ]);
});

/* The laptop step gives back the room the origin line takes (DESIGN.md → Domain Components → Family
   → Spacing): without it the laptop card overruns the frame's laptop cap and `npm run frames` refuses it. */
test("the laptop step tightens the eyebrow-to-name and row gaps", () => {
  const source = read("components/family/family.tsx");
  const name = source.match(
    /<h2 className="([^"]+)">\s*\{group\.familyName\}/,
  )?.[1];
  assert.ok(name, "no h2 carrying the family name");
  assert.deepEqual(
    name.split(" ").filter((c) => /(^|:)mt-/.test(c)),
    ["mt-space-2xs", "lg:mt-space-3xs", "xl:mt-space-2xs"],
  );
  const sheet = source.match(/const SHEET_CLASS =\s*"([^"]+)"/)?.[1];
  assert.ok(sheet, "no SHEET_CLASS in family.tsx");
  assert.deepEqual(
    sheet.split(" ").filter((c) => c.includes("[--rows-gap:")),
    [
      "[--rows-gap:var(--spacing-space-md)]",
      "md:[--rows-gap:var(--spacing-space-sm)]",
      "lg:[--rows-gap:var(--spacing-space-2xs)]",
      "xl:[--rows-gap:var(--spacing-space-sm)]",
    ],
  );
});

/* The couple's portrait glow is keyed on free-text relationship strings, so a rename in the content
   would drop the glow with nothing failing. Read from source because `family.tsx` is JSX, which
   `node --test` cannot load. */
test("the glow's relationships name exactly the bride and the groom in the content", () => {
  const source = readFileSync("components/family/family.tsx", "utf8");
  const set = source.match(/const COUPLE[^=]*= new Set\(\[([^\]]*)\]\)/)?.[1];
  assert.ok(set, "no COUPLE set in family.tsx");
  const couple = [...set.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(couple.sort(), ["Bride", "Groom"]);
  const members: FamilyMember[] = [];
  const walk = (list: readonly FamilyMember[]) => {
    for (const member of list) {
      members.push(member);
      walk(member.family);
    }
  };
  for (const group of familyGroups) walk(group.members);
  const glowing = members.filter((member) =>
    couple.includes(member.relationship),
  );
  assert.deepEqual(
    glowing.map((member) => member.relationship).sort(),
    ["Bride", "Groom"],
    "exactly one Bride and one Groom carry the glow",
  );
});

test("only the couple's portraits glow", () => {
  assert.match(
    read("components/family/family.tsx"),
    /new Set\(\["Bride", "Groom"\]\)/,
  );
});
