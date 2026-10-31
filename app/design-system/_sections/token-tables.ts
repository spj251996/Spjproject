import type {
  BarItem,
  DurationToken,
  EasingToken,
  LayerItem,
  TypeToken,
} from "@/app/design-system/_kit";

/* The gallery's token tables, in a .ts module so token-structs.test.ts can import them and hold each
   to tokens.css. */

export const TYPE_TOKENS: TypeToken[] = [
  {
    token: "type-heading-xl",
    family: "Playfair Display",
    weight: 700,
    sample: "Section-level H1.",
    phone: { size: 26, lh: 40 },
    tablet: { size: 32, lh: 48 },
    laptop: { size: 30, lh: 44 },
    desktop: { size: 38, lh: 56 },
  },
  {
    token: "type-heading-md",
    family: "Playfair Display",
    weight: 700,
    sample: "Each ritual's English title.",
    phone: { size: 18, lh: 32 },
    tablet: { size: 20, lh: 34 },
    laptop: { size: 18, lh: 32 },
    desktop: { size: 21, lh: 36 },
  },
  {
    token: "type-heading-sm",
    family: "Playfair Display",
    weight: 700,
    sample:
      "Serif sub-headings; the event sheets' address line and segment line.",
    phone: { size: 14, lh: 28 },
    tablet: { size: 15, lh: 30 },
    laptop: { size: 14, lh: 28 },
    desktop: { size: 17, lh: 32 },
  },
  {
    token: "type-date-primary",
    family: "Playfair Display",
    weight: 700,
    sample:
      "The event sheets' date line, and the invite's place beneath its date block.",
    phone: { size: 14, lh: 28 },
    tablet: { size: 15, lh: 30 },
    laptop: { size: 14, lh: 28 },
    desktop: { size: 17, lh: 32 },
  },
  {
    token: "type-date-label",
    family: "Playfair Display",
    weight: 700,
    sample: "Saturday · Jan · 2027",
    phone: { size: 12, lh: 12 },
    tablet: { size: 13, lh: 13 },
    laptop: { size: 12, lh: 12 },
    desktop: { size: 14, lh: 14 },
  },
  {
    token: "type-date-day",
    family: "Playfair Display",
    weight: 400,
    sample: "9",
    phone: { size: 44, lh: 44 },
    tablet: { size: 48, lh: 48 },
    laptop: { size: 44, lh: 44 },
    desktop: { size: 51, lh: 51 },
  },
  {
    token: "type-body",
    family: "Libre Baskerville",
    weight: 400,
    sample: "Descriptions, addresses, wishes, all long-form copy.",
    phone: { size: 13, lh: 26 },
    tablet: { size: 14, lh: 28 },
    laptop: { size: 13, lh: 26 },
    desktop: { size: 16, lh: 32 },
  },
  {
    token: "type-body-italic",
    family: "Libre Baskerville",
    weight: 400,
    italic: true,
    sample: "The timeline's promise line and a ritual's tagline.",
    phone: { size: 13, lh: 26 },
    tablet: { size: 14, lh: 28 },
    laptop: { size: 13, lh: 26 },
    desktop: { size: 16, lh: 32 },
  },
  {
    token: "type-caption",
    family: "Libre Baskerville",
    weight: 400,
    sample:
      "Secondary text accompanying something else — an attribution beneath a passage, a reference beneath a heading, a relationship beneath a name. Never long-form.",
    phone: { size: 11, lh: 22 },
    tablet: { size: 13, lh: 24 },
    laptop: { size: 12, lh: 22 },
    desktop: { size: 14, lh: 24 },
  },
  {
    token: "type-caption-italic",
    family: "Libre Baskerville",
    weight: 400,
    italic: true,
    sample:
      "A citation set beneath its caption-styled parent — the invite's citation beneath its passage.",
    phone: { size: 11, lh: 22 },
    tablet: { size: 13, lh: 24 },
    laptop: { size: 12, lh: 22 },
    desktop: { size: 14, lh: 24 },
  },
  {
    token: "type-eyebrow",
    family: "Libre Baskerville",
    weight: 700,
    sample: "Small labels above headings and sheet fields.",
    phone: { size: 10, lh: 20 },
    tablet: { size: 11, lh: 20 },
    laptop: { size: 10, lh: 20 },
    desktop: { size: 12, lh: 22 },
  },
  {
    token: "type-action",
    family: "Libre Baskerville",
    weight: 700,
    italic: true,
    sample: "Buttons and calls to action.",
    phone: { size: 13, lh: 26 },
    tablet: { size: 14, lh: 28 },
    laptop: { size: 13, lh: 26 },
    desktop: { size: 16, lh: 32 },
  },
];

export const SPACING_STEPS: BarItem[] = [
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

export const LAYOUT_CAPS = [
  "--container-content · 1200px · all content; a framed card's width from xl, landscape windows only",
  "--container-content-laptop · 960px · a framed card's width, lg to xl, landscape windows only",
  "--container-text · 600px · text blocks",
  "--card-height-cap · 720px · a framed card's height from xl, landscape windows only",
  "--card-height-cap-laptop · 576px · a framed card's height, lg to xl, landscape windows only",
];

export const DURATION_TOKENS: DurationToken[] = [
  { token: "--duration-fast", ms: 200 },
  { token: "--duration-base", ms: 400 },
];

export const EASING_TOKENS: EasingToken[] = [
  { token: "--ease-entrance", curve: [0, 0, 0.2, 1] },
  { token: "--ease-settle", curve: [0.4, 0, 0.2, 1] },
];

export const Z_LAYERS: LayerItem[] = [
  {
    token: "--z-invite-bloom",
    value: "1",
    role: "Invite bloom · the invite's two botanical pieces, above every other piece and below every card",
  },
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

export const LOOP_CADENCE_USES = [
  "--retrace-duration · 3.2s · one loop of the thread's re-trace, governing only when no speed is set · set against the thread, not a step on the duration scale · the owner's pick",
  "--retrace-settle · 1500ms · how long the page must be still before the re-trace loops · a delay of the same kind, the owner's pick",
  "--retrace-loops · 4 · how many whole loops the LONGEST stretch runs before everything stops until the next scroll · a count, so a slower pace never keeps the page busy longer · every shorter stretch fits whole loops into the same window and they quiet together · the owner's pick",
  "--retrace-speed · 845 px/s · the one speed every lit stretch of the re-trace moves at, so a stretch's length never sets its pace · the owner's pick",
  "--thread-catchup · 0.4s · how long the drawn length takes to arrive at the length the scroll position means · a fixed-duration ease that converges exactly, never an exponential · the owner's pick",
  "--thread-terminal-span · 0.2 · the closing stretch's own scroll budget, a fraction of the viewport's height, because Wishes fills exactly the last viewport and is never scrolled through · the owner's pick",
  "--thread-terminal-finish · 0.08 · also a fraction of the viewport's height · completes the closing stretch that far before the page's last pixel, so a reader who rests short of the bottom sees the thread finished and the drawing head retired · the owner's pick",
];
