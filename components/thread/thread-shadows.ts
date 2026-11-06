/* The thread's contact shadow and the drawing head's halo, as SVG filters (DESIGN.md -> Thread ->
   The contact shadow, The drawing head). `--bleed-thread` and `--halo-thread-head` name them by id.

   NEVER A CSS `drop-shadow()`: every iPhone browser is WebKit, which paints no CSS drop-shadow on an
   element inside an `<svg>`, path or group alike (0 changed px at dpr 3), while a `url()` filter
   paints in every engine. Chromium renders these pixel-identical to the CSS shadows they replace.

   Each layer is one `<feDropShadow>` whose `stdDeviation` IS the CSS blur, not half of it: a CSS
   `drop-shadow()`'s blur is already a standard deviation (unlike `box-shadow`'s), and half differed
   by up to 190k px. The region is fitted per element (`thread-shadow-regions.ts`).

   Wide radii on every piece's ink cost a cliff, not a gradual scaling (55 dropped frames over a 5s
   scrub at 33px against 4 at 8.25px), so do not widen the contact shadow's blur without re-measuring.
   The halo is the owner's three-quarter strength (2026-11-03); it covers only the head's own silhouette.
   `ThreadFilters` (`thread-filters.tsx`) renders them. */

export interface ShadowLayer {
  readonly offsetY: number;
  readonly blur: number;
  /* A colour token's custom property, read through `var()` so a palette edit reaches the filter. */
  readonly colour: string;
  readonly alpha: number;
}

export interface ThreadFilter {
  readonly id: string;
  readonly layers: readonly ShadowLayer[];
}

export const CONTACT_SHADOW: ThreadFilter = {
  id: "thread-contact-shadow",
  layers: [
    { offsetY: 1, blur: 1.25, colour: "--color-shadow-warm", alpha: 0.65 },
    { offsetY: 4, blur: 6, colour: "--color-shadow-warm", alpha: 0.3 },
  ],
};

export const HEAD_HALO: ThreadFilter = {
  id: "thread-head-halo",
  layers: [
    { offsetY: 0, blur: 3.5, colour: "--color-thread-vermilion", alpha: 0.51 },
    { offsetY: 0, blur: 12, colour: "--color-thread-vermilion", alpha: 0.33 },
    { offsetY: 0, blur: 33, colour: "--color-thread-vermilion", alpha: 0.225 },
  ],
};

/* Where the line crosses itself, the upper strand's shadow on the strand beneath it (DESIGN.md -> Thread ->
   Crossings): straight down in the paper's shadow tint, like the contact shadow, and small. */
export const CROSSING_LIFT: ThreadFilter = {
  id: "thread-crossing-lift",
  layers: [
    { offsetY: 0.9, blur: 0.9, colour: "--color-shadow-warm", alpha: 0.7 },
  ],
};

export const THREAD_FILTERS: readonly ThreadFilter[] = [
  CONTACT_SHADOW,
  HEAD_HALO,
  CROSSING_LIFT,
];
