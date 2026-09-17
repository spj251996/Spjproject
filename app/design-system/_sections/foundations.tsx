import Image from "next/image";
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
import {
  BetrothalIcon,
  LoveIcon,
  LunchIcon,
  MapIcon,
  ReceptionIcon,
  WeddingIcon,
} from "@/components/icons";
import { Divider } from "@/components/layout/divider";
import { MountedPair } from "@/components/layout/mounted-pair";
import { MountedSheet } from "@/components/layout/mounted-sheet";

/* curate-gallery — Bucket 1, the ten Foundations sections, in DESIGN.md document order
   (curate-gallery → section-spine.md § 1–10). One module for the whole bucket, per the skill's pinned `sections/`
   structure; the spine restates it as "exactly 5 files (foundations.tsx 9 · …)".

   Prose renders through the semantic type classes directly. This project has no prose layer and the
   gallery may not invent one (DESIGN.md → Overview → No prose layer), so list structure
   and spacing come from the `space-*` scale and list markers are omitted rather than designed. */

/* § 1 — Colors. Four role groups covering all eight tokens, in the doc's table order. There is no
   Borders group: DESIGN.md defines no border token, and the divider borrows accent-gold at
   `--stroke-divider`. Per-swatch `usage` carries the contrast ratios from Accessibility Rules — a
   sanctioned cross-reference (curate-gallery → section-spine.md). */
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
          "The mount — the backing layer of every mounted section. Carries no text, so no text pairing on it is ever measured.",
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
    note: "ONE gold, and it does not vary by ground. It marks eyebrows, the engraved rule, dividers and active states on both stocks. RECORDED EXCEPTION: 2.39:1 on the ground and 2.46:1 on the paper stock, against AA's 4.5:1 — which of the two applies depends only on the surface beneath the gold. A deliberate decision scoped to the eyebrow, the engraved rule's label, and the six iconography marks. Every other text role uses ink. Do not 'fix' it. On the green stock the same gold measures 5.72:1 and is compliant.",
    tokens: [
      {
        token: "--color-accent-gold",
        name: "accent-gold",
        usage:
          "The single gold. 2.39:1 on the ground and 2.46:1 on the paper stock (the recorded exception), 5.72:1 on the green stock. Never used for the focus ring on paper, where both fall under the 3:1 an indicator needs.",
      },
    ],
  },
  {
    label: "Thread reserved",
    note: "Exclusive to the thread, and the seal mark is the thread. Buttons, headings, section marks, error states and decorative accents never use either. The thread is decorative and never the sole carrier of meaning, which is what keeps its 1.87:1 on the green stock out of scope for contrast requirements.",
    tokens: [
      {
        token: "--color-thread-red",
        name: "thread-red",
        usage:
          "The thread and its wisp, at one colour on both stocks — a real thread does not change colour, it catches light differently.",
      },
      {
        token: "--color-shadow-warm",
        name: "shadow-warm",
        usage:
          "The tint every shadow that lands on paper is drawn in — 0.10/0.26 in shadow-mount, 0.16 in shadow-sheet, 0.14/0.34 in shadow-sheet-contrast. Carried as literal rgba on purpose: color-mix single-sources it but an engine without support drops the whole box-shadow and the sheet loses its lift.",
      },
      {
        token: "--color-thread-vermilion",
        name: "thread-vermilion",
        usage:
          "The thread's glow only — 0.68/0.44/0.30 on paper, 0.98/0.62/0.38 on the green stock, all literal for the same reason as the shadow tint. A glow cannot exist on paper: ivory has 27x less room to add light than the green stock, so on paper this is an ink bleed made by darkening.",
      },
    ],
  },
];

/* § 2 — Typography. Nine rows, matching the doc's nine-row role table and the nine `.type-*` role
   classes. `display-name` is ONE role that steps across viewports, not three roles; every role steps
   across all three width tiers, each tier on its own pixel line height (DESIGN.md → Typography → The
   scale). The date line's raised ordinal, `.type-date-ordinal`, is a modifier rather than a role, so
   it is a rule below, not a row. */
