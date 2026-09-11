import {
  DeviceRuler,
  GallerySection,
  RuleList,
  type RulerStop,
  SpanTable,
  type SpanZone,
} from "@/app/design-system/_kit";

/* curate-gallery — Bucket 5, the Technical bucket, in DESIGN.md document order (curate-gallery → section-spine.md § 19).
   One module for the whole bucket, per the skill's pinned `sections/` structure ("exactly 5 files — the
   count is law"); this bucket holds exactly one section.

   No `Technical · Z-Index Scale` section: DESIGN.md defines no such heading, and the z-index scale
   already renders at Foundations · Elevation & Depth as a second SpecimenGroup (curate-gallery → section-spine.md).
   `Technical Conventions`, `Accessibility Rules`, `Cross-Cutting Rules` and `Iteration Notes` are
   excluded per the spine's settled derivation — not re-derived here.

   DEVIATION FROM THE SPINE, on the owner's call: `Interaction Rules`' own global-default bullets are
   rendered rather than left to a single cross-reference. The spine treats them as excluded and keeps
   only the touch-target line; the focus ring and the document-wide selection rule are load-bearing
   behaviour with no other surface in the gallery, so they are rendered here in document order.

   Prose renders through RuleList (semantic type classes directly) — this project has no prose layer
   and the gallery may not invent one (DESIGN.md → Overview → No prose layer). No
   Specimen/SpecimenGroup wrapper: SpanTable and DeviceRuler render directly inside GallerySection, the
   same shape Foundations uses for its other bare visualizers — the prose-vs-box rule keeps this rules
   section unboxed. */

/* § 19 — Interaction · Responsive Behavior. Three zones in DESIGN.md document order. The intro rule
   (two layout systems, lg as the switch, md's scoped exception) sits in the section intro; the three
   zone bullets become SpanTable rows; the thread-path bullet folds into each zone it governs; the
   horizontal-scroll floor and the touch-target cross-reference (curate-gallery → section-spine.md → Sanctioned
   cross-references) close the section as labeled prose, mirroring the reference's pinned
   touch-targets/collapsing-strategy shape. */
const ZONES: SpanZone[] = [
  {
    name: "Mobile",
    width: "< 48rem (768px)",
    changes: [
      "Vertical flow; event info and family each split into two screen-feel panels.",
      "Couple names at display-name-mobile (56px).",
      "Thread follows the mobile-system path.",
    ],
  },
  {
    name: "Tablet",
    width: "48rem – 64rem (768px – 1023px)",
    changes: [
      "The mobile system continues, with wider gutters.",
      "Couple names step up to display-name-tablet (72px) — the one exception to lg being the layout switch.",
      "Thread stays on the mobile-system path; no third path is authored.",
    ],
  },
  {
    name: "Desktop",
    width: "≥ 64rem (1024px)",
    changes: [
      "Parallel splits; the timeline alternates sides.",
      "Couple names at display-name-desktop (96px).",
      "Thread switches to its desktop-system path — the layout switch point.",
    ],
  },
];

/* ZONE_BARS — the skill's fixed proportional silhouette standard (section-spine.md → Responsive
   Behavior → ZONE_BARS), reproduced verbatim: px/device/token/boxW/boxH never vary per project. Only
   `used` varies: this project marks base, md, lg (its own breakpoint tokens), not the reference's
   base/md/xl. */
const ZONE_BARS: RulerStop[] = [
  {
    px: "0",
    device: "Mobile",
    token: "base",
    used: true,
    boxW: 64,
    boxH: 128,
  },
  {
    px: "640",
    device: "Large mobile",
    token: "sm",
    used: false,
    boxW: 76,
    boxH: 138,
  },
  {
    px: "768",
    device: "Tablet",
    token: "md",
    used: true,
    boxW: 104,
    boxH: 162,
  },
  {
    px: "1024",
    device: "Laptop",
    token: "lg",
    used: true,
    boxW: 168,
    boxH: 140,
  },
  {
    px: "1280",
    device: "Desktop",
    token: "xl",
    used: false,
    boxW: 210,
    boxH: 150,
  },
  {
    px: "1536",
    device: "Ultra wide",
    token: "2xl",
    used: false,
    boxW: 264,
    boxH: 152,
  },
];

/* The touch-target and hover lines now live in GLOBAL_DEFAULTS above, where the doc puts them, so
   this section no longer restates them — a reader would otherwise meet the same rule twice. */

/* § Interaction Rules — the chapter's own global defaults, in DESIGN.md document order. Component
   sections carry only their deviations from these. */
const GLOBAL_DEFAULTS = [
  "Scroll — scroll is user-controlled at all times. No snapping, no hijacking, no easing that fights input. Spacing and composition align sections to the viewport instead.",
  "Section entry — content reveals with fade and translate bound to scroll position. Content is present and readable before its reveal completes.",
  "Tap — every interaction is touch-first with a minimum touch-target (44px) hit area. Nothing critical depends on hover.",
  "Hover — a subtle enhancement on pointer devices only, and never reveals information.",
  "Focus — every interactive element takes a focus-ring indicator: 2px at 2px offset, in ink on paper surfaces and accent-gold on the green stock. The ring is a functional indicator, so it is the one place gold gives way to ink — gold measures 2.39:1 on paper against the 3:1 an indicator needs, while ink measures 11.74:1. On the green stock the reverse holds.",
  "Text selection — nothing on the site is selectable. user-select: none applies to the whole document, with the vendor-prefixed form and the long-press callout suppressed so the selection menu does not appear on iOS either. The cost is accepted: a guest cannot copy the venue address or the date, and the map action is the route to the venue instead. Selection is not focus — nothing in this rule weakens keyboard reachability or the focus ring.",
  "Modal — the gallery modal opens over the page without unmounting it, and restores scroll position on close.",
  "Loading — images reserve their final dimensions through image-placeholder so nothing reflows.",
];

/* The layout-switch rule itself is NOT repeated here — the section intro states it, and a bullet
   restating it makes a reader meet the same sentence twice. This list carries only what the intro
   does not: DESIGN.md's horizontal-scroll floor. */
const COLLAPSING_STRATEGY_RULES = [
  "Layout holds without horizontal scroll from 320px upward.",
];

export function TechnicalSections() {
  return (
    <>
      <GallerySection
        id="interaction-defaults"
        intro="Global behavioral defaults. Component sections carry only their deviations from these."
        mapsTo="Interaction Rules"
        title="Interaction · Global Defaults"
      >
        <RuleList rules={GLOBAL_DEFAULTS} />
      </GallerySection>

      <GallerySection
        id="responsive"
        intro="Two layout systems across three tiers. breakpoints.lg is the layout switch; breakpoints.md adjusts spacing and column behavior within the mobile system without changing it — with two named exceptions, both typographic. Couple names step up in size at breakpoints.md, since they would otherwise read as undersized once the tablet tier's wider gutters land. heading-lg and date-primary step up there together, having been held at 24px below it so the wedding city fits the narrower column."
        mapsTo="Interaction Rules → Responsive Behavior"
        source="--breakpoint-* / --touch-target"
        title="Interaction · Responsive Behavior"
      >
        <SpanTable zones={ZONES} />
        <DeviceRuler stops={ZONE_BARS} />
        <RuleList
          label="Collapsing strategy"
          rules={COLLAPSING_STRATEGY_RULES}
        />
      </GallerySection>
    </>
  );
}
