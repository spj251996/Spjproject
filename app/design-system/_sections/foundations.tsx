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
import { OrnamentalDivider } from "@/components/layout/ornamental-divider";

const COLOR_GROUPS: SwatchGroup[] = [
  {
    label: "Surfaces",
    tokens: [
      {
        token: "--color-surface-base",
        name: "surface-base",
        usage: "The ivory ground behind the whole page.",
      },
      {
        token: "--color-surface-mount",
        name: "surface-mount",
        usage: "The mount behind every mounted section. No text.",
      },
      {
        token: "--color-surface-elevated",
        name: "surface-elevated",
        usage: "The paper stock laid on the mount.",
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
          "Body text, names, dates, venues and addresses; the focus ring on light surfaces.",
      },
      {
        token: "--color-ink-muted",
        name: "ink-muted",
        usage:
          "A quieter register: section headings, the invite's passage and citation, Wishes' attribution and sign-off, Family's relationships.",
      },
      {
        token: "--color-ink-inverse",
        name: "ink-inverse",
        usage:
          "Light text on a dark scrim — the design-system gallery's own preview modal (dev-only).",
      },
    ],
  },
  {
    label: "Accent",
    note: "Recorded AA exception on ivory, 2.39:1 — the eyebrow, the engraved rule's label and the six marks only.",
    tokens: [
      {
        token: "--color-accent-gold",
        name: "accent-gold",
        usage:
          "Eyebrows, engraved rules, dividers, portrait rims, active states.",
      },
    ],
  },
  {
    label: "Thread",
    note: "Reserved for the thread and the seal mark.",
    tokens: [
      {
        token: "--color-thread-red",
        name: "thread-red",
        usage: "The thread and its wisp.",
      },
      {
        token: "--color-thread-vermilion",
        name: "thread-vermilion",
        usage: "The thread's glow only. Never a stroke or text.",
      },
    ],
  },
  {
    label: "Shadow tint",
    tokens: [
      {
        token: "--color-shadow-warm",
        name: "shadow-warm",
        usage: "The tint of every shadow that lands on paper.",
      },
    ],
  },
];

const TYPE_TOKENS: TypeToken[] = [
  {
    token: "type-display-name",
    family: "Corinthia",
    weight: 400,
    sample: "Bride & Groom",
    phone: { size: 94, lh: 141 },
    tablet: { size: 135, lh: 203 },
    compact: { size: 125, lh: 188 },
    desktop: { size: 156, lh: 234 },
  },
  {
    token: "type-heading-script",
    family: "Corinthia",
    weight: 400,
    sample: "Betrothal",
    phone: { size: 56, lh: 56 },
    tablet: { size: 72, lh: 72 },
    compact: { size: 64, lh: 64 },
    desktop: { size: 80, lh: 80 },
  },
  {
    token: "type-heading-xl",
    family: "Playfair Display",
    weight: 700,
    sample: "Section-level H1.",
    phone: { size: 26, lh: 40 },
    tablet: { size: 32, lh: 48 },
    compact: { size: 30, lh: 44 },
    desktop: { size: 38, lh: 56 },
  },
  {
    token: "type-heading-lg",
    family: "Playfair Display",
    weight: 700,
    sample:
      "Serif sub-headings; the event sheets' address line and segment line.",
    phone: { size: 14, lh: 28 },
    tablet: { size: 15, lh: 30 },
    compact: { size: 14, lh: 28 },
    desktop: { size: 17, lh: 32 },
  },
  {
    token: "type-date-primary",
    family: "Playfair Display",
    weight: 700,
    sample: "The major date line on the invite and the event sheets.",
    phone: { size: 14, lh: 28 },
    tablet: { size: 15, lh: 30 },
    compact: { size: 14, lh: 28 },
    desktop: { size: 17, lh: 32 },
  },
  {
    token: "type-body",
    family: "Libre Baskerville",
    weight: 400,
    sample: "Descriptions, addresses, wishes, all long-form copy.",
    phone: { size: 13, lh: 26 },
    tablet: { size: 14, lh: 28 },
    compact: { size: 13, lh: 26 },
    desktop: { size: 16, lh: 32 },
  },
  {
    token: "type-body-italic",
    family: "Libre Baskerville",
    weight: 400,
    sample:
      "The closing sign-off's lead line, and the timeline's promise line.",
    phone: { size: 13, lh: 26 },
    tablet: { size: 14, lh: 28 },
    compact: { size: 13, lh: 26 },
    desktop: { size: 16, lh: 32 },
  },
  {
    token: "type-caption",
    family: "Libre Baskerville",
    weight: 400,
    sample:
      "Secondary text accompanying something else — an attribution beneath a passage, a reference beneath a heading, a relationship beneath a name. Never long-form.",
    phone: { size: 12, lh: 22 },
    tablet: { size: 13, lh: 24 },
    compact: { size: 12, lh: 22 },
    desktop: { size: 14, lh: 24 },
  },
  {
    token: "type-caption-italic",
    family: "Libre Baskerville",
    weight: 400,
    sample:
      "A citation set beneath its caption-styled parent — the invite's citation beneath its passage.",
    phone: { size: 12, lh: 22 },
    tablet: { size: 13, lh: 24 },
    compact: { size: 12, lh: 22 },
    desktop: { size: 14, lh: 24 },
  },
  {
    token: "type-eyebrow",
    family: "Libre Baskerville",
    weight: 400,
    sample: "Small labels above headings and sheet fields.",
    phone: { size: 10, lh: 20 },
    tablet: { size: 11, lh: 20 },
    compact: { size: 10, lh: 20 },
    desktop: { size: 12, lh: 22 },
  },
  {
    token: "type-action",
    family: "Libre Baskerville",
    weight: 700,
    sample: "Buttons and calls to action.",
    phone: { size: 11, lh: 20 },
    tablet: { size: 12, lh: 20 },
    compact: { size: 11, lh: 20 },
    desktop: { size: 13, lh: 24 },
  },
];

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
  { token: "space-4xl", px: 128 },
  { token: "space-5xl", px: 172 },
];