const TYPE_TOKENS: TypeToken[] = [
  {
    token: "type-display-name",
    family: "Corinthia",
    size: 120,
    weight: 400,
    lh: 180,
    sample: "Couple names only.",
    responsive: { tablet: 104, mobile: 72, tabletLh: 156, mobileLh: 108 },
  },
  {
    token: "type-heading-script",
    family: "Corinthia",
    size: 80,
    weight: 400,
    lh: 80,
    sample: 'The Event Info sheet headings — "Betrothal", "Wedding".',
    responsive: { tablet: 72, mobile: 56, tabletLh: 72, mobileLh: 56 },
  },
  {
    token: "type-heading-xl",
    family: "Cormorant Garamond",
    size: 48,
    weight: 700,
    lh: 56,
    sample: "Section-level H1.",
    responsive: { tablet: 42, mobile: 34, tabletLh: 48, mobileLh: 40 },
  },
  {
    token: "type-heading-lg",
    family: "Cormorant Garamond",
    size: 26,
    weight: 700,
    lh: 32,
    sample:
      "Serif sub-headings, and the event sheets' address line and segment line.",
    responsive: { tablet: 24, mobile: 22, tabletLh: 30, mobileLh: 28 },
  },
  {
    token: "type-date-primary",
    family: "Cormorant Garamond",
    size: 26,
    weight: 500,
    lh: 32,
    sample: "The major date line on the invite and the event sheets.",
    responsive: { tablet: 24, mobile: 22, tabletLh: 30, mobileLh: 28 },
  },
  {
    token: "type-body",
    family: "Source Sans 3",
    size: 20,
    weight: 400,
    lh: 32,
    sample: "Descriptions, addresses, wishes, all long-form copy.",
    responsive: { tablet: 18, mobile: 17, tabletLh: 28, mobileLh: 26 },
  },
  {
    token: "type-caption",
    family: "Source Sans 3",
    size: 17,
    weight: 400,
    lh: 24,
    sample:
      "Secondary text accompanying something else — an attribution beneath a passage, a reference beneath a heading. Never long-form. Every reference line in this gallery is set in it.",
    responsive: { tablet: 16, mobile: 15, tabletLh: 24, mobileLh: 22 },
  },
  {
    token: "type-eyebrow",
    family: "Source Sans 3",
    size: 16,
    weight: 500,
    lh: 22,
    sample:
      "ALWAYS GOLD — the one type role that carries its own color, on both stocks, in every section. There is no eyebrow component: the class is the whole thing.",
    responsive: { tablet: 15, mobile: 14, tabletLh: 20, mobileLh: 20 },
  },
  {
    token: "type-action",
    family: "Source Sans 3",
    size: 17,
    weight: 700,
    lh: 24,
    sample: "Buttons and calls to action.",
    responsive: { tablet: 16, mobile: 15, tabletLh: 20, mobileLh: 20 },
  },
];

