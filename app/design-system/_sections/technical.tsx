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
      "Vertical flow; event info and family each split into two screen-feel segments.",
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

/* Sanctioned cross-reference (curate-gallery → section-spine.md): touch-target 44px,
   from the excluded Interaction Rules → Tap bullet. Not double-counting — the spine requires it here. */
const TOUCH_TARGET_RULES = [
  "Every interaction is touch-first with a minimum touch-target (44px) hit area.",
  "Nothing critical depends on hover.",
];

/* The layout-switch rule itself is NOT repeated here — the section intro states it, and a bullet
   restating it makes a reader meet the same sentence twice. This list carries only what the intro
   does not: DESIGN.md's horizontal-scroll floor. */
const COLLAPSING_STRATEGY_RULES = [
  "Layout holds without horizontal scroll from 320px upward.",
];

export function TechnicalSections() {
  return (
    <GallerySection
      id="responsive"
      intro="Two layout systems across three tiers. breakpoints.lg is the layout switch; breakpoints.md adjusts spacing and column behavior within the mobile system without changing it — with one named exception: couple names step up in size at breakpoints.md too, since they would otherwise read as undersized once the tablet tier's wider gutters land."
      mapsTo="Interaction Rules → Responsive Behavior"
      source="--breakpoint-* / --touch-target"
      title="Interaction · Responsive Behavior"
    >
      <SpanTable zones={ZONES} />
      <DeviceRuler stops={ZONE_BARS} />
      <RuleList label="Touch targets" rules={TOUCH_TARGET_RULES} />
      <RuleList label="Collapsing strategy" rules={COLLAPSING_STRATEGY_RULES} />
    </GallerySection>
  );
}