const SPACING_USES = [
  "0 · flush edges, collapsed gaps",
  "space-2xs to space-sm · tight grouping",
  "space-sm to space-md · component padding",
  "space-md · viewport edge for sections without a frame",
  "space-2xl to space-3xl · between two unframed sections back to back",
  "space-4xl · between the bride's siblings in Family",
];

const LAYOUT_CAPS = [
  "--container-content · 1200px · all content; a framed card's width from xl, landscape windows only",
  "--container-content-compact · 960px · a framed card's width, lg to xl, landscape windows only",
  "--container-text · 600px · text blocks",
  "--card-height-cap · 720px · a framed card's height from xl, landscape windows only",
  "--card-height-cap-compact · 576px · a framed card's height, lg to xl, landscape windows only",
];

const FRAME_GROUND_TIERS = [
  "Phone · below md; any wider window below its tier line; a pair's landscape windows lg to 1280px · ground, landscape space-sm (16px), halved space-2xs (8px) · padding space-lg · space-md · space-sm (32 · 24 · 16px)",
  "Tablet · md to lg; touchscreen-first from lg · ground, landscape space-xl (48px), halved space-md (24px) · padding space-2xl · space-xl · space-lg (64 · 48 · 32px)",
  "Compact laptop · lg to xl, primary pointer not coarse · ground, landscape space-2xl (64px), halved space-lg (32px) · padding space-2xl · space-xl · space-lg · space-md (64 · 48 · 32 · 24px)",
  "Desktop · xl and up, primary pointer not coarse · ground, landscape space-3xl (96px), halved space-xl (48px) · padding space-3xl · space-2xl · space-xl · space-lg (96 · 64 · 48 · 32px)",
];

const FRAME_PORTRAIT_BAND = [
  "Phone · block space-3xl (96px), inline space-md (24px) · given way space-xl · space-sm (48 · 16px)",
  "Tablet · block space-5xl (172px), inline space-4xl (128px) · given way space-3xl · space-2xl (96 · 64px)",
  "Compact laptop and desktop · square: each axis takes that tier's landscape ground, and its given-way ground with it",
];

const IMAGERY_POINTERS = [
  "Family portraits · circular crops → Components · UI → portrait",
  "A delivered portrait · at least 3× its rendered diameter, never upscaled",
  "Gallery images · masonry, inside the modal only → Components · UI → gallery-modal",
  "Couple illustration · held back behind the closing text → Domain · Wishes",
];

const DURATION_TOKENS: DurationToken[] = [
  { token: "--duration-fast", ms: 200 },
  { token: "--duration-base", ms: 400 },
  { token: "--duration-slow", ms: 700 },
];

const DURATION_USES = [
  "fast · state changes: node activation glow, action feedback",
  "base · section and sheet reveals, the modal",
  "slow · the invite thread draw-in and the family thread wrap",
];