const TYPE_RULES = [
  "The script face is decorative. It carries the couple names and the Event Info sheet headings, and may take other display text later, but never body copy, labels, buttons, or any other heading.",
  "heading-script is the one heading the script face sets — the Event Info sheet names, Corinthia 400, set solid (line height equal to size). An owner decision that narrows the rule above to this one role.",
  "Couple names stay regular weight at every tier. Corinthia's true bold cut was rendered and rejected: it is 1.28x wider than regular — a full name pair measures 6.48x the font size against 5.08x — which the frame cannot hold on one line at the tablet and laptop sizes.",
  'The couple-names role sets three lines in portrait windows — each name on its own line with "&" between them at 0.5em, 0.9 line spacing across the block — and stays one line at normal spacing in landscape. The split is a property of the role wherever it is used, not a one-off in a section.',
  "Long-form copy and all other functional information stays in Cormorant Garamond and Source Sans 3.",
  "Both serif and sans carry regular, medium and bold weights. Bold marks structural headings and actions; medium marks the eyebrow and the date line; couple names and body copy stay regular. The date line separates from heading-lg at the same size by weight — medium beside heading-lg's bold — rather than by scale.",
  "heading-lg and date-primary step together at every tier — 22 / 24 / 26 across phone, tablet and laptop — one size separated by weight, never by scale, so moving either alone would make the date read as subordinate to the bold line beside it. The tablet step of 24 replaces the earlier ladder in which tablet and laptop shared 26.",
  'The date line carries no letterspacing and sits at medium weight (500). Zero tracking replaces the previous 0.06em, a display-caps amount that read "off" on a mixed-case serif and narrowed the line 13% at 26px (301px to 261px). Weight 500 answers Cormorant reading thin beside the 120px couple names.',
  "Mobile sizing may scale responsively, but hierarchy and font roles are unchanged across viewports.",
  "Body steps with width — 17px at the phone tier is the floor, rising to 18px at tablet and 20px at laptop, on line heights of 26 / 28 / 32px. This site-wide scale supersedes the 18 / 19 / 20 ladder at a fixed 1.7 leading. The phone step stayed at 17 because the sans had earlier read too small at every size below the old flat 17, so the floor holds at 17 while its line height tightens to 26.",
  "Every role sets an explicit line height at every tier, in pixels — nothing inherits its leading. The rows above carry each tier as size / line height.",
  "The couple names keep 1.5 leading on one line (108 / 156 / 180px); the three-line portrait form keeps its 0.9, a ratio of the name size rather than a pixel value, applied only in portrait windows.",
  "The date line's raised ordinal takes no line height. It is set in caption and raised; left to its own leading it pushed the date line past its line height (30.3 against 28px on phones), so the line's box is exactly the role's line height at every tier — on the invite and the event sheets alike.",
  "Every value in the scale was confirmed by the owner as one site-wide scale, rendered with the invite and Event Info together before it was accepted.",
  "type-caption is the only role smaller than body, and it is scoped away from long-form — text that accompanies something else, read in a glance, never a paragraph read continuously. Its tighter line height is part of that scoping rather than a styling preference.",
  "Unlike the eyebrow, type-caption owns no color: it takes ink on paper — 11.74:1 on the ground, 12.05:1 on the paper stock — and ink-on-contrast at 12.55:1 on the green stock, so it is legal on both without an exception. Hierarchy here comes from size alone, which is what engraved stock does — one ink, struck once, the secondary line set smaller rather than lightened.",
  "The eyebrow is the one type role that carries its own color, so there is no eyebrow component. Always gold, never ink, on every stock, in every section.",
  "The eyebrow sits one size step below the caption at every tier — 16 / 15 / 14px against caption's 17 / 16 / 15px. Tried at caption's own size and rejected: uppercase and widely letterspaced, it read larger than its number.",
  "The eyebrow is used above family group headings, section headings, and the fields inside a sheet.",
  "Tracking and casing sit in the token registry rather than the metadata column: eyebrow 0.2em uppercase, action 0.16em uppercase. The date line carries none.",
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
  "Between two unframed sections back to back: space-2xl (64px) to space-3xl (96px).",
  "Sections without a frame keep the viewport-edge step, space-md (24px) at every tier — the timeline — until its own pass decides its edge.",
  "A framed section takes its ground from the window instead of a fixed step: space-sm (16px) at the phone tier, space-xl (48px) at tablet, space-3xl (96px) at laptop — how ground and the sheet's padding give way when space runs out is owned by Foundations · Layout → mounted-sheet.",
  "Two framed sections back to back are separated by their own ground rather than the between-sections step — at least 32px, 96px and 192px apart at full phone, tablet and laptop ground.",
  "A landscape window's side ground is a layout value, not a spacing step, with its own rule in mounted-sheet → The frame; its 192px minimum at full laptop ground is off the scale by design.",
  "Halved grounds — space-2xs (8px), space-md (24px), space-xl (48px) — are all on the scale.",
  "The ground stops climbing at the laptop tier: past the card's caps a bigger landscape window turns its extra space into ground on its own.",
  "Content never hugs the viewport edge; vertical rhythm stays consistent across sections.",
  "Named steps carry a space- prefix: the bare t-shirt keys double as the styling framework's width-scale keys, and the spacing value silently wins — a width cap named lg resolved to 32px.",
  "The zero step keeps the bare name 0 — it collides with nothing, and prefixing it stops every zero-valued step resolving. Its bar is correctly invisible.",
];

