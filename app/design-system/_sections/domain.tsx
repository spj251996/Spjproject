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
  RuleList,
  Specimen,
} from "@/app/design-system/_kit";
import { Family } from "@/components/family/family";
import { Timeline } from "@/components/timeline/timeline";

/* curate-gallery — Bucket 4, the five Domain sections, in DESIGN.md document order
   (curate-gallery → section-spine.md § 14–18). One module for the whole bucket, per the skill's pinned `sections/`
   structure ("exactly 5 files — the count is law").

   Two [standalone] entries (Family, Timeline) render the real production component live, fed
   placeholder data from _data/domain-samples.ts. The three [inline] entries (Invite, Event Info,
   Wishes) are page-bound compositions with no component file of their own — LISTED via InlineList,
   never recreated (verification.md: "[inline] compositions are listed in an InlineList (never
   recreated)"). Invite and Event Info name app/_composition/sections.tsx as their home — the page's
   composition module, which DESIGN.md → Domain Components permits an inline section to sit in — and
   render live in the real page composition from there. Wishes still names app/page.tsx and is not
   yet composed there — later-phase work, not fixed here.

   Neither live component is position: fixed, so neither is wrapped in a ChromeFrame — per its
   own contract ("omit for flow content"), the frame's translateZ(0) trick exists only to contain a
   fixed-position child, which neither is; they render at their natural in-flow height instead.
   Family and Timeline each carry a section-anchored thread segment for the documented reason both
   components' own comments give: thread-overlay is position: fixed and cannot anchor to page content,
   so the thread reads as a disconnected decoration here — a knowingly deferred defect, owned by
   the Phase 5 thread rebuild, rendered honestly, not fixed or worked
   around. */

interface VariantProps {
  /** Caption naming what this cell shows. */
  label: string;
  children: ReactNode;
}

function Variant({ label, children }: VariantProps) {
  return (
    <div className="flex flex-col gap-space-2xs">
      {children}
      <span className="type-body text-ink">{label}</span>
    </div>
  );
}

/* § 14 — Invite, tagged [inline] since the interlude (2026-09-15). Listed only, per the settled
   treatment — never recreated. Its lead line is NOT repeated here — the section intro carries it. */
const INVITE_ENTRIES: InlineEntry[] = [
  {
    name: "Invite",
    home: "app/_composition/sections.tsx",
    composes:
      'Fills the first screen on every upright phone, tablet and laptop window through the frame mounted-sheet carries, with the hero setting. Nothing is ever hidden to make the section fit, the betrothal block included: a window too short for the content, such as a phone held sideways, scrolls the page rather than the section scrolling internally. An eyebrow opens the composition above the couple names in the script face, with no quote — the closing passage in Wishes carries that role. Couple names are the focal element, in the role\'s three-line portrait form (each name on its own line, "&" between them at 0.5em, 0.9 line spacing) on upright windows and one line in landscape; the wedding date and city follow in date-primary at primary weight, not as a subordinate line. The month abbreviates below breakpoints.md — "Jan" on phones, the full month name from tablet up; the weekday always renders whole, and both spellings render with CSS showing one so first paint is already correct and the hidden one is never announced to assistive technology. Gaps within the stack: space-lg (32px) eyebrow to names and date to betrothal at every tier; names to date holds the same 32px below breakpoints.lg, dropping to space-sm (16px) from it up, where the names are one line — nothing else sits between the names and the date. The betrothal block sits beneath as a labelled three-line unit — ceremony name, date, city — carrying less visual weight than the wedding block, receding by size, weight or tone; the two must never read as equally weighted. The thread draws into view along a predefined curve, settles near the lower portion of the screen, and leaves scroll-cue behind, continuing past the viewport rather than disappearing — the one major animated gesture on the page.',
    note: "The thread is not mounted during Phase 4, so the section carries no scroll cue until the thread lands in Phase 5 — a dated, recorded gap, not an oversight. mounted-sheet renders live, unframed, at Foundations · Layout; the frame itself is on the page at /.",
  },
];

/* § 15 — Event Info, tagged [inline]. Listed only, per the settled treatment — never recreated. Its
   lead line is NOT repeated here — the section intro carries it. */
