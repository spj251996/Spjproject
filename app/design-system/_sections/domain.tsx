import { sampleFamilyGroups } from "@/app/design-system/_data/domain-samples";
import {
  GallerySection,
  type InlineEntry,
  InlineList,
  Specimen,
} from "@/app/design-system/_kit";
import { Family } from "@/components/family/family";
import type { FamilyGroup } from "@/content/types";

const INVITE_ENTRIES: InlineEntry[] = [
  {
    name: "Invite",
    home: "app/page.tsx",
    composes:
      "mounted-sheet with the hero setting · eyebrow · couple names in display-name · date line in date-primary, month spelled out · place line beneath it · ornamental-divider with the sprig mark, sitting at 60 : 40 between the place line and the passage — desktop is the one exception, where the space below the mark holds at space-lg (32px) instead · passage in caption · citation in caption-italic",
    note: "Live at /. The thread that leaves the screen still going — the only thing cueing the scroll — arrives in Phase 5.",
  },
];

const EVENT_INFO_ENTRIES: InlineEntry[] = [
  {
    name: "Event Info",
    home: "app/page.tsx",
    composes:
      "mounted-pair · per sheet: eyebrow, heading-xl heading, date line, address, a divider rule after the heading block (tablet band only), segment plates · per plate: mark, segment line, venue, button-action with map",
    note: "Live at /. Two things an unframed specimen cannot show: at desktop the sheet overrides the frame's largest side padding down to 64px so the venue holds one line — a bounded override, not a change to the ladder in Foundations · Layout — and the events list sits a fixed gap below the heading block rather than centred in the space left over, since a centred list closes to a few pixels of the place line as soon as the venue wraps. Marks → Foundations · Iconography; the map action → Components · UI.",
  },
];

const CONTACT_ENTRIES: InlineEntry[] = [
  {
    name: "Contact",
    home: "app/page.tsx",
    composes:
      "mounted-sheet · eyebrow, heading-xl heading, the sprig mark sized as an ornament (48px on the diagonal, side by side only) · two plates: side eyebrow, name, relationship, number, two button-actions stacked",
    note: "Live at /. Things an unframed specimen cannot show: the plates go side by side on the same window condition mounted-pair does, so one condition serves both; the mark shows only from the landscape-lg switch, the opposite band from Event Info's rule, which is a tablet-band-only ornament and hides again at that same switch; the two actions always stack, never side by side, at every width; the number is the site's one selectable text, which only a real selection proves; and the side eyebrow is load-bearing rather than a label, since the relationship below it is a bare noun. Marks → Foundations · Iconography; the two actions → Components · UI.",
  },
];

const TIMELINE_ENTRIES: InlineEntry[] = [
  {
    name: "Timeline",
    home: "app/page.tsx",
    composes:
      "mounted-sheet in tall mode · eyebrow ('Our traditions') · heading in heading-xl ('The Celebrations') · intro in body · promise line in body-italic · an ordered list of rituals, each opened by the sprig mark on the title's own line, a heading-lg title and a body description",
    note: "Live at /.",
  },
];

const WISHES_ENTRIES: InlineEntry[] = [
  {
    name: "Wishes",
    home: "app/page.tsx",
    composes:
      "eyebrow · passage in body · citation in caption-italic · couple illustration · couple names in heading-script · sign-off lead in caption-italic · sign-off names in caption",
    note: "Live at /. The couple illustration ships (AVIF, WebP fallback).",
  },
];

const NOT_FOUND_ENTRIES: InlineEntry[] = [
  {
    name: "Not found",
    home: "app/not-found.tsx",
    composes:
      "mounted-sheet, the invite's own botanical placement · eyebrow · the page's h1 in heading-xl · button-action with no mark",
    note: "Live at any unmatched path, e.g. /not-a-page. Nothing redirects — the action is the only way out, which is what keeps the screen clear of a time limit.",
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
        id="contact"
        intro="One framed mounted-sheet holding a heading block and two plates, bride's side first."
        mapsTo="Domain Components → Contact"
        title="Domain · Contact"
      >
        <InlineList entries={CONTACT_ENTRIES} />
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
          note="Unframed, as every specimen box is; its rows never reflow, so the gallery's own pair always stacks (Layout → mounted-pair) rather than going side by side. The framed pair, composed by FamilySection in app/page.tsx, is live at / and sits side by side in landscape windows from lg. The samples take the real roster's shape: the bride's two siblings, and the groom's sibling with a spouse and a child — the gallery's only view of the third row — beside a second sibling. Resize across md, lg and xl: diameters and gaps step with the type."
          source="@/components/family/family"
          spec={[
            "eyebrow · heading-xl family name · rows centred, never reflowing (the page wraps the groom's second row below 375px wide; this narrower specimen box may wrap it at 375 too)",
            "portrait uniform · name and relationship each on one line, wrapping within the column where that cannot hold",
            "no line drawn between people — grouping and the labels alone carry every relationship",
          ]}
        >
          <div className="flex flex-col gap-space-md">
            {FAMILY_SHEETS.map(({ eyebrow, group }) => (
              <div
                className="rounded-card bg-surface-elevated p-space-lg shadow-mount md:p-space-2xl lg:p-space-3xl"
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
        <InlineList entries={TIMELINE_ENTRIES} />
      </GallerySection>

      <GallerySection
        id="wishes"
        intro="The airy closing composition."
        mapsTo="Domain Components → Wishes"
        title="Domain · Wishes"
      >
        <InlineList entries={WISHES_ENTRIES} />
      </GallerySection>

      <GallerySection
        id="not-found"
        intro="The screen an unmatched path reaches, on the same frame as every section."
        mapsTo="Domain Components → Not found"
        title="Domain · Not found"
      >
        <InlineList entries={NOT_FOUND_ENTRIES} />
      </GallerySection>
    </>
  );
}