const LAYOUT_RULES = [
  "Each major section is composed around one viewport height, with the timeline as the deliberate exception.",
  "Content width caps at 1200px and text blocks at 600px; sheets flex within the grid.",
  "A card framed by mounted-sheet caps at 1200px wide and --card-height-cap (720px) tall — the width cap is the content cap above. Both bind landscape windows only; a portrait window's card is never capped.",
  "Sections alternate between dense composition (event info) and airy composition (invite, wishes) so no two adjacent sections carry equal visual weight.",
  "Whitespace is structural, not leftover space.",
  "The two width caps are stated only in DESIGN.md prose, reported as drift; the token layer emits them as --container-content and --container-text. The height cap has a real YAML entry and sits outside that namespace as --card-height-cap — a height rather than a width, so it mints no width utility.",
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
  "--duration-base (400ms) for section entry reveals, sheet reveals, and modal open and close.",
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
    usage: "Retained for the gallery modal. Nothing at section scale uses it.",
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
];

/* § 8 — Elevation & Depth. Two specimen groups in one section, because this one sub-section
   documents two token kinds. The z-order scale therefore has no section of its own: DESIGN.md has
   no Z-Index Scale heading, and minting one would point mapsTo at a heading that does not exist
   (curate-gallery → section-spine.md). */
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
      "Lifts the whole mounted section off the ground. Keeps its shadow at every width, including where it loses its fill and reveal.",
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
  "All three recipes above are warm, because all three land on paper.",
  "The paper stock and the green stock need different CONSTRUCTIONS, not different strengths — a light sheet on a light mount barely casts, a dark sheet on a light mount genuinely does.",
  "Light falls from directly above: none of the three recipes carries a horizontal offset, so every surface darkens evenly on both sides. The mount's crease is the one exception — a fold reads as a fold only under a lateral light, so it is lit from the right, shadowed face to the left of the fold and lit face to the right. Nothing else assumes a side light, and any later treatment that needs one takes this direction rather than picking its own.",
  "Layering adds no heavy assets and does not affect scroll performance.",
];

/* § 9 — Iconography. The six marks as the real components, on both stocks because they take the same
   gold on each, then again at label size because they are never shown without one. The seal follows
   them as the site's icon rather than a member of the set. */
const ICONS = [
  { name: "wedding", marks: "the church ceremony", Icon: WeddingIcon },
  { name: "betrothal", marks: "the betrothal", Icon: BetrothalIcon },
  { name: "reception", marks: "the reception", Icon: ReceptionIcon },
  { name: "lunch", marks: "the betrothal lunch", Icon: LunchIcon },
  { name: "love", marks: "the closing wishes", Icon: LoveIcon },
  { name: "map", marks: "a venue's map link", Icon: MapIcon },
];

const ICON_RULES = [
  "Six marks drawn for this invitation, traced from those drawings. A closed set, not an icon library — there is no Lucide, no icon dependency, and a seventh mark means drawing one.",
  "The marks are filled outline, not stroked line. Their weight is the drawn line's own, so they carry no stroke token and the line stays proportional as a mark scales rather than holding a hairline. None should be added for the set.",
  "accent-gold on BOTH stocks, taken from the surface rather than set on the mark, so one file serves the ivory and the green. Measures 2.46:1 on the paper stock and 5.72:1 on the green stock.",
  "Decorative and never shown without a text label beside them. That is what keeps them clear of the 3:1 a meaning-bearing mark would owe — a constraint on every use, not a description of the current ones. A mark used alone leaves the exception and needs ink.",
  "Sizing matches the diagonal, not width or height: the plate is 1.28 wide to tall and the map pin 0.65, so matching either dimension makes some read large and others small.",
  "Each mark carries an optical nudge on top of that span, from measured ink density rather than eye — at an equal span the church lays down 8.2% ink and the plate 21%. The nudges run 0.88 to 1.03.",
  "wedding and betrothal carry an added stroke in their own colour, because they read lighter than the rest. A filled outline has no stroke width to raise, so a same-colour stroke is the only way to thicken one; the other four take none.",
  "Each mark is cropped to its own content. The sources carried very different amounts of empty padding, which is what made them read at different sizes before cropping.",
  "The intended feel is etched line work rather than UI iconography.",
];

