import { familyFit } from "@/app/family-fit";
import {
  Botanical,
  SECTION_PLACEMENT,
} from "@/components/background/botanical";
import { Family } from "@/components/family/family";
import { MountedPair } from "@/components/layout/mounted-pair";
import type { FramePaint } from "@/components/layout/mounted-sheet-frame";
import { type FamilyGroup, familyGroups } from "@/content";

const FAMILY_EYEBROWS: Readonly<Record<FamilyGroup["side"], string>> = {
  bride: "Bride's Family",
  groom: "Groom's Family",
};

function familyGroupBySide(side: FamilyGroup["side"]) {
  const found = familyGroups.find((group) => group.side === side);
  if (found === undefined) {
    throw new Error(
      `sections: no family group with side "${side}" in content/family.ts`,
    );
  }
  return found;
}

/* The id scopes `measure:fit`'s selector. Measured by `familyFit`: any content or type change
   re-runs `npm run measure:fit`. */
export function FamilySection({ paint }: { paint?: FramePaint }) {
  return (
    <section className="relative" id="family">
      <Botanical fit={familyFit} pieces={SECTION_PLACEMENT.family} />
      <MountedPair fit={familyFit} paint={paint}>
        <Family
          eyebrow={FAMILY_EYEBROWS.bride}
          group={familyGroupBySide("bride")}
        />
        <Family
          eyebrow={FAMILY_EYEBROWS.groom}
          group={familyGroupBySide("groom")}
        />
      </MountedPair>
    </section>
  );
}
