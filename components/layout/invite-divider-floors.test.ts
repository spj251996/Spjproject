import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/* Guards the one derivation `ornamental-divider.tsx`'s DIVIDER_MARK_SIZES and `page.tsx`'s
   InvitePassage basis values share but never call as a function: each tier's floors were reduced
   from the retired 27.5px/16.5px by half the mark's growth past the retired drawing's 11px, so the
   block the rule sits in stays the height it always was and the 60:40 split above/below the mark
   survives. Changing one side without the other breaks the ratio silently — tsc, lint, the rest of
   the suite and a green build all stay clean. Desktop is excluded: DESIGN.md → `ornamental-divider`
   states it as the one tier that departs from 60:40 on purpose. */

const dividerSource = readFileSync(
  "components/layout/ornamental-divider.tsx",
  "utf8",
);
const pageSource = readFileSync("app/page.tsx", "utf8");
const sprigSource = readFileSync("components/icons/sprig.tsx", "utf8");

function markHeight(size: number): number {
  const viewBoxMatch = sprigSource.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
  assert.ok(viewBoxMatch, "sprig.tsx must carry its traced viewBox");
  const [, w, h] = viewBoxMatch as unknown as [string, string, string];
  const width = Number(w);
  const height = Number(h);
  const scale = size / Math.hypot(width, height);
  return height * scale;
}

function markSize(mediaFragment: string): number {
  const pattern = new RegExp(
    `size: (\\d+), show: "[^"]*${mediaFragment}[^"]*"`,
  );
  const match = dividerSource.match(pattern);
  assert.ok(match, `expected a DIVIDER_MARK_SIZES entry for ${mediaFragment}`);
  return Number((match as RegExpMatchArray)[1]);
}

/** Pulls every `[prefix:]basis-[Npx]` pair out of one className string. */
function basisValues(className: string): Map<string, number> {
  const values = new Map<string, number>();
  for (const match of className.matchAll(/(?:(\w+):)?basis-\[([\d.]+)px\]/g)) {
    values.set(match[1] ?? "", Number(match[2]));
  }
  return values;
}

function basisAt(values: Map<string, number>, prefix: string): number {
  const value = values.get(prefix);
  assert.ok(value !== undefined, `no ${prefix || "base"}: basis value found`);
  return value as number;
}

// "grow-3" (above) and "grow " (below, no dash) never collide.
const aboveClassMatch = pageSource.match(/className="shrink-0 grow-3 ([^"]+)"/);
const belowClassMatch = pageSource.match(/className="shrink-0 grow ([^"]+)"/);
assert.ok(aboveClassMatch, "could not find InvitePassage's above-mark spacer");
assert.ok(belowClassMatch, "could not find InvitePassage's below-mark spacer");
const aboveBasis = basisValues((aboveClassMatch as RegExpMatchArray)[1]);
const belowBasis = basisValues((belowClassMatch as RegExpMatchArray)[1]);

const TIERS: Array<{
  name: string;
  mediaFragment: string;
  prefix: string;
}> = [
  { name: "phone", mediaFragment: "width<48rem", prefix: "" },
  { name: "tablet", mediaFragment: "48rem<=width<64rem", prefix: "md" },
  { name: "laptop", mediaFragment: "width>=64rem", prefix: "lg" },
];

const EXPECTED_BLOCK: Record<string, number> = {
  phone: 55,
  tablet: 23,
  laptop: 55,
};

test("each tier's rule block holds its recorded total height", () => {
  for (const tier of TIERS) {
    const size = markSize(tier.mediaFragment);
    const above = basisAt(aboveBasis, tier.prefix);
    const below = basisAt(belowBasis, tier.prefix);
    const total = above + markHeight(size) + below;
    assert.ok(
      Math.abs(total - EXPECTED_BLOCK[tier.name]) < 0.05,
      `${tier.name}: expected block ~${EXPECTED_BLOCK[tier.name]}px, got ${total.toFixed(3)}px`,
    );
  }
});

test("each tier holds the 60:40 split, above:total", () => {
  for (const tier of TIERS) {
    const size = markSize(tier.mediaFragment);
    const above = basisAt(aboveBasis, tier.prefix);
    const below = basisAt(belowBasis, tier.prefix);
    const height = markHeight(size);
    const total = above + height + below;
    const ratio = (above + height / 2) / total;
    assert.ok(
      Math.abs(ratio - 0.6) < 0.005,
      `${tier.name}: expected 60% split, got ${(ratio * 100).toFixed(2)}%`,
    );
  }
});