const EASING_TOKENS: EasingToken[] = [
  { token: "--ease-entrance", curve: [0, 0, 0.2, 1] },
  { token: "--ease-settle", curve: [0.4, 0, 0.2, 1] },
];

const EASING_USES = [
  "entrance · anything appearing",
  "settle · anything the thread does",
];

const SHAPE_ITEMS: ShapeItem[] = [
  {
    token: "square",
    radius: "0",
    value: "0",
    usage:
      "Every section surface. image-placeholder takes its container's shape.",
  },
  {
    token: "--radius-sm",
    radius: "var(--radius-sm)",
    value: "8px",
    usage: "gallery-modal's tiles and close control; timeline-node's previews.",
  },
  {
    token: "--radius-lg",
    radius: "var(--radius-lg)",
    value: "16px",
    usage: "No current use.",
  },
  {
    token: "circle",
    radius: "9999px",
    value: "—",
    usage:
      "portrait's crop; timeline-node's node dot; the Timeline placeholder's ritual mark.",
  },
];

const DEPTH_LEVELS: DepthLevel[] = [
  {
    name: "The ground",
    spec: "surface-base · no shadow",
    className: "bg-surface-base",
    usage:
      "Everything else sits on it. This card matches the page's own ground.",
  },
  {
    name: "Mount on the ground",
    spec: "surface-mount · shadow-mount",
    className: "bg-surface-mount shadow-mount",
    usage: "Two soft drops lift the whole section.",
  },
  {
    name: "Paper stock on the mount",
    spec: "surface-elevated · shadow-sheet",
    className: "bg-surface-elevated shadow-sheet",
    usage: "Inset white highlight, faint drop.",
  },
];

const ICONS = [
  {
    name: "wedding",
    marks: "the church ceremony",
    nudge: "1",
    stroke: true,
    Icon: WeddingIcon,
  },
  {
    name: "betrothal",
    marks: "the betrothal",
    nudge: "0.97",
    stroke: true,
    Icon: BetrothalIcon,
  },
  {
    name: "reception",
    marks: "the reception",
    nudge: "1.02",
    stroke: false,
    Icon: ReceptionIcon,
  },
  {
    name: "lunch",
    marks: "the betrothal lunch",
    nudge: "0.92",
    stroke: false,
    Icon: LunchIcon,
  },
  {
    name: "love",
    marks: "the closing wishes",
    nudge: "1.03",
    stroke: false,
    Icon: LoveIcon,
  },
  {
    name: "map",
    marks: "a venue's map link",
    nudge: "0.88",
    stroke: false,
    Icon: MapIcon,
  },
];

