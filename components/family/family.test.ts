import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { familyGroups } from "../../content/family.ts";
import type { FamilyMember } from "../../content/types.ts";

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
