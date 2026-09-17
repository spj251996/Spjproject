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
        intro="Two family groups, split in two columns on desktop and two screen-feel panels on mobile."
        mapsTo="Domain Components → Family"
        title="Domain · Family"
      >
        <Specimen
          description="The bride's and groom's groups, each a heading, family name and its portraits."
          id="domain-family"
          name="family"
          note="Known gaps: the groom sibling's nested spouse and child do not render yet; group headings come from the family side, as the schema has no relationship field; the thread reads as loose decoration until Phase 5."
          source="@/components/family/family"
          spec="heading-lg group heading · portrait at one scale · bride group first"
        >
          <Family groups={sampleFamilyGroups} />
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
