import type { ReactNode } from "react";
import {
  sampleFamilyGroups,
  sampleRituals,
  sampleRitualsAllUpcoming,
} from "@/app/design-system/_data/domain-samples";
import {
  GallerySection,
  type InlineEntry,
  InlineList,
  Specimen,
} from "@/app/design-system/_kit";
import { Family } from "@/components/family/family";
import { Timeline } from "@/components/timeline/timeline";
import type { FamilyGroup } from "@/content/types";

interface VariantProps {
  label: string;
  children: ReactNode;
}

function Variant({ label, children }: VariantProps) {
  return (
    <div className="flex flex-col gap-space-2xs">
      {children}
      <span className="type-caption text-ink">{label}</span>
    </div>
  );
}

const INVITE_ENTRIES: InlineEntry[] = [
  {
    name: "Invite",
    home: "app/_composition/sections.tsx",
    composes:
      "mounted-sheet with the hero setting · eyebrow · couple names in display-name · date line in date-primary · betrothal block",
    note: "Live at /. Its scroll cue arrives with the Phase 5 thread.",
  },
];

const EVENT_INFO_ENTRIES: InlineEntry[] = [
  {
    name: "Event Info",
    home: "app/_composition/sections.tsx",
    composes:
      "mounted-pair · per sheet: heading-script heading, date line, address, divider where the layout shows one, segment plates · per plate: mark, segment line, venue, button-action with map",
    note: "Live at /. Marks → Foundations · Iconography; the map action → Components · UI.",
  },
];

const WISHES_ENTRIES: InlineEntry[] = [
  {
    name: "Wishes",
    home: "Not composed yet",
    composes:
      "the contrast stock · passage in heading-xl · attribution in caption · illustration · couple names in the script face · wishes line in body",
    note: "The couple illustration has no asset.",
  },
];

function sampleGroupBySide(side: FamilyGroup["side"]) {
  const found = sampleFamilyGroups.find((group) => group.side === side);
  if (found === undefined) {
    throw new Error(`domain-samples: no family group with side "${side}"`);
  }
  return found;
}

const BRIDE_SHEET = {
  eyebrow: "Bride's Family",
  group: sampleGroupBySide("bride"),
};
const GROOM_SHEET = {
  eyebrow: "Groom's Family",
  group: sampleGroupBySide("groom"),
};
const FAMILY_SHEETS = [BRIDE_SHEET, GROOM_SHEET];

/* Family's rows never reflow, so its unframed specimen always stacks (Layout → mounted-pair →
   Without a fit) rather than toggling to a side-by-side form at lg. `MountedPair` takes no
   breakpoint, so this hand-built stacked sheet is the specimen's only form; the side-by-side pair
   is the framed page composition, not reproduced here. */

export function DomainSections() {
  return (
    <>
      <GallerySection
        id="invite"
        intro="The opening screen: an airy composition framed to the window."
        mapsTo="Domain Components → Invite"
        title="Domain · Invite"
      >
        <InlineList entries={INVITE_ENTRIES} />
      </GallerySection>

      <GallerySection
        id="event-info"
        intro="A dense composition: one framed mounted-pair holding the two events, betrothal first."
        mapsTo="Domain Components → Event Info"
        title="Domain · Event Info"
      >
        <InlineList entries={EVENT_INFO_ENTRIES} />
      </GallerySection>

      <GallerySection
        id="family"
        intro="Two family groups in one framed mounted-pair, bride sheet first."
        mapsTo="Domain Components → Family"
        title="Domain · Family"
      >
        <Specimen
          description="Each sheet is one Family: its side as an eyebrow, the family name, then rows of portraits — the parents, the children, and a child's own children beneath that child and their spouse."
          id="domain-family"
          name="family"
          note="Unframed, as every specimen box is; its rows never reflow, so the gallery's own pair always stacks (Layout → mounted-pair) rather than going side by side. The framed pair, composed by FamilySection in app/_composition/sections.tsx, is live at / and sits side by side in landscape windows from lg. The samples take the real roster's shape: the bride's two siblings, and the groom's sibling with a spouse and a child — the gallery's only view of the third row — beside a second sibling. Resize across md and lg: diameters and gaps step with the type."
          source="@/components/family/family"
          spec={[
            "eyebrow · heading-script family name · rows centred, never reflowing (the page wraps the groom's second row below 375px wide; this narrower specimen box may wrap it at 375 too)",
            "portrait uniform at 72 / 112 / 88px (phone / tablet / laptop) · name and relationship each on one line, wrapping within the column where that cannot hold",
            "gold stroke-divider couple line between every couple, stopping short of both rims",
            "bride's siblings space-2xl / space-4xl / space-4xl apart · groom's space-md / space-2xl / space-2xl (phone / tablet / laptop)",
          ]}
        >
          <div className="flex flex-col gap-space-md">
            {FAMILY_SHEETS.map(({ eyebrow, group }) => (
              <div
                className="bg-surface-elevated p-space-lg shadow-mount md:p-space-2xl lg:p-space-3xl"
                key={group.id}
              >
                <Family eyebrow={eyebrow} group={group} />
              </div>
            ))}
          </div>
        </Specimen>
      </GallerySection>

      <GallerySection
        id="timeline"
        intro="The one section that scrolls to its natural length."
        mapsTo="Domain Components → Timeline"
        title="Domain · Timeline"
      >
        <Specimen
          description="The rituals as timeline-node instances alternating either side of a vertical spine."
          id="domain-timeline"
          name="timeline"
          note="Two samples at different node counts. The spine is the interim gold line until Phase 5, and no sample opens a gallery."
          source="@/components/timeline/timeline"
          spec="alternating nodes · single column on mobile · accent-gold spine at stroke-divider"
        >
          <div className="flex flex-col gap-space-2xl">
            <Variant label="Four rituals, mixed status">
              <Timeline
                rituals={sampleRituals}
                title="Placeholder Ritual Timeline — Mixed Status"
              />
            </Variant>
            <Variant label="Three rituals, all upcoming">
              <Timeline
                rituals={sampleRitualsAllUpcoming}
                title="Placeholder Ritual Timeline — All Upcoming"
              />
            </Variant>
          </div>
        </Specimen>
      </GallerySection>

      <GallerySection
        id="wishes"
        intro="The airy closing composition, on the green stock."
        mapsTo="Domain Components → Wishes"
        title="Domain · Wishes"
      >
        <InlineList entries={WISHES_ENTRIES} />
      </GallerySection>
    </>
  );
}
