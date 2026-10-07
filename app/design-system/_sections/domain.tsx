import { sampleFamilyGroups } from "@/app/design-system/_data/domain-samples";
import {
  GallerySection,
  type InlineEntry,
  InlineList,
  Specimen,
} from "@/app/design-system/_kit";
import {
  ThreadHeadSpecimen,
  ThreadInkSpecimen,
  ThreadRetraceSpecimen,
  ThreadTaperSpecimen,
} from "@/app/design-system/_sections/thread-specimens";
import { Family } from "@/components/family/family";
import type { FamilyGroup } from "@/content/types";

const THREAD_ENTRIES: InlineEntry[] = [
  {
    name: "Thread",
    home: "components/thread/page-thread.tsx",
    composes:
      "one page-length SVG over main · ink at --stroke-thread (1.6px) in thread-red, one path per piece · bleed --bleed-thread on the ink · drawing head: 96px (60× the ink), --stroke-thread-head (3.2px) at the tip tapering to the ink's width, thread-red → thread-vermilion → thread-core, halo --halo-thread-head · tapered ends: --length-thread-taper (24px) at the invite's top and Wishes' close, 16 runs down to 0.2px · re-trace: the head's own stack at 89× the ink, glow as eight translucent strokes, --retrace-duration (3.2s), --retrace-settle (1500ms), --retrace-loops (4) and --retrace-speed (845), Foundations · Motion",
    note: "Live at /. A page-length thread measures <main> and cannot render in a specimen frame, so what is shown below is its light — each layer on a stretch of the page's own authored geometry, posed and static. Geometry is authored per aspect band, not per width tier (Interaction · Responsive Behavior).",
  },
];

const INVITE_ENTRIES: InlineEntry[] = [
  {
    name: "Invite",
    home: "app/_sections/invite.tsx",
    composes:
      "mounted-sheet with the hero setting, taking its unpainted option — the type sits on the page's ground with no mount, stock, shadow or cut corner · eyebrow · couple names in display-name · date line in date-primary, month spelled out · place line beneath it · ornamental-divider with the sprig mark, sitting at 60 : 40 between the place line and the passage — desktop is the one exception, where the space below the mark holds at space-lg (32px) instead · passage in caption · citation in caption-italic",
    note: "Live at /. The thread that leaves the screen still going is the page's scroll cue: its resting tip sits at the lower edge, and loops five times once the opening draw has ended, then stops until the next scroll (DESIGN.md → Thread → scroll-cue). A page-length thread cannot render in a specimen frame, so none is shown here. The opening sequence is three beats under the unpainted option — ground, then the invite's own botanical pieces, then the type, then the thread — ending at 1600ms.",
  },
];

const EVENT_INFO_ENTRIES: InlineEntry[] = [
  {
    name: "Event Info",
    home: "app/_sections/event-info.tsx",
    composes:
      "mounted-pair · per sheet: eyebrow, heading-xl heading, date line, address, a divider rule after the heading block (tablet band only), segment plates · per plate: mark, segment line, venue, button-action with map",
    note: "Live at /. Two things an unframed specimen cannot show: at desktop the sheet overrides the frame's largest side padding down to 64px so the venue holds one line — a bounded override, not a change to the ladder in Foundations · Layout — and the events list sits a fixed gap below the heading block rather than centred in the space left over, since a centred list closes to a few pixels of the place line as soon as the venue wraps. Marks → Foundations · Iconography; the map action → Components · UI.",
  },
];

const CONTACT_ENTRIES: InlineEntry[] = [
  {
    name: "Contact",
    home: "app/_sections/contact.tsx",
    composes:
      "mounted-sheet · eyebrow, heading-xl heading, the sprig mark sized as an ornament (48px on the diagonal, side by side only) · two plates: side eyebrow, name, relationship, two button-actions stacked",
    note: "Live at /. Things an unframed specimen cannot show: the plates go side by side on the same window condition mounted-pair does, so one condition serves both; the mark shows only from the landscape-lg switch, the opposite band from Event Info's rule, which is a tablet-band-only ornament and hides again at that same switch; the two actions always stack, never side by side, at every width; no number is printed, so nothing on the page is selectable — the number is copyable only from the Call action's own iOS long-press sheet, which comes from the link rather than a selection, and WhatsApp offers none since its `wa.me` href would put the number inside a copied link; and the side eyebrow is load-bearing rather than a label, since the relationship below it is a bare noun. Marks → Foundations · Iconography; the two actions → Components · UI.",
  },
];

const TIMELINE_ENTRIES: InlineEntry[] = [
  {
    name: "Timeline",
    home: "app/_sections/celebrations.tsx",
    composes:
      "mounted-sheet in tall mode · eyebrow ('Our traditions') · heading in heading-xl ('The Celebrations') · intro in body · promise line in body-italic · an ordered list of rituals, each opened by the sprig mark on the title's own line, a heading-lg title and a body description",
    note: "Live at /.",
  },
];

