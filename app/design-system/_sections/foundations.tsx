import {
  type BarItem,
  BarScale,
  DepthGrid,
  type DepthLevel,
  DurationScale,
  type DurationToken,
  EasingCurves,
  type EasingToken,
  GallerySection,
  type LayerItem,
  LayerStack,
  RuleList,
  type ShapeItem,
  ShapeRow,
  Specimen,
  SpecimenGroup,
  SwatchGrid,
  type SwatchGroup,
  TypeScaleList,
  type TypeToken,
} from "@/app/design-system/_kit";
import { Divider } from "@/components/layout/divider";
import { MountedSheet } from "@/components/layout/mounted-sheet";
import { EyebrowLabel } from "@/components/ui/eyebrow-label";

/* curate-gallery — Bucket 1, the nine Foundations sections, in DESIGN.md document order
   (gallery-spine.md § 1–9). One module for the whole bucket, per the skill's pinned `sections/`
   structure; the spine restates it as "exactly 5 files (foundations.tsx 9 · …)".

   Prose renders through the semantic type classes directly. This project has no prose layer and the
   gallery may not invent one (gallery-spine.md → Consequence of Prose's absence), so list structure
   and spacing come from the `space-*` scale and list markers are omitted rather than designed. */

/* § 1 — Colors. Four role groups covering all eight tokens, in the doc's table order. There is no
   Borders group: DESIGN.md defines no border token, and the divider borrows accent-gold at
   `--stroke-divider`. Per-swatch `usage` carries the contrast ratios from Accessibility Rules — a
   sanctioned cross-reference (gallery-spine.md → Sanctioned cross-references). */
const COLOR_GROUPS: SwatchGroup[] = [
  {
    label: "Surfaces",
    note: "Three layers, always in this order: the fixed ground, the mount laid on it, and the stock laid on the mount. Exactly one section takes the green stock — the closing one.",
    tokens: [
      {
        token: "--color-surface-base",
        name: "surface-base",
        usage:
          "The ivory ground. Fixed behind the whole page; every section sits on it.",
      },
      {
        token: "--color-surface-mount",
        name: "surface-mount",
        usage:
          "The mount — the backing sheet of every mounted section. Carries no text, which is why gold's 3.93:1 on it never occurs.",
      },
      {
        token: "--color-surface-elevated",
        name: "surface-elevated",
        usage: "The paper stock — the inner sheet laid on the mount.",
      },
      {
        token: "--color-surface-contrast",
        name: "surface-contrast",
        usage: "The green stock. The closing section's inner sheet.",
      },
    ],
  },
  {
    label: "Text",
    tokens: [
      {
        token: "--color-ink",
        name: "ink",
        usage:
          "Primary text on the ivory base; fills for strong UI elements. ~11.7:1 there.",
      },
      {
        token: "--color-ink-on-contrast",
        name: "ink-on-contrast",
        usage:
          "Primary text on the deep-green contrast section. ~12.6:1 there.",
      },
    ],
  },
  {
    label: "Accent",
    note: "ONE gold, and it does not vary by ground. It marks eyebrows, the engraved rule, dividers and active states on both stocks. RECORDED EXCEPTION: 2.39:1 on paper against AA's 4.5:1 — a deliberate decision scoped to the eyebrow and the engraved rule's label only. Every other text role uses ink. Do not 'fix' it. On the green stock the same gold measures 5.72:1 and is compliant.",
    tokens: [
      {
        token: "--color-accent-gold",
        name: "accent-gold",
        usage:
          "The single gold. 2.39:1 on paper (the recorded exception), 5.72:1 on the green stock. Never used for the focus ring on paper, where it falls under the 3:1 an indicator needs.",
      },
    ],
  },
  {
    label: "Thread reserved",
    note: "Exclusive to the thread. Buttons, headings, icons, error states and decorative accents never use either. The thread is decorative and never the sole carrier of meaning, which is what keeps its 1.87:1 on the green stock out of scope for contrast requirements.",
    tokens: [
      {
        token: "--color-thread-red",
        name: "thread-red",
        usage:
          "The thread and its wisp, at one colour on both stocks — a real thread does not change colour, it catches light differently.",
      },
      {
        token: "--color-thread-vermilion",
        name: "thread-vermilion",
        usage:
          "The thread's glow only. Never a stroke, never text. A glow cannot exist on paper — ivory has 27x less room to add light than the green stock — so on paper this is an ink bleed made by darkening.",
      },
    ],
  },
];

