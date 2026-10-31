import {
  DeviceRuler,
  GallerySection,
  LayerStack,
  RuleList,
  type RulerStop,
  SpanTable,
  type SpanZone,
} from "@/app/design-system/_kit";
import { Z_LAYERS } from "@/app/design-system/_sections/token-tables";

/* The published route and the lab in one list. /thread carries [lab] in the doc — built and verified
   but not on the published page. */
const VARIANT_ROUTES = [
  "/ · five sections · no thread · the hero unpainted, the other four mounted",
  "/thread · the same five · the thread · card paint identical to / · Event Info joined to Family in code where Contact was, until the redraw",
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
      "Parallel splits",
      "Laptop type step from lg, desktop type step from xl",
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

/* Five layers: the ivory ground and the mounted sheets sit in document order with no z-index of
   their own (DESIGN.md → Technical Conventions → Z-Index Scale). */

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
        intro="Two layout systems across three width tiers: lg switches the system, md adjusts within it. The device ruler scrolls sideways on a narrow screen."
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
        intro="Two routes compose from one section module. What differs between them is whether the thread mounts — never the card paint, which follows each card's role, and never the geometry, which is identical for every section the two share."
        mapsTo="Technical Conventions → Variant Routes"
        source="app/_sections/index.tsx · app/thread/page.tsx"
        title="Technical · Variant Routes"
      >
        <RuleList rules={VARIANT_ROUTES} />
      </GallerySection>

      <GallerySection
        id="z-index"
        intro="The layer order, from the ground up to the modal. Scrolls sideways on a narrow screen."
        mapsTo="Technical Conventions → Z-Index Scale"
        source="--z-*"
        title="Technical · Z-Index Scale"
      >
        <LayerStack items={Z_LAYERS} />
      </GallerySection>
    </>
  );
}