const WISHES_ENTRIES: InlineEntry[] = [
  {
    name: "Wishes",
    home: "app/_sections/wishes.tsx",
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
        id="thread"
        intro="The page's one spine: a single red line from the invite to the closing wishes."
        mapsTo="Domain Components → Thread → thread-overlay"
        title="Domain · Thread"
      >
        <InlineList entries={THREAD_ENTRIES} />

        <Specimen
          description="The ink: one line in thread-red at the ink's width, with the bleed round it."
          id="thread-ink"
          name="ink and bleed"
          note="Both panels are one mid-page connector in the wide band's own geometry, at its own size. The bleed is present in every state the page has; the left panel switches it off only to show what it adds."
          source="components/thread/thread.module.css · .pageInk"
          spec={[
            "ink · --color-thread-red at --stroke-thread (1.6px), round caps",
            "bleed · --bleed-thread, three drop-shadows of thread-vermilion at 68% / 44% / 30% and 0.875px / 3px / 8.25px, offset on neither axis, on each piece's ink",
          ]}
        >
          <ThreadInkSpecimen />
        </Specimen>

        <Specimen
          description="The drawing head: while a piece draws, its leading end carries light that fades from the ink's red at its tail to a hot orange at its tip, wider at the tip, with a halo round it."
          id="thread-head"
          name="drawing head"
          note="Posed on a stretch drawn partway, over the same ink, on a mid-page connector in the wide band's own geometry. The head is a stack of abutting opaque butt-capped steps, each a polyline of only its own run, with the colour stepped along the arc; the halo is one filter on the one group holding them all, never on a step."
          source="components/thread/thread-light.ts · headSegments"
          spec={[
            "length · 60× the ink, 96px",
            "colour · thread-red at the tail, thread-vermilion in the middle, thread-core at the tip, interpolated in OKLCH",
            "width · --stroke-thread-head (3.2px) at the tip, tapering to --stroke-thread at the tail",
            "steps · max(ceil(length / 8), ceil(rampSpan / 2)), capped at 48 — 14 at the shipped values",
            "halo · --halo-thread-head, thread-vermilion at 4× the bleed's shape: 68% / 44% / 30% at 3.5px / 12px / 33px",
          ]}
        >
          <ThreadHeadSpecimen />
        </Specimen>

        <Specimen
          description="The tapered ends: the thread's two static free ends, the invite's top terminal and Wishes' closing end, narrow to a point instead of stopping at a round cap."
          id="thread-taper"
          name="tapered ends"
          note="Each end is shown at its own size and magnified 4×; the magnified view is a crop, not a different drawing, and it clips the halo and the line at its own edge, which is the crop's and not the taper's shape. The live drawing end does not taper, so nothing here appears under the head."
          source="components/thread/thread-light.ts · taperSegments"
          spec={[
            "length · --length-thread-taper (24px)",
            "mechanism · 16 butt-capped runs, each a little narrower than the one inside it, from --stroke-thread down to a 0.2px floor, with the ink cut away beneath them",
            "colour · thread-red, with the bleed on one filter over the group of runs",
          ]}
        >
          <ThreadTaperSpecimen />
        </Specimen>

        <Specimen
          description="The re-trace: a lit segment runs along the thread once it is already drawn, on a loop. It is the page's resting motion and its scroll cue."
          id="thread-retrace"
          name="re-trace"
          note="A single frame partway through a loop, posed on a mid-page connector; the page loops it, the gallery does not. Its glow is not the head's: the head's halo is one filter, the re-trace's is eight translucent strokes with no filter at all, because the re-trace can run on three or four stretches at once and a filter that wide does not survive that."
          source="components/thread/thread-light.ts · retraceSegments, retraceGlow"
          spec={[
            "core · the head's own stack and values, at a peak of 89× the ink (142px), growing from nothing and shrinking back to nothing over a loop",
            "glow · eight thread-vermilion strokes under the core, 100 / 56 / 38 / 26 / 18 / 13 / 9 and 6px wide, widest and faintest first, scaled by 0.77",
            "cadence · --retrace-speed (845) px of thread per second, so every stretch moves at one rate whatever its length · --retrace-settle (1500ms) of stillness before it loops · --retrace-loops (4) whole loops of the LONGEST stretch sets the budget, and every shorter stretch fits whole loops into the same window, so they all stop together · --retrace-duration (3.2s) is the fallback cadence when no speed is set",
          ]}
        >
          <ThreadRetraceSpecimen />
        </Specimen>
      </GallerySection>

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
          note="Unframed, as every specimen box is; its rows never reflow, so the gallery's own pair always stacks (Layout → mounted-pair) rather than going side by side. The framed pair, composed by FamilySection in app/_sections/family.tsx, is live at / and sits side by side in landscape windows from lg. The samples take the real roster's shape: the bride's two siblings, and the groom's sibling with a spouse and a child — the gallery's only view of the third row — beside a second sibling. Resize across md, lg and xl: diameters and gaps step with the type."
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
