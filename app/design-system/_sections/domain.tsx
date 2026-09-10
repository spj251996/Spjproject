import type { ReactNode } from "react";
import {
  sampleFamilyGroups,
  sampleInvite,
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
import { Invite } from "@/components/invite/invite";
import { Timeline } from "@/components/timeline/timeline";

/* curate-gallery — Bucket 4, the five Domain sections, in DESIGN.md document order
   (gallery-spine.md § 14–18). One module for the whole bucket, per the skill's pinned `sections/`
   structure ("exactly 5 files — the count is law").

   Three [standalone] entries (Invite, Family, Timeline) render the real production component live,
   fed placeholder data from _data/domain-samples.ts. The two [inline] entries (Event Info, Wishes)
   are page-bound compositions with no component file of their own — LISTED via InlineList, never
   recreated (verification.md: "[inline] compositions are listed in an InlineList (never recreated)").
   Both name app/page.tsx as their documented home; neither is composed there yet — an already-recorded
   drift (gallery-spine.md → D3), not fixed here.

   None of the three live components is position: fixed, so none is wrapped in a ChromeFrame — per its
   own contract ("omit for flow content"), the frame's translateZ(0) trick exists only to contain a
   fixed-position child, which none of these are; they render at their natural in-flow height instead.
   Family and Timeline each carry a section-anchored thread segment for the documented reason both
   components' own comments give: thread-overlay is position: fixed and cannot anchor to page content,
   so the thread reads as a disconnected decoration here — a knowingly deferred Phase-3 defect
   (gallery-spine.md → D4, work/tasks.md → Project follow-ups), rendered honestly, not fixed or worked
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

/* § 14 — Invite. The doc's four bullets, its last two merged. Its lead line is NOT repeated here —
   the section intro carries it, and a bullet restating it makes a reader meet the same sentence
   twice. The thread draw-in and scroll-cue this section is credited with belong to thread-overlay
   and scroll-cue, both already demoed at Components · Shell and Components · UI. */
const INVITE_RULES = [
  "Couple names in the display face are the focal element; the wedding date and city follow in date-primary at primary weight, not as a subordinate line.",
  "Engagement summary sits below in body; an optional short quote sits above the names.",
  "The thread draws into view along a predefined curve, settles near the lower portion of the screen, and leaves scroll-cue behind, continuing past the viewport rather than disappearing — the one major animated gesture on the page. Both belong to thread-overlay and scroll-cue, demoed at Components · Shell and Components · UI; this section owns no thread markup of its own to render.",
];

/* § 15 — Event Info, tagged [inline]. Listed only, per the settled treatment — never recreated. */
const EVENT_INFO_ENTRIES: InlineEntry[] = [
  {
    name: "Event Info",
    home: "app/page.tsx",
    composes:
      "One mounted-pair holding the two events — engagement, then wedding. The two sheets reveal independently with fade and translate as they enter; the thread continues through as a quiet connector with no dramatic motion of its own.",
    note: "Not yet composed — app/page.tsx is a holding page today (gallery-spine.md → D3), later-phase work rather than a defect. The pair itself renders live at Foundations · Layout.",
  },
];

/* § 16 — Family. The doc's four bullets, its last two merged. Its lead line is NOT repeated here —
   the section intro carries it. */
const FAMILY_RULES = [
  "Each group heads with the relationship in heading-lg, the family name directly beneath, then parents, then the couple member with siblings; a sibling's spouse and child sit inline.",
  "Grouping and text labels carry the relationships — no drawn connectors, no tree lines.",
  "portrait instances appear first with no thread interaction; as names resolve, the thread wraps the bride side, then extends to connect the groom side, ending with both sides joined under slight glow emphasis — the one key interaction on the page.",
];

/* § 17 — Timeline. All four of the doc's bullets; the node-count bullet is what the two demo samples
   below exist to prove — including the all-upcoming state Ship 1 actually launches with. Its lead
   line is NOT repeated here — the section intro carries it. */
const TIMELINE_RULES = [
  "timeline-node instances alternate left and right on desktop and stack single-column on mobile.",
  "The thread becomes the vertical spine, extending downward as the reader scrolls, with nodes appearing progressively and activating as they enter view.",
  "Density balances readability against total scroll length — neither compact stacking nor whitespace that breaks flow.",
  "Node count is not fixed; the composition takes however many rituals exist.",
];

/* § 18 — Wishes, tagged [inline]. Listed only, per the settled treatment — never recreated. */
const WISHES_ENTRIES: InlineEntry[] = [
  {
    name: "Wishes",
    home: "app/page.tsx",
    composes:
      "A quotation and the couple names in heading-xl and the display face, an attributed wishes line in body, and a couple illustration entering once with a subtle fade or scale. The thread slows and settles, looping loosely around the illustration, then rests with glow faded to subtle — no continuous motion remains. Candidate for the optional deep-green contrast treatment, already catalogued at Foundations · Colors; the section reads correctly on the ivory base if it is never applied.",
    note: "Not yet composed — app/page.tsx is a holding page today (gallery-spine.md → D3), later-phase work rather than a defect. The couple illustration itself has no component or asset anywhere in code yet, so nothing exists to list beyond the page it would compose into.",
  },
];

export function DomainSections() {
  return (
    <>
      <GallerySection
        id="invite"
        intro="Full-viewport opening, airy composition, no internal scrolling."
        mapsTo="Domain Components → Invite"
        title="Domain · Invite"
      >
        <RuleList rules={INVITE_RULES} />

        <Specimen
          description="Full-viewport opening — couple names in the display face, the date and city, an optional quote, and the engagement summary."
          id="domain-invite"
          name="invite"
          source="@/components/invite/invite"
          spec="Server-rendered, no client boundary and no motion of its own — see the component's own header comment. Live, in flow, unframed: the section is not position: fixed, so no ChromeFrame is needed to contain it. This is the only Domain specimen carrying a real h1 (the section's own coupleNames heading), which duplicates the page's own h1 above it — a gallery-rendering artifact worth flagging, not a production defect. Sample copy is schema-valid placeholder text at real-copy length, never the couple's actual content."
        >
          <Invite {...sampleInvite} />
        </Specimen>
      </GallerySection>

      <GallerySection
        id="event-info"
        intro="Dense composition. One mounted-pair holding the two events side by side on desktop, stacking to two sheets on mobile with engagement first."
        mapsTo="Domain Components → Event Info"
        title="Domain · Event Info"
      >
        <InlineList entries={EVENT_INFO_ENTRIES} />
      </GallerySection>

      <GallerySection
        id="family"
        intro="Two family groups in a two-column split on desktop, two screen-feel segments on mobile."
        mapsTo="Domain Components → Family"
        title="Domain · Family"
      >
        <RuleList rules={FAMILY_RULES} />

        <Specimen
          description="Two family groups, bride's and groom's, each a heading, family name, and a row of portrait instances joined by the thread's one scripted gesture."
          id="domain-family"
          name="family"
          source="@/components/family/family"
          spec="Client boundary, forced by the one discrete-duration transition on the page (Foundations · Motion, duration-slow) firing once as the section enters view — full reasoning in the component's own header comment. Live, in flow, unframed: the section is not position: fixed. The thread reads as a squiggle passing under the group rather than wrapping bride-to-groom — the same knowingly deferred Phase-3 defect as Components · Shell, rendered honestly, not fixed here. Group headings show the relative side rather than a documented relationship, and member order follows the content array as-authored: both already recorded in the component's own header comment as schema gaps, not new here. Every sample portrait is null, so image-placeholder shows throughout — no portrait photography exists yet."
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
          spec="Client boundary, forced by the open-gallery state shared between the node list and the modal — full reasoning in the component's own header comment. No min-h-dvh: the one section that scrolls to its natural length rather than composing around a viewport. The spine is section-anchored, the same knowingly deferred Phase-3 defect as Components · Shell and Family, rendered honestly, not fixed here. Neither sample below ever opens a gallery: a completed ritual with no images gets no gallery action, and no ritual photography exists yet to populate one."
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
