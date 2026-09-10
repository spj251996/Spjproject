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
    note: "At most one deep-green contrast section is permitted, as an intentional visual event rather than a repeating pattern. The closing section is the candidate; the treatment is optional.",
    tokens: [
      {
        token: "--color-surface-base",
        name: "surface-base",
        usage:
          "The ivory base. Background for the entire site, including elevated paper.",
      },
      {
        token: "--color-surface-elevated",
        name: "surface-elevated",
        usage: "Elevated paper — event cards and key containers.",
      },
      {
        token: "--color-surface-contrast",
        name: "surface-contrast",
        usage: "The optional deep-green contrast section.",
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
    note: "Gold marks eyebrow labels, dividers, active jump-link state, and link accent details. No border token exists — the divider borrows accent-gold at --stroke-divider.",
    tokens: [
      {
        token: "--color-accent-gold",
        name: "accent-gold",
        usage:
          "Decorative gold on ivory at ~2.1:1, carrying no meaning on its own; legible gold on the contrast section at ~6.6:1.",
      },
      {
        token: "--color-accent-gold",
        name: "accent-gold",
        usage:
          "Gold for text, icons, and meaning-bearing marks on ivory. ~4.7:1 — any gold that must be read or recognized uses this one.",
      },
    ],
  },
  {
    label: "Thread reserved",
    note: "Exclusive to the thread. Buttons, headings, icons, error states, and decorative accents never use it.",
    tokens: [
      {
        token: "--color-thread-red",
        name: "thread-red",
        usage: "The thread system only.",
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
    weight: 400,
    sample: "Small uppercase labels above headings and card fields.",
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
    token: "--radius-sm",
    radius: "var(--radius-sm)",
    value: "8px",
    usage: "Soft rectangle, lower bound — the primary shape.",
  },
  {
    token: "--radius-lg",
    radius: "var(--radius-lg)",
    value: "16px",
    usage: "Soft rectangle, upper bound — cards and key containers.",
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
      "Permitted sparingly rather than as a default. Currently unused — button-action explicitly declines it.",
  },
];

const SHAPE_RULES = [
  "Primary shape is the soft rectangle, radius --radius-sm (8px) to --radius-lg (16px). Edges are clean and slightly softened, never exaggerated.",
  "Circles are containers for portraits only.",
  "Pill buttons are used sparingly rather than as a default.",
  "Dividers are --stroke-divider (1px) lines in accent-gold — rendered under Foundations · Layout.",
];

/* § 8 — Elevation & Depth. Two specimen groups in one section, because this one sub-section
   documents two token kinds. The z-order scale therefore has no section of its own: DESIGN.md has
   no Z-Index Scale heading, and minting one would point mapsTo at a heading that does not exist
   (gallery-spine.md → Q2). */
const DEPTH_LEVELS: DepthLevel[] = [
  {
    name: "Base paper",
    spec: "surface-base · no shadow · the hairline is the demo card's edge, not part of the level",
    className:
      "border-(length:--stroke-divider) border-accent-gold bg-surface-base",
    usage: "The ivory page ground — the only page background.",
  },
  {
    name: "Elevated paper",
    spec: "surface-elevated · shadow-sheet · square",
    className: "rounded-lg bg-surface-elevated shadow-sheet",
    usage:
      "Event cards and key containers — a sheet catching slightly more light, not a new surface.",
  },
];

const Z_LAYERS: LayerItem[] = [
  {
    token: "--z-base",
    value: "0",
    role: "Base — the ivory paper base with static minimal texture.",
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
    role: "Elevated — event cards and key containers, as paper on paper.",
  },
  { token: "--z-thread", value: "40", role: "Thread — the thread overlay." },
  { token: "--z-modal", value: "50", role: "Modal — the gallery modal." },
];

const ELEVATION_RULES = [
  "Layering must be achievable with simple stacking contexts so the thread overlay never fights nested stacking.",
  "Elevated paper stays within the ivory family rather than taking a different section color — it reads as a sheet catching slightly more light, not as a new surface.",
  "Shadows are slight and tinted with green ink rather than black, so depth stays warm.",
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