const EVENT_INFO_ENTRIES: InlineEntry[] = [
  {
    name: "Event Info",
    home: "app/_composition/sections.tsx",
    composes:
      'The section owns the content and the order; the pair owns the mount, the reveal, the frame and the stacking. No section heading — each sheet leads with its own. Each sheet, centred, in order: the heading, an h2 in heading-script and ink — "Betrothal" for the engagement, "Wedding" for the wedding — keyed by event id at the composition site and shorter than the content model\'s formal name, an event with no heading failing the build; the date line 8px below in date-primary, its ordinal small, raised and taking no line height, the month abbreviated below breakpoints.md as the invite\'s; the event\'s address 4px below in heading-lg and ink, in the city\'s place; then, on stacked sheets from breakpoints.md up only, a short divider 64px wide with 32px above and below — below breakpoints.md and side by side there is no rule, and the list stands 32px below the heading block; then the segments, an ordered list centred at its own width, entries 32px apart with no divider between them. The address is named once per event: derived from the segments at the composition site, with segments at different addresses or a missing one failing the build; it stays on one line where it fits and otherwise breaks only after the locality — "Paroppadi, / Kozhikode, Keralam". Each segment is a plate: its mark, then the segment line, the venue and the map action, with no address line. The segment line is heading-lg in ink — the time, a small gold diamond, and the label as written in content, "10:00 AM ◆ Church Betrothal"; the diamond is a 6px square turned on its point in accent-gold with 8px either side, hidden from assistive technology, which hears "10:00 AM, Church Betrothal"; the diamond and the whole label never break — the only break is after the time, and a wrapped line is balanced. The venue is body in ink, wrapped so no lone last word sits on its own line, every hyphenated word kept whole, and not balanced. The map action is button-action carrying the map mark, 8px below the venue, named Map, <venue>. Where the mark sits follows the pair\'s layout, decided by the same window condition that sets the pair side by side: side by side, beside — in its own column shared by both entries, as wide as the sheet\'s widest mark, 24px from left-aligned details, dropped 12px to meet the segment line\'s cap height; stacked, above — 16px above the details, the whole entry centred on it. Mark size on the diagonal: stacked 72 / 96 / 112px across phone, tablet and laptop, side by side 88px; exactly one mark shows per segment at any window, and none is ever clipped. Primary is the heading block; each segment\'s line, venue and map action follow it. The segment line shares heading-lg with the address; on stacked sheets from breakpoints.md the rule is what holds the two blocks apart. Marks by segment id, chosen at the composition site and failing the build when missing: engagement-church → betrothal, wedding-church → wedding, engagement-reception → lunch, wedding-reception → reception.',
    note: "Entrance motion and the thread's passage through the section are open decisions for Phase 5, and whether a sheet changes as its event passes is deferred to Phase 7 (DESIGN.md → Iteration Notes → Open Decisions). The pair itself renders live, unframed, at Foundations · Layout; its segment marks at Foundations · Iconography; the map action at Components · UI.",
  },
];

/* § 16 — Family. The doc's four bullets, its last two merged. Its lead line is NOT repeated here —
   the section intro carries it. */
const FAMILY_RULES = [
  "Each group heads with the relationship in heading-lg, the family name directly beneath, then the members in roster order, bride group first.",
  "A sibling's cluster ALWAYS wraps, at every viewport and not as a responsive behaviour: sibling and spouse share one row, the child centres beneath them. Three-in-a-row reads as three peers and hides the relationship the wrap draws.",
  "Every portrait renders at one scale; the groom's column runs taller because his roster is longer, and that asymmetry is accepted rather than balanced.",
  "Grouping and text labels carry the relationships — no drawn connectors, no tree lines.",
  "portrait instances appear first with no thread interaction; as names resolve, the thread wraps the bride side, then extends to connect the groom side, ending with both sides joined under slight glow emphasis — the one key interaction on the page.",
];

/* § 17 — Timeline. All four of the doc's bullets; the node-count bullet is what the two demo samples
   below exist to prove — including the all-upcoming state Ship 1 actually launches with. Its lead
   line is NOT repeated here — the section intro carries it. */
const TIMELINE_RULES = [
  "timeline-node instances alternate left and right on desktop and stack single-column on mobile.",
  "INTERIM until Phase 5: the spine is a plain vertical line in accent-gold at stroke-divider, NOT the thread — a structural rule on the content layer. Phase 5 replaces it with the thread's own generated segment.",
  "Nodes appear progressively and activate as they enter view.",
  "Density balances readability against total scroll length — neither compact stacking nor whitespace that breaks flow.",
  "Node count is not fixed; the composition takes however many rituals exist.",
];