/* § 2 — Typography. Seven rows, matching the doc's seven-row role table and the seven `.type-*`
   classes. `display-name` is ONE role that steps across viewports, not three roles. */
const TYPE_TOKENS: TypeToken[] = [
  {
    token: "type-display-name",
    family: "Corinthia",
    size: 96,
    weight: 400,
    sample: "Couple names only.",
    responsive: { tablet: 72, mobile: 56 },
  },
  {
    token: "type-heading-xl",
    family: "Cormorant Garamond",
    size: 48,
    weight: 700,
    sample: "Section-level H1.",
  },
  {
    token: "type-heading-lg",
    family: "Cormorant Garamond",
    size: 30,
    weight: 700,
    sample: "H2 and event names.",
  },
  {
    token: "type-date-primary",
    family: "Cormorant Garamond",
    size: 30,
    weight: 400,
    sample: "The major date line on the invite and event cards.",
  },
  {
    token: "type-body",
    family: "Source Sans 3",
    size: 17,
    weight: 400,
    lh: 1.7,
    sample: "Descriptions, addresses, wishes, all long-form copy.",
  },
  {
    token: "type-eyebrow",
    family: "Source Sans 3",
    size: 12,
    weight: 500,
    sample: "Always gold, never ink — on both stocks, in every section.",
  },
  {
    token: "type-action",
    family: "Source Sans 3",
    size: 13,
    weight: 700,
    sample: "Buttons and calls to action.",
  },
];

const TYPE_RULES = [
  "The script face appears only on couple names — never on body copy, headings, labels, or buttons.",
  "Long-form and functional information stays in Cormorant Garamond and Source Sans 3.",
  "Both serif and sans carry regular and bold only. Bold marks structural headings and actions; everything else sits at regular, including the date line, which separates from heading-lg at the same size by weight rather than by scale.",
  "Mobile sizing may scale responsively, but hierarchy and font roles are unchanged across viewports. display-name is the only role that steps.",
  "Body sizing is set for a mixed-age audience; it does not shrink below 17px at any viewport.",
  "Tracking and casing ride the class rather than the metadata column: date-primary 0.06em, eyebrow 0.2em uppercase, action 0.16em uppercase.",
];

/* § 3 — Spacing. One group of ten steps: the bare zero step plus space-3xs…space-3xl. This project
   defines no gutter or margin spacing tokens, so there is no second group. */
const SPACING_STEPS: BarItem[] = [
  { token: "0", px: 0 },
  { token: "space-3xs", px: 4 },
  { token: "space-2xs", px: 8 },
  { token: "space-xs", px: 12 },
  { token: "space-sm", px: 16 },
  { token: "space-md", px: 24 },
  { token: "space-lg", px: 32 },
  { token: "space-xl", px: 48 },
  { token: "space-2xl", px: 64 },
  { token: "space-3xl", px: 96 },
];

const SPACING_RULES = [
  "Tight grouping uses space-2xs (8px) to space-sm (16px).",
  "Component padding uses space-sm (16px) to space-md (24px).",
  "Section spacing uses space-2xl (64px) to space-3xl (96px).",
  "Content never hugs the viewport edge; vertical rhythm stays consistent across sections.",
  "Named steps carry a space- prefix: the bare t-shirt keys double as the styling framework's width-scale keys, and the spacing value silently wins — a width cap named lg resolved to 32px.",
  "The zero step keeps the bare name 0 — it collides with nothing, and prefixing it stops every zero-valued step resolving. Its bar is correctly invisible.",
];

