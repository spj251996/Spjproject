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

const TRY_IT = [
  "Focus and hover · tab to or hover the map action under Components · UI",
  "Text selection · try selecting any text on this page — nothing selects",
  "Scroll, section entry, modal and loading act on the page itself; no specimen",
  "The gold ring on the green stock · no control sits on that stock, so there is no specimen",
  "Tap targets → Accessibility Rules",
];

const ZONES: SpanZone[] = [
  {
    name: "Mobile",
    width: "< 48rem (768px)",
    changes: [
      "Vertical flow; the family split into screen-feel panels",
      "Mobile type step",
      "Mobile thread path",
    ],
  },
  {
    name: "Tablet",
    width: "48rem – 64rem (768px – 1023px)",
    changes: [
      "Mobile system, wider gutters",
      "Tablet type step",
      "Mobile thread path",
    ],
  },
  {
    name: "Desktop",
    width: "≥ 64rem (1024px)",
    changes: [
      "Parallel splits; timeline nodes alternate sides",
      "Compact type step from lg, desktop type step from xl",
      "Desktop thread path",
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
    device: "Compact laptop",
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
  "Narrowest supported width → Accessibility Rules",
];

const Z_LAYERS: LayerItem[] = [
  { token: "--z-base", value: "0", role: "Base · the fixed ivory ground" },
  {
    token: "--z-content",
    value: "20",
    role: "Content · all text and main components",
  },
  {
    token: "--z-elevated",
    value: "30",
    role: "Elevated · mounted sections, the mount and its sheet",
  },
  { token: "--z-thread", value: "40", role: "Thread · the thread overlay" },
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