const GRAIN_SURFACES = [
  {
    caption: "multiply 0.28 · warm off-white, per channel",
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
];

export function FoundationsSections() {
  return (
    <>
      <GallerySection
        id="colors"
        intro="A fixed palette: ivory, mahogany ink, one gold, and one warm red for the thread."
        mapsTo="Foundations → Colors"
        source="app/styles/tokens.css"
        title="Foundations · Colors"
      >
        <SwatchGrid groups={COLOR_GROUPS} />
      </GallerySection>

      <GallerySection
        id="typography"
        intro="Three families, nine roles, each stepping at phone, tablet, compact and desktop."
        mapsTo="Foundations → Typography"
        source="app/styles/tokens.css · app/styles/type-scale.css"
        title="Foundations · Typography"
      >
        <Specimen
          description="Each role with its size / line height in px at phone, tablet, compact and desktop; the sans and serif samples state their use. display-name's portrait three-line form, at a 0.9 line height, is shown below."
          id="typography-scale"
          name="The scale"
          note="Samples render at the window's current tier. The two script rows: display-name is the invite's couple names; heading-script is Wishes' couple names, the script face's only other section-level use."
        >
          <TypeScaleList tokens={TYPE_TOKENS} />
        </Specimen>

        <Specimen
          description="The couple names in both script roles — display-name above, heading-script below — and the date line, set with their real role classes."
          id="typography-names-and-date"
          name="Names and date line"
          note="Rotate or resize to portrait to see display-name split onto three lines; the split belongs to that role alone. The date line's raised ordinal takes no line height."
          spec="display-name · heading-script · joiner at 0.5em · date-primary · caption ordinal"
        >
          <div className="flex flex-col items-center gap-space-lg bg-surface-elevated p-space-md text-center shadow-sheet">
            <p className="type-display-name text-ink">
              <span>Bride</span>
              <span className="type-display-name__joiner">{" & "}</span>
              <span>Groom</span>
            </p>
            <p className="type-heading-script text-ink">
              <span>Bride</span>
              <span className="type-heading-script__joiner">{" & "}</span>
              <span>Groom</span>
            </p>
            <p className="type-date-primary text-ink">
              Saturday, 1
              <span className="type-caption type-date-ordinal align-super">
                st
              </span>{" "}
              January 2000
            </p>
          </div>
        </Specimen>
      </GallerySection>

      <GallerySection
        id="spacing"
        intro="A 4px base unit; only scale steps are used, zero included."
        mapsTo="Foundations → Spacing"
        source="--spacing-*"
        title="Foundations · Spacing"
      >
        <BarScale items={SPACING_STEPS} varPrefix="--spacing-" />
        <RuleList label="Uses" rules={SPACING_USES} />
      </GallerySection>

      <GallerySection
        id="layout"
        intro="Parallel splits on desktop, vertical flow on mobile; every section is built on the mounted card, though how the timeline is framed is still open."
        mapsTo="Foundations → Layout"
        source="--container-* / --card-height-cap"
        title="Foundations · Layout"
      >
        <RuleList label="Caps" rules={LAYOUT_CAPS} />
        <RuleList
          label="Ground and padding, by tier"
          rules={FRAME_GROUND_TIERS}
        />
        <RuleList
          label="The portrait band — block above and below the card, inline beside it"
          rules={FRAME_PORTRAIT_BAND}
        />

        <Specimen
          description="The card every section is built on: a backing mount with an inner sheet laid onto it."
          id="layout-mounted-sheet"
          name="mounted-sheet"
          note="Unframed, as every specimen box is. Resize below md: padding steps down and non-hero mounts drop fill and reveal. The framed form is live at /."
          source="@/components/layout/mounted-sheet"
          spec="surface-mount · shadow-mount · paper stock · square · reveal"
        >
          <div className="flex flex-col gap-space-lg">
            <MountedSheet hero>
              <div className="flex flex-col gap-space-2xs">
                <p className="type-eyebrow">Hero</p>
                <p className="type-body text-ink">
                  Paper stock with the hero setting.
                </p>
              </div>
            </MountedSheet>
            <MountedSheet>
              <div className="flex flex-col gap-space-2xs">
                <p className="type-eyebrow">Paper stock</p>
                <p className="type-body text-ink">An ordinary section.</p>
              </div>
            </MountedSheet>
          </div>
        </Specimen>

        <Specimen
          description="Two sheets pasted onto one mount, creased down the middle — the layout the two events take."
          id="layout-mounted-pair"
          name="mounted-pair"
          note="Unframed: stacked below md, side by side from md. Resize to see the crease appear in the gap. The framed pairs are Event Info and Family at /."
          source="@/components/layout/mounted-pair"
          spec="one shared mount · gap twice the reveal · crease 22px at the fold"
        >
          <MountedPair>
            <div className="flex flex-col gap-space-2xs">
              <p className="type-heading-xl text-ink">Betrothal</p>
              <p className="type-body text-ink">First sheet</p>
            </div>
            <div className="flex flex-col gap-space-2xs">
              <p className="type-heading-xl text-ink">Wedding</p>
              <p className="type-body text-ink">Second sheet</p>
            </div>
          </MountedPair>
        </Specimen>

        <Specimen
          description="A thin rule within a section: the short rule after an event sheet's heading block."
          id="layout-divider"
          name="divider"
          source="@/components/layout/divider"
          spec="stroke-divider (1px) · accent-gold"
        >
          <div className="flex flex-col gap-space-sm">
            <p className="type-body text-ink">Grouped content</p>
            <Divider />
            <p className="type-body text-ink">Grouped content</p>
          </div>
        </Specimen>

        <Specimen
          description="A drawn divider that sets a passage apart. Decoration, not separation — it carries no separator role, which is the whole difference from divider above."
          id="layout-ornamental-divider"
          name="ornamental-divider"
          source="@/components/layout/ornamental-divider"
          spec="two even hairlines · a four-pointed star in the gap · no taper · height fixed, never derived from width"
        >
          <div className="bg-surface-elevated p-space-xl">
            <OrnamentalDivider />
          </div>
        </Specimen>
      </GallerySection>

      <GallerySection
        id="imagery"
        intro="Where each kind of image lives, and the portrait source rule; none has a specimen of its own here."
        mapsTo="Foundations → Imagery"
        title="Foundations · Imagery"
      >
        <RuleList rules={IMAGERY_POINTERS} />
      </GallerySection>

      <GallerySection
        id="motion"
        intro="Scroll is the primary interaction; these tokens govern discrete transitions only."
        mapsTo="Foundations → Motion"
        source="--duration-* / --ease-*"
        title="Foundations · Motion"
      >
        <SpecimenGroup title="Durations">
          <DurationScale items={DURATION_TOKENS} />
          <RuleList rules={DURATION_USES} />
        </SpecimenGroup>

        <SpecimenGroup title="Easing">
          <EasingCurves items={EASING_TOKENS} />
          <RuleList rules={EASING_USES} />
        </SpecimenGroup>
      </GallerySection>

      <GallerySection
        id="shapes"
        intro="Square at section scale; one radius in use, and circles for two named uses."
        mapsTo="Foundations → Shapes"
        source="--radius-*"
        title="Foundations · Shapes"
      >
        <ShapeRow items={SHAPE_ITEMS} />
      </GallerySection>

      <GallerySection
        id="elevation"
        intro="Depth from paper edge, subtle shadow and tone: three shadow recipes, all tinted warm."
        mapsTo="Foundations → Elevation & Depth"
        source="--shadow-*"
        title="Foundations · Elevation & Depth"
      >
        <DepthGrid levels={DEPTH_LEVELS} />
      </GallerySection>

      <GallerySection
        id="paper-grain"
        intro="A static generated noise laid into every surface."
        mapsTo="Foundations → Paper Grain"
        source="--grain-*"
        title="Foundations · Paper Grain"
      >
        <Specimen
          description="Each tile is painted with the real surface class, so it carries that surface's grain."
          id="paper-grain-surfaces"
          name="The three surfaces"
          note="View at full size — downscaling averages the grain away. The ground tile matches this page's own ground."
          spec="tile 50px · octaves 3 · ground coarseness 0.03 · mount and stock coarseness 0.6"
        >
          <div className="flex flex-wrap gap-space-md">
            {GRAIN_SURFACES.map((item) => (
              <figure className="m-0" key={item.surface}>
                {/* 220x132 is a gallery layout constant. */}
                <div className={`h-[132px] w-[220px] ${item.surface}`} />
                <figcaption className="mt-space-xs flex flex-col gap-space-3xs">
                  <span className="type-caption text-ink">{item.label}</span>
                  <span className="type-caption text-ink">{item.caption}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </Specimen>
      </GallerySection>

      <GallerySection
        id="iconography"
        intro="A closed set of six traced marks, plus the seal mark that serves as the site's icon."
        mapsTo="Foundations → Iconography"
        source="@/components/icons"
        title="Foundations · Iconography"
      >
        <Specimen
          description="Every mark in the set, each above its name, at a 96px span."
          id="iconography-set"
          name="The set"
          source="@/components/icons"
          spec="filled outline · accent-gold from the surface · sized on the diagonal"
        >
          <div className="flex flex-wrap items-end gap-space-lg bg-surface-elevated p-space-md">
            {ICONS.map(({ name, Icon }) => (
              <span
                className="flex flex-col items-center gap-space-2xs"
                key={name}
              >
                <span className="text-accent-gold">
                  <Icon size={96} />
                </span>
                <span className="type-caption text-ink">{name}</span>
              </span>
            ))}
          </div>
        </Specimen>

        <Specimen
          description="What each mark marks, with its optical nudge and whether it takes the added stroke."
          id="iconography-table"
          name="Marks and what they mark"
          note="On the page a mark sits beside its segment line or the Map label, not beside these captions."
          spec="name · what it marks · nudge · added stroke"
        >
          <div className="flex flex-wrap gap-space-lg bg-surface-elevated p-space-md">
            {ICONS.map(({ name, marks, nudge, stroke, Icon }) => (
              <span className="flex items-center gap-space-2xs" key={name}>
                <span className="text-accent-gold">
                  <Icon size={32} />
                </span>
                <span className="type-caption text-ink">
                  {name} · {marks} · nudge {nudge}
                  {stroke ? " · added stroke" : ""}
                </span>
              </span>
            ))}
          </div>
        </Specimen>

        <Specimen
          description="The site's browser icon: the thread drawn into a heart, at the sizes a browser asks for."
          id="iconography-seal"
          name="The seal mark"
          note="Served from the shipped file. Safari refuses a scalable tab icon and shows its own default."
          source="app/icon.svg"
          spec="thread-red · 97% × 95% crop · 1.65px line at 16px"
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
      </GallerySection>
    </>
  );
}