/* § 18 — Wishes, tagged [inline]. Listed only, per the settled treatment — never recreated. */
const WISHES_ENTRIES: InlineEntry[] = [
  {
    name: "Wishes",
    home: "app/page.tsx",
    composes:
      "A single centred stack, in order: passage, attribution, illustration, couple names, wishes line — the same shape on desktop and mobile. Quotation and couple names in heading-xl and the script face; the passage carries a rendered attribution beneath it in caption, never unattributed and never at the size of the passage it attributes; the wishes line in body. Carries no date and no city, both of which appear in Invite and Event Info — this section is emotional closure rather than information. A couple illustration enters once with a subtle fade or scale. The thread slows and settles, looping loosely around the illustration, then rests with glow faded to subtle — no continuous motion remains. This section takes the contrast treatment, already catalogued at Foundations · Colors: its base is surface-contrast, its text ink-on-contrast, and its thread the three-layer glow.",
    note: "Not yet composed — app/page.tsx does not carry it yet, later-phase work rather than a defect. The couple illustration itself has no component or asset anywhere in code yet, so nothing exists to list beyond the page it would compose into.",
  },
];

export function DomainSections() {
  return (
    <>
      <GallerySection
        id="invite"
        intro="Full-viewport opening, airy composition, framed to the window. No internal scrolling — a window too short for the content scrolls the page instead."
        mapsTo="Domain Components → Invite"
        title="Domain · Invite"
      >
        <InlineList entries={INVITE_ENTRIES} />
      </GallerySection>

      <GallerySection
        id="event-info"
        intro="Dense composition. One framed mounted-pair holding the two events, betrothal first — left when the sheets sit side by side, top when they stack."
        mapsTo="Domain Components → Event Info"
        title="Domain · Event Info"
      >
        <InlineList entries={EVENT_INFO_ENTRIES} />
      </GallerySection>

      <GallerySection
        id="family"
        intro="Two family groups in a two-column split on desktop, two screen-feel panels on mobile."
        mapsTo="Domain Components → Family"
        title="Domain · Family"
      >
        <RuleList rules={FAMILY_RULES} />

        <Specimen
          description="Two family groups, bride's and groom's, each a heading, family name, and a row of portrait instances joined by the thread's one scripted gesture."
          id="domain-family"
          name="family"
          source="@/components/family/family"
          spec={[
            "Client boundary, forced by the one discrete-duration transition on the page (Foundations · Motion, duration-slow) firing once as the section enters view — full reasoning in the component's own header comment.",
            "Live, in flow, unframed: the section is not position: fixed.",
            "The thread reads as a squiggle passing under the group rather than wrapping bride-to-groom — the same knowingly deferred defect as Components · Shell, rendered honestly, not fixed here.",
            "Group headings show the relative side rather than a documented relationship, and member order follows the content array as-authored: both already recorded in the component's own header comment as schema gaps, not new here.",
            "Every sample portrait is null, so image-placeholder shows throughout — no portrait photography exists yet.",
          ]}
        >
          <Family groups={sampleFamilyGroups} />
        </Specimen>
      </GallerySection>

      <GallerySection
        id="timeline"
        intro="The deliberate exception to one-viewport composition: it scrolls to its natural length."
        mapsTo="Domain Components → Timeline"
        title="Domain · Timeline"
      >
        <RuleList rules={TIMELINE_RULES} />

        <Specimen
          description="The ritual sequence as a vertical spine, alternating nodes left and right of the thread — shown at two different node counts so the composition reads as taking however many rituals exist, not a fixed set."
          id="domain-timeline"
          name="timeline"
          source="@/components/timeline/timeline"
          spec={[
            "Client boundary, forced by the open-gallery state shared between the node list and the modal — full reasoning in the component's own header comment.",
            "No min-h-dvh: the one section that scrolls to its natural length rather than composing around a viewport.",
            "The spine is section-anchored, the same knowingly deferred defect as Components · Shell and Family, rendered honestly, not fixed here.",
            "Neither sample below ever opens a gallery: a completed ritual with no images gets no gallery action, and no ritual photography exists yet to populate one.",
          ]}
        >
          <div className="flex flex-col gap-space-2xl">
            <Variant label="Four rituals, mixed status — 2 completed, 2 upcoming">
              <Timeline
                rituals={sampleRituals}
                title="Placeholder Ritual Timeline — Mixed Status"
              />
            </Variant>
            <Variant label="Three rituals, all upcoming — the state Ship 1 launches with">
              <Timeline
                rituals={sampleRitualsAllUpcoming}
                title="Placeholder Ritual Timeline — All Upcoming (Ship 1 Launch)"
              />
            </Variant>
          </div>
        </Specimen>
      </GallerySection>

      <GallerySection
        id="wishes"
        intro="Airy closing composition, full viewport or slightly flexible."
        mapsTo="Domain Components → Wishes"
        title="Domain · Wishes"
      >
        <InlineList entries={WISHES_ENTRIES} />
      </GallerySection>
    </>
  );
}
