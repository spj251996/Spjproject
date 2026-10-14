import {
  DeviceRuler,
  GallerySection,
  type LayerItem,
  LayerStack,
  RuleList,
  type RulerStop,
  SpanTable,
  type SpanZone,
} from "@/app/design-system/_kit";

/* Published, lab and review routes in one list. /thread carries [lab] in the doc —
   built and verified but not on the published page; /preview carries [retire] instead, because it
   IS published and is deleted before the branch merges rather than at Phase 9. */
const VARIANT_ROUTES = [
  "/ · five sections · no thread · the hero unpainted, the other four mounted",
  "/thread · the same five · the thread · card paint identical to / · Event Info joined to Family in code where Contact was, until the redraw",
  "/preview · the published page plus a floating panel of look alternates, for the couple to judge on their own handsets — published rather than dev-only because a dev route cannot be opened on a phone, unlisted by the same robots.txt and noindex as /, and deleted before merge",
  "/preview server-renders the published page: each lever's default ships in the section files and the route carries only the alternates, keyed on data-pv-* attributes the panel sets on the document root, so its <main> is byte-identical to /'s. Shipped state removes the attribute, so an untouched panel is the published page",
  "Its panel carries the owner's two open questions (2026-10-14): the invite's spacing on a phone and Event Info's spacing on a phone. The family photos, the progress line, the opening and the phone paper left the same day, each decided → DESIGN.md → Iteration Notes → Open Decisions",
];

const TRY_IT = [
  "Focus and hover · tab to or hover the map action under Components · UI",
  "Text selection · try selecting any text on this page — nothing selects",
  "Scrollbar · on a desktop with classic scrollbars, this page's own is thin with a muted-ink thumb on a transparent track; a phone's overlay bar is the browser's own",
  "Scroll, section entry, modal and loading act on the page itself; no specimen",
  "Tap targets → Accessibility Rules",
];

const ZONES: SpanZone[] = [
  {
    name: "Mobile",
    width: "< 48rem (768px)",
    changes: [
      "Vertical flow; the family split into screen-feel panels",
      "Mobile type step",
    ],
  },
  {
    name: "Tablet",
    width: "48rem – 64rem (768px – 1023px)",
    changes: ["Mobile system, wider gutters", "Tablet type step"],
  },
  {
    name: "Desktop",
    width: "≥ 64rem (1024px)",
    changes: [
      /* The timeline's alternation was RETIRED 2026-10-10 — one full-width column at every tier
         now — and `timeline-node` itself went in Phase 5b, so this row named a component that had
         not existed for days and a layout that no longer exists either. Both halves were wrong. */
      "Parallel splits",
      "Compact type step from lg, desktop type step from xl",
    ],
  },
];

/* Silhouette geometry is the visualizer's fixed standard. Every common device width is shown;
   `used` marks the breakpoints DESIGN.md defines. `--breakpoint-xl` is overridden to 100rem
   (1600px), so 1280px — Tailwind's own default `xl` — names no breakpoint this project uses. */
const ZONE_BARS: RulerStop[] = [
  { px: "0", device: "Mobile", token: "base", used: true, boxW: 64, boxH: 128 },
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
    px: "1536",
    device: "Ultra wide",
    token: "2xl",
    used: false,
    boxW: 264,
    boxH: 152,
  },
  {
    px: "1600",
    device: "Desktop",
    token: "xl",
    used: true,
    boxW: 280,
    boxH: 156,
  },
];

const RESPONSIVE_POINTERS = [
  "Event Info side by side or stacked → Foundations · Layout → mounted-pair",
  "A framed section's ground and padding → Foundations · Layout → mounted-sheet",
  "A pair's 1280px tier-line width is a layout value, not a breakpoint → Foundations · Layout → mounted-sheet",
  "The thread does not follow this ladder: its geometry is authored per aspect band, three of them, keyed to real devices' viewports → Domain · Thread",
  "Narrowest supported width → Accessibility Rules",
];

/* Four layers, not six: the ivory ground and the mounted sheets sit in document order with no
   z-index of their own, so their tokens were defined and never read, and were retired 2026-10-03
   (DESIGN.md → Technical Conventions → Z-Index Scale). */
const Z_LAYERS: LayerItem[] = [
  {
    token: "--z-content",
    value: "20",
    role: "Content · all text and main components",
  },
  {
    token: "--z-thread",
    value: "40",
    role: "Thread · the page-length thread and its head, re-trace and tapered ends",
  },
  {
    token: "--z-progress",
    value: "45",
    role: "Progress · the scroll progress bar on /, over every section and under the scrim",
  },
  { token: "--z-modal", value: "50", role: "Modal · the gallery modal" },
];

export function TechnicalSections() {
  return (
    <>
      <GallerySection
        id="interaction-defaults"
        intro="Global state defaults; component sections carry only their deviations."
        mapsTo="Interaction Rules"
        title="Interaction · Global Defaults"
      >
        <RuleList rules={TRY_IT} />
      </GallerySection>

      <GallerySection
        id="responsive"
        intro="Two layout systems across three width tiers: lg switches the system, md adjusts within it."
        mapsTo="Interaction Rules → Responsive Behavior"
        source="--breakpoint-*"
        title="Interaction · Responsive Behavior"
      >
        <SpanTable zones={ZONES} />
        <DeviceRuler stops={ZONE_BARS} />
        <RuleList rules={RESPONSIVE_POINTERS} />
      </GallerySection>

      <GallerySection
        id="variant-routes"
        intro="Three routes compose from one section module. What differs between them is whether the thread mounts and whether the review panel rides along — never the card paint, which follows each card's role, and never the geometry, which is identical for every section two routes share."
        mapsTo="Technical Conventions → Variant Routes"
        source="app/_sections/index.tsx · app/thread/page.tsx · app/preview/page.tsx"
        title="Technical · Variant Routes"
      >
        <RuleList rules={VARIANT_ROUTES} />
      </GallerySection>

      <GallerySection
        id="z-index"
        intro="The layer order, from the ground up to the modal."
        mapsTo="Technical Conventions → Z-Index Scale"
        source="--z-*"
        title="Technical · Z-Index Scale"
      >
        <LayerStack items={Z_LAYERS} />
      </GallerySection>
    </>
  );
}