const LAYOUT_RULES = [
  "Each major section is composed around one viewport height, with the timeline as the deliberate exception.",
  "Content width caps at 1200px and text blocks at 600px; cards flex within the grid.",
  "Sections alternate between dense composition (event info) and airy composition (invite, wishes) so no two adjacent sections carry equal visual weight.",
  "Whitespace is structural, not leftover space.",
  "Both caps are stated only in DESIGN.md prose, in no token block; the token layer emits them as --container-content and --container-text.",
];

const IMAGERY_RULES = [
  "Family portraits are circular crops, the one place a circle is used as a container.",
  "Gallery images sit in a masonry arrangement inside the modal only, never on the page.",
  "The couple illustration is minimal and elegant, consistent with the overall direction rather than cartoonish.",
];

/* § 6 — Motion. Both cubic-bezier tuples are stated in DESIGN.md itself, so no curve value is
   recovered from code here. */
const DURATION_TOKENS: DurationToken[] = [
  { token: "--duration-fast", ms: 200 },
  { token: "--duration-base", ms: 400 },
  { token: "--duration-slow", ms: 700 },
];

const DURATION_RULES = [
  "--duration-fast (200ms) for state changes: node activation glow, action feedback.",
  "--duration-base (400ms) for section entry reveals, card reveals, and modal open and close.",
  "--duration-slow (700ms) for the two set pieces: the invite thread draw-in and the family thread wrap.",
];

const EASING_TOKENS: EasingToken[] = [
  { token: "--ease-entrance", curve: [0, 0, 0.2, 1] },
  { token: "--ease-settle", curve: [0.4, 0, 0.2, 1] },
];

const EASING_RULES = [
  "--ease-entrance for anything appearing — decelerating, no overshoot, no spring.",
  "--ease-settle for anything the thread does, including its rest at the closing section.",
];

const MOTION_RULES = [
  "Primary motion is scroll-linked fade and translate, with translate distance capped at 20–40px.",
  "Secondary motion is thread reveal and timeline node activation.",
  "Nothing loops, nothing pulses, and no content waits on an animation delay.",
  "Motion budget across the whole page: one major gesture at entry, one key interaction at the family section, and continuous subtle motion through the timeline.",
  "Reduced motion disables all scroll-linked motion, including the thread, leaving the page complete and static; the thread renders fully drawn at its resting glow level.",
];

/* § 7 — Shapes. Four items: the two radius tokens plus circle and pill, neither of which has a
   token. Both render at 9999px, which on a square box is the same silhouette — the distinction is
   the container they are applied to, not the value. */
const SHAPE_ITEMS: ShapeItem[] = [
  {
    token: "square",
    radius: "0",
    value: "no token",
    usage:
      "THE SECTION SHAPE. The mount and both stocks take no radius at all — this is what makes a section read as paper rather than as a dialog.",
  },
  {
    token: "--radius-sm",
    radius: "var(--radius-sm)",
    value: "8px",
    usage:
      "Retained for the few elements that still take a radius — image-placeholder and the gallery modal. Nothing at section scale uses it.",
  },
  {
    token: "--radius-lg",
    radius: "var(--radius-lg)",
    value: "16px",
    usage:
      "Retained, but no longer the shape of a card. KNOWN DRIFT: event-card still carries it — see the rules below.",
  },
  {
    token: "circle",
    radius: "9999px",
    value: "no token",
    usage:
      "Containers for portraits only — the one place a circle is used as a container.",
  },
  {
    token: "pill",
    radius: "9999px",
    value: "no token",
    usage:
      "Unused, and now unusable at section scale. The action control has no box at all — it is an engraved rule.",
  },
];