/* § Paper Grain. Each tile is painted with the real surface class, so the grain shown is the grain
   the system applies rather than a reproduction of it. Captions carry the measured painted value,
   which is not the surface token for three of the four. */
const GRAIN_SURFACES = [
  {
    caption: "multiply 0.03 · paints #F8F7F3",
    label: "Ground",
    surface: "bg-surface-base",
  },
  {
    caption: "overlay 0.40 · paints #ECE6D7",
    label: "Mount",
    surface: "bg-surface-mount",
  },
  {
    caption: "hard-light 0.05 · paints #FDFCF8",
    label: "Paper stock",
    surface: "bg-surface-elevated",
  },
  {
    caption: "hard-light 0.10 · paints #0D3226",
    label: "Green stock",
    surface: "bg-surface-contrast",
  },
];

const GRAIN_RULES = [
  "A surface takes the treatment its own lightness allows, which is why the four differ rather than sharing one. A mid-tone has room in both directions and keeps its colour exactly; a near-white has room only below, so its texture can only come from darkening; a dark stock has room only above.",
  "Both stocks share one treatment and differ only in strength — it textures the ivory downward and the green upward, so the ivory keeps its highlights and the green keeps its shadows.",
  "The ground is deliberately off its token, painting #F8F7F3 rather than #FCFBF7. That is what separates it from the sheet laid on it. This is a decision, not drift.",
  "A surface grains only itself: the noise blends against that surface's own fill, so a sheet never tints the ground it covers.",
  "The fibre is one repeating tile at 200px, resolved at the screen's own density — left at its own size it is upscaled on a high-density display and reads as blotches rather than fibre.",
  "The grain is static, never animated, and carries no meaning. Every contrast pair was re-measured against the grained surfaces and all hold.",
];