const SHAPE_RULES = [
  "Section surfaces are SQUARE. The mount and both stocks take no radius at all — rendered both ways, radius-lg reads as a dialog and 0 reads as a sheet. A radius at section scale is the strongest signal that a card is web UI rather than paper.",
  "The radius tokens remain for the few elements that still take one — image-placeholder and the gallery modal. Nothing at section scale uses them.",
  "Circles are containers for portraits only.",
  "Dividers are --stroke-divider (1px) lines in accent-gold — rendered under Foundations · Layout.",
  "KNOWN DRIFT: event-card still carries radius-lg, which the doc no longer sanctions at that scale. Left to Phase 3, which owns the card's redesign.",
];

/* § 8 — Elevation & Depth. Two specimen groups in one section, because this one sub-section
   documents two token kinds. The z-order scale therefore has no section of its own: DESIGN.md has
   no Z-Index Scale heading, and minting one would point mapsTo at a heading that does not exist
   (gallery-spine.md → Q2). */
/* Each level renders on the ground its shadow actually lands on, so the tint rule is demonstrated
   rather than asserted: all three are warm because all three fall on paper. */
const DEPTH_LEVELS: DepthLevel[] = [
  {
    name: "The ground",
    spec: "surface-base · no shadow · the hairline is the demo card's edge, not part of the level",
    className:
      "border-(length:--stroke-divider) border-accent-gold bg-surface-base",
    usage: "The fixed ivory ground. Everything else sits on it.",
  },
  {
    name: "Mount on the ground",
    spec: "surface-mount · shadow-mount · square",
    className: "bg-surface-mount shadow-mount",
    usage:
      "Lifts the whole mounted section off the ground. Keeps its shadow at every width, including where it loses its fill below the md breakpoint.",
  },
  {
    name: "Paper stock on the mount",
    spec: "surface-elevated · shadow-sheet · square",
    className: "bg-surface-elevated shadow-sheet",
    usage:
      "A light sheet on a light mount barely casts, so most of its separation is the inset top highlight — which stays pure white and untinted, because the tint rule governs shadows and a highlight is the opposite of one.",
  },
  {
    name: "Green stock on the mount",
    spec: "surface-contrast · shadow-sheet-contrast · square",
    className: "bg-surface-contrast text-ink-on-contrast shadow-sheet-contrast",
    usage:
      "A dark sheet on a light mount genuinely casts, so this one takes a real drop shadow and a hairline, and no highlight at all. Two constructions, not two strengths.",
  },
];

const Z_LAYERS: LayerItem[] = [
  {
    token: "--z-base",
    value: "0",
    role: "Base — the fixed ivory ground.",
  },
  {
    token: "--z-botanical",
    value: "10",
    role: "Botanical — low-opacity botanical edge elements.",
  },
  {
    token: "--z-content",
    value: "20",
    role: "Content — all text and main components.",
  },
  {
    token: "--z-elevated",
    value: "30",
    role: "Elevated — mounted sections, the mount and its sheet, as paper on paper.",
  },
  { token: "--z-thread", value: "40", role: "Thread — the thread overlay." },
  { token: "--z-modal", value: "50", role: "Modal — the gallery modal." },
];

const ELEVATION_RULES = [
  "Layering must be achievable with simple stacking contexts so the thread overlay never fights nested stacking.",
  "A shadow takes the tint of the surface it FALLS ON, because a shadow is that surface darkened. Shadows landing on paper — the ground, the mount, the paper stock — are warm; shadows landing on the green stock are green ink. Neither is ever black.",
  "All three recipes above are warm, because all three fall on paper. The green-ink case belongs to whatever lands on the green stock, which nothing in this layer does yet.",
  "The paper stock and the green stock need different CONSTRUCTIONS, not different strengths — a light sheet on a light mount barely casts, a dark sheet on a light mount genuinely does.",
  "Layering adds no heavy assets and does not affect scroll performance.",
];

/* § 9 — Iconography. Spec prose only: the doc specifies a full icon system, but no icon library is
   installed, no components/icons/ exists, and no component renders an icon, so there is nothing to
   catalog and no grid may be invented (gallery-spine.md → D1). */
const ICON_RULES = [
  "All icons come from one consistent set — thin, stroke-based, with no fills, rounded stroke ends, and slightly organic curves rather than perfect geometry.",
  "Stroke is --stroke-icon (1.25px) to --stroke-icon-lg (1.5px), consistent across the set, aligned to the pixel grid so small sizes stay sharp.",
  "Icons use accent-gold on the ivory base and ink-on-contrast on the contrast section.",
  "The intended feel is etched or engraved line work rather than UI iconography.",
  "The set is Lucide with a customized stroke. Individual bespoke SVGs may be drawn to match when Lucide has no suitable glyph.",
];

const ICON_GAP_RULES = [
  "No icon library is installed, no components/icons/ exists, and no component renders an icon — there are zero icons to catalog, so this section renders its spec rather than an icon grid.",
];

export function FoundationsSections() {
  return (
    <>
      <GallerySection
        id="colors"
        intro="The palette is fixed around ivory, deep green, gold, and a single warm red reserved for the thread. Section distinction comes from composition, layering, spacing, and motion — never from alternating section background colors."
        mapsTo="Foundations → Colors"
        source="app/styles/tokens.css → @theme static"
        title="Foundations · Colors"
      >
        <SwatchGrid groups={COLOR_GROUPS} />
      </GallerySection>

      <GallerySection
        id="typography"
        intro="Three families with strictly divided roles. The script face is decorative and never carries functional information."
        mapsTo="Foundations → Typography"
        source="app/styles/type-scale.css"
        title="Foundations · Typography"
      >
        <TypeScaleList tokens={TYPE_TOKENS} />
        <RuleList rules={TYPE_RULES} />
      </GallerySection>

      <GallerySection
        id="spacing"
        intro="Base unit 4px. Values outside the scale are not used — including zero, which has its own named step rather than an arbitrary value, so flush edges and collapsed gaps stay inside the scale."
        mapsTo="Foundations → Spacing"
        source="--spacing-*"
        title="Foundations · Spacing"
      >
        <BarScale items={SPACING_STEPS} varPrefix="--spacing-" />
        <RuleList rules={SPACING_RULES} />
      </GallerySection>

      <GallerySection
        id="layout"
        intro="Desktop composes in parallel splits; mobile flows vertically and splits the event and family sections into separate screen-feel segments. The layout layer itself is one primitive — the divider; the width caps are composition rules, not isolable primitives."
        mapsTo="Foundations → Layout"
        title="Foundations · Layout"
      >
        <RuleList rules={LAYOUT_RULES} />

        <Specimen
          description="The card layout every section is built on — a backing mount with an inner sheet laid onto it."
          id="layout-mounted-sheet"
          name="mounted-sheet"
          source="@/components/layout/mounted-sheet"
          spec="Two stocks, one mount. The mount never changes colour; only the inner stock does. Reveal is 16px at lg, 12px at md, and below md only the hero keeps its mount — resize the window to watch the ladder. The mount keeps its shadow at every width, so an unmounted sheet still lifts off the ground. The mount carries no text."
        >
          <div className="flex flex-col gap-space-lg">
            <MountedSheet hero>
              <div className="flex flex-col gap-space-2xs p-space-lg">
                <EyebrowLabel>The invitation</EyebrowLabel>
                <p className="type-body text-ink">
                  Paper stock, hero — the one section that keeps its mount below
                  the md breakpoint.
                </p>
              </div>
            </MountedSheet>
            <MountedSheet>
              <div className="flex flex-col gap-space-2xs p-space-lg">
                <EyebrowLabel>Where and when</EyebrowLabel>
                <p className="type-body text-ink">
                  Paper stock, ordinary section — its mount disappears below the
                  md breakpoint.
                </p>
              </div>
            </MountedSheet>
            <MountedSheet stock="contrast">
              <div className="flex flex-col gap-space-2xs p-space-lg">
                <EyebrowLabel>With all our love</EyebrowLabel>
                <p className="type-body">
                  Green stock — a real drop shadow and no inset highlight, and
                  it rebinds the focus ring on its own subtree.
                </p>
              </div>
            </MountedSheet>
          </div>
        </Specimen>

        <Specimen
          description="Thin rule separating grouped content within a section — --stroke-divider (1px) in accent-gold."
          id="layout-divider"
          name="divider"
          source="@/components/layout/divider"
          spec="Used inside event cards and between family groupings, not between sections — section separation is spatial."
        >
          <div className="flex flex-col gap-space-sm">
            <p className="type-body text-ink">
              Grouped content above the rule.
            </p>
            <Divider />
            <p className="type-body text-ink">
              Grouped content below the rule.
            </p>
          </div>
        </Specimen>
      </GallerySection>

      <GallerySection
        id="imagery"
        intro="Three rules govern how imagery is used. They are listed for completeness — none is a visual specimen."
        mapsTo="Foundations → Imagery"
        title="Foundations · Imagery"
      >
        <RuleList rules={IMAGERY_RULES} />
      </GallerySection>

      <GallerySection
        id="motion"
        intro="Scroll is the primary interaction. Motion guides rather than distracts, and never blocks content visibility. Duration and easing tokens govern discrete transitions only — scroll-linked motion is bound to scroll progress and consumes no duration token."
        mapsTo="Foundations → Motion"
        source="--duration-* / --ease-*"
        title="Foundations · Motion"
      >
        <SpecimenGroup title="Durations">
          <DurationScale items={DURATION_TOKENS} />
          <RuleList rules={DURATION_RULES} />
        </SpecimenGroup>

        <SpecimenGroup title="Easing">
          <EasingCurves items={EASING_TOKENS} />
          <RuleList rules={EASING_RULES} />
        </SpecimenGroup>

        <RuleList label="Motion rules" rules={MOTION_RULES} />
      </GallerySection>

      <GallerySection
        id="shapes"
        intro="The soft rectangle is the primary shape, with the circle reserved for portraits and the pill permitted but currently unused."
        mapsTo="Foundations → Shapes"
        source="--radius-*"
        title="Foundations · Shapes"
      >
        <ShapeRow items={SHAPE_ITEMS} />
        <RuleList rules={SHAPE_RULES} />
      </GallerySection>

      <GallerySection
        id="elevation"
        intro="Depth comes from paper edge, subtle shadow, slight tone difference, and overlap — never from strong 3D or skeuomorphic effects. This sub-section documents two token kinds, the paper-elevation treatment and the six-layer z-order, so both render here and the z-index scale gets no section of its own."
        mapsTo="Foundations → Elevation & Depth"
        source="--shadow-* / --z-*"
        title="Foundations · Elevation & Depth"
      >
        <SpecimenGroup title="Paper elevation">
          <DepthGrid levels={DEPTH_LEVELS} />
        </SpecimenGroup>

        <SpecimenGroup title="Z-order">
          <LayerStack items={Z_LAYERS} />
        </SpecimenGroup>

        <RuleList label="Depth rules" rules={ELEVATION_RULES} />
      </GallerySection>

      <GallerySection
        id="iconography"
        intro="The icon system is fully specified in DESIGN.md but wholly unimplemented, so this section renders its spec rather than an icon grid."
        mapsTo="Foundations → Iconography"
        title="Foundations · Iconography"
      >
        <RuleList label="Specification" rules={ICON_RULES} />
        <RuleList label="Not yet implemented" rules={ICON_GAP_RULES} />
      </GallerySection>
    </>
  );
}