const SEAL_RULES = [
  "Not a seventh member of the set. The six mark content and always sit beside a label; the seal stands alone as the site's identity and never appears inside a section.",
  "The one mark that is not gold. It carries thread-red because it is the thread, and because gold holds only 2.39:1 against a light browser tab.",
  "Cropped tight — the mark fills 97% of the icon's width, 95% of its height. Air around it reads as a smaller mark; tighter and the notch between the lobes narrows before the margin runs out.",
  "Decided at 16px before it is judged at any other size. A mark that reads only when large has not been decided. At 16px it holds 70 of 256 pixels solid and 7.05:1 against a light tab.",
  "The drawn line takes an added stroke in its own colour, the thickening wedding and betrothal also carry, landing the line at 1.65px on a 16-pixel grid.",
  "That weight is bounded both ways: heavier closes the notch between the heart's lobes and fattens the thread into a ribbon; lighter dissolves into a pale smear at 16px.",
  "The thread's cut ends are angled, not square, so a trimmed filled outline reads as a thread rather than as a chop.",
  "One scalable drawing serves every size the browser asks for, rather than a raster resampled per size.",
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
        intro="Three families with strictly divided roles. The script face is decorative; outside the Event Info sheet headings it never carries functional information."
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
        intro="Desktop composes in parallel splits; mobile flows vertically and splits the family section into separate screen-feel panels. Event Info sits side by side in landscape windows at breakpoints.lg and wider, and stacks otherwise, per mounted-pair below."
        mapsTo="Foundations → Layout"
        title="Foundations · Layout"
      >
        <RuleList rules={LAYOUT_RULES} />

        <Specimen
          description="The card every section is built on — a backing mount with an inner sheet laid onto it, framed to fill the window wherever a section supplies its measured fit. Shown here WITHOUT a fit, exactly as a specimen box always renders it."
          id="layout-mounted-sheet"
          name="mounted-sheet"
          source="@/components/layout/mounted-sheet"
          spec={[
            "Two stocks, one mount, square on both layers. The mount never changes colour — only the inner stock does — and carries no text.",
            "Rendered here without a measured fit, the same way a specimen box or a long scrolling section is: the sheet's padding climbs with width instead of the ground — space-lg (32px) below md, space-2xl (64px) to lg, space-3xl (96px) above — and a non-hero mount drops its fill and reveal below the md breakpoint rather than at a ground tier. Resize the window to watch it.",
            "The reveal ladder still applies wherever the mount shows — 16px at lg and above, 12px below it.",
            "The mount keeps its shadow at every width, so an unmounted sheet still lifts off the ground.",
            "GIVEN a section's measured fit, this same component frames instead: the card fills the window inside its ground — phone 16px, tablet 48px, laptop 96px — up to 1200 x 720px on landscape windows only, always centred and centred safely. Padding gives way before the ground halves, and content is never hidden.",
            "A touchscreen-first window — primary pointer coarse — never takes laptop ground: at lg and wider it takes tablet ground with desktop type. Type follows the width tiers alone and never shrinks.",
            "A framed window drops to the phone ground tier below its own tier line, derived per section from that section's measured content by a committed script, never typed — two sections can change tier at different heights.",
            "A tier line must exist. If no height lets the larger tier fit the section's content, or the only such height is not below the narrowest window its class covers, the build fails rather than shipping a guess; this is the frame's one layout failure. A card wider than 720px at its tier's smallest padding is not refused; a conservative height bound decides whether the ground halves.",
            "A section's measured fit carries heights per width tier AND per orientation, not one set per tier — a section whose content differs by orientation, the invite's three-line portrait names among them, needs both, or its portrait content is judged against the landscape card's height cap and refused. A tier line always reads the section's landscape fit, because every tier line sits below its narrowest width, which the rule above already places in landscape. The cost is the generated stylesheet's size, which roughly doubles once a section measures per orientation — about 2KB to 4KB compressed.",
            "A pair frames through the same mechanism with its own rules — see mounted-pair below.",
            "None of that answers to a specimen box, which has no window to fit — it is demonstrated on the page itself, at /, where the invite and Event Info take the frame.",
          ]}
        >
          <div className="flex flex-col gap-space-lg">
            <MountedSheet hero>
              <div className="flex flex-col gap-space-2xs">
                <p className="type-eyebrow">The invitation</p>
                <p className="type-body text-ink">
                  Paper stock, the invite — the one section that keeps its mount
                  below the md breakpoint.
                </p>
              </div>
            </MountedSheet>
            <MountedSheet>
              <div className="flex flex-col gap-space-2xs">
                <p className="type-eyebrow">Where and when</p>
                <p className="type-body text-ink">
                  Paper stock, ordinary section — its mount disappears below the
                  md breakpoint.
                </p>
              </div>
            </MountedSheet>
            <MountedSheet stock="contrast">
              <div className="flex flex-col gap-space-2xs">
                <p className="type-eyebrow">With all our love</p>
                <p className="type-body">
                  Green stock — a real drop shadow and no inset highlight, and
                  it rebinds the focus ring on its own subtree.
                </p>
              </div>
            </MountedSheet>
          </div>
        </Specimen>

        <Specimen
          description="Two sheets pasted onto one mount — the layout the two events take. The mount is a single card creased down the middle and opened flat."
          id="layout-mounted-pair"
          name="mounted-pair"
          source="@/components/layout/mounted-pair"
          spec={[
            "Same mount as mounted-sheet, on its reveal ladder wherever the mount shows, and the reveal shows BETWEEN the two sheets as well as around them.",
            "Given a section's measured fit, the pair takes the frame as mounted-sheet does — the same ground tiers, caps, give-way order and tier lines. A pair is never the hero.",
            "The sheets sit side by side in every landscape window at lg and wider, at any height. Everywhere else they stack: every phone, sideways ones included, every tablet, and portrait laptop-width windows. Width and orientation alone decide the switch; the tier lines decide only ground and padding.",
            "Side by side, the shared mount stays at every ground tier at a 16px reveal, even where the window takes the phone ground tier, and the padding is the largest step that fits the section's own content. Each sheet aligns its content to the top: the sheets share one height, and centred content of different heights set the headings about 16px apart across the fold at 1440px.",
            "Stacked, no sheet carries a mount at any width — no fill, no reveal, no grain — and each card keeps shadow-mount so it still lifts off the ground. Stacked cards sit twice the ground apart, and stay centred, as single cards do.",
            "Stacked sheets take the invite's padding, so a stacked event card reads like the invite card: the chain is judged against the invite's measured fit and the hero reveal, while the ground, its halving, the padding steps and the landscape cap stay the event card's own. Wherever the two sections share a ground, the stacked padding matches the invite's. Event content taller than that card grows the card rather than stepping the padding down.",
            "A pair's sheet is roughly half the width of a full-width one, so its margin runs proportionally heavier than a single sheet's — accepted.",
            "A pair works its laptop and touchscreen tier lines out side by side at 1280px, not at lg, and applies them only from 1280px up: every pair window from lg to 1280px takes the phone ground tier at desktop type, whatever its height or primary pointer. Its tablet tier line reads a stacked sheet with no reveal.",
            "Side by side, a card at content width c and padding p is 2 × (c + 2p) + 4 × the reveal wide. The fit is the taller of the two sheets at each content width, so both stacked cards change ground and padding at the same window sizes.",
            "The gap is TWICE the reveal — 32px wherever the framed pair sits side by side; the unframed form shown here, side by side from md, takes 24px below lg — because each sheet is centred on its own leaf of the opened card: the sheet's reveal on the fold side meets the other sheet's at the crease, so half the gap equals the outer reveal exactly.",
            "The mount carries its crease at the fold, 22px wide, lit from the right, hidden wherever a sheet covers it — and only side by side, since an unfolded card has no fold.",
            "A section is a single elevation: the mount and its sheet. Never nest a second elevated card inside one — two co-equal items share one mount through this component rather than doubling the lift.",
            "Rendered here WITHOUT a fit, the form that serves specimen boxes only: below md the mount goes and the sheets stack, each taking shadow-mount in place of shadow-sheet because standing on the ground it does the lifting the mount was doing; from md the sheets sit side by side on the shared mount. The framed form is on the page itself, at /, as Event Info.",
            "Resize the window to watch all of it happen together.",
          ]}
        >
          <MountedPair>
            <div className="flex flex-col gap-space-2xs">
              <p className="type-heading-script text-ink">Betrothal</p>
              <p className="type-body text-ink">4 January 2027 · Kozhikode</p>
            </div>
            <div className="flex flex-col gap-space-2xs">
              <p className="type-heading-script text-ink">Wedding</p>
              <p className="type-body text-ink">
                9 January 2027 · Koothattukulam
              </p>
            </div>
          </MountedPair>
        </Specimen>

        <Specimen
          description="Thin rule separating grouped content within a section — --stroke-divider (1px) in accent-gold."
          id="layout-divider"
          name="divider"
          source="@/components/layout/divider"
          spec="Used as the short rule after an event sheet's heading block and between family groupings, not between sections — section separation is spatial. The event segments carry none between them."
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
        intro="Section surfaces are square — the mount and both stocks take no radius at all. The soft rectangle belongs to smaller elements, the circle is reserved for portraits, and the pill is unusable at section scale."
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
        id="paper-grain"
        intro="A static noise laid into every surface so the stocks read as material rather than as flat fill. It is generated rather than an asset, so it adds no image, no element, and nothing to load. View at full size — any downscaling averages the grain away."
        mapsTo="Foundations → Paper Grain"
        source="--grain-*"
        title="Foundations · Paper Grain"
      >
        <Specimen
          description="Every grained surface, each tile painted with the real surface class rather than a copy of it."
          id="paper-grain-surfaces"
          name="The four surfaces"
          spec="Live render. The grain arrives with the surface token, so these tiles are grained by being that surface — nothing here applies a texture of its own."
        >
          <div className="flex flex-wrap gap-space-md">
            {GRAIN_SURFACES.map((item) => (
              <figure className="m-0" key={item.surface}>
                {/* The tile needs a bound because the page itself is painted with the ground
                    surface, so that one is otherwise invisible. It takes the documented divider,
                    this system's only stated hairline, as ColorCard and Card already do — not a
                    stroke of its own. 220x132 is a gallery layout constant, not a design token. */}
                <div
                  className={`h-[132px] w-[220px] border-(length:--stroke-divider) border-accent-gold ${item.surface}`}
                />
                <figcaption className="mt-space-xs flex flex-col gap-space-3xs">
                  <span className="type-caption text-ink">{item.label}</span>
                  <span className="type-caption text-ink">{item.caption}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </Specimen>

        <RuleList label="Grain rules" rules={GRAIN_RULES} />
      </GallerySection>

      <GallerySection
        id="iconography"
        intro="Six marks drawn for this invitation, plus the seal mark, which is the site's icon rather than a member of the set. The six are shown on both stocks because they take the same gold on each, and at label size beneath, because they are never shown without a label."
        mapsTo="Foundations → Iconography"
        source="@/components/icons"
        title="Foundations · Iconography"
      >
        <Specimen
          description="Every mark in the set, at an optical span of 96px."
          id="iconography-set"
          name="The set"
          source="@/components/icons"
          spec={[
            "Sized on the diagonal so marks of very different proportion read at one span, then nudged per mark from measured ink density.",
            "wedding and betrothal carry an added same-colour stroke because a filled outline has no stroke width to raise.",
          ]}
        >
          <div className="flex flex-col gap-space-md">
            <div className="flex flex-wrap items-center gap-space-lg bg-surface-elevated p-space-md text-accent-gold">
              {ICONS.map(({ name, Icon }) => (
                <Icon key={name} size={96} />
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-space-lg bg-surface-contrast p-space-md text-accent-gold">
              {ICONS.map(({ name, Icon }) => (
                <Icon key={name} size={96} />
              ))}
            </div>
          </div>
        </Specimen>

        <Specimen
          description="Each mark with the label it never appears without."
          id="iconography-labelled"
          name="Marks and what they mark"
          spec="The label is what keeps the mark decorative. Alone, a mark would owe 3:1 and gold's 2.46:1 on the paper stock would fail it."
        >
          <div className="flex flex-wrap gap-space-lg bg-surface-elevated p-space-md">
            {ICONS.map(({ name, marks, Icon }) => (
              <span className="flex items-center gap-space-2xs" key={name}>
                <span className="text-accent-gold">
                  <Icon size={32} />
                </span>
                <span className="type-caption text-ink">
                  {name} — {marks}
                </span>
              </span>
            ))}
          </div>
        </Specimen>

        <RuleList label="Rules" rules={ICON_RULES} />

        <Specimen
          description="The site's browser icon: a thread drawn into a heart where it crosses itself, cropped to the heart with a short length of thread either side. Shown at the sizes a browser actually asks for, and large enough to read the drawing."
          id="iconography-seal"
          name="The seal mark"
          source="app/icon.svg"
          spec="Served from the shipped asset, not a copy — what renders here is the file the browser gets. It is the one mark outside the closed set of six, and the one that is not gold."
        >
          <div className="flex flex-wrap items-end gap-space-lg bg-surface-elevated p-space-md">
            {[16, 32, 48, 128].map((px) => (
              <span
                className="flex flex-col items-center gap-space-2xs"
                key={px}
              >
                <Image alt="" height={px} src="/icon.svg" width={px} />
                <span className="type-caption text-ink">{px}px</span>
              </span>
            ))}
          </div>
        </Specimen>

        <RuleList label="Seal rules" rules={SEAL_RULES} />
      </GallerySection>
    </>
  );
}
