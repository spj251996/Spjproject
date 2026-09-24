/* The per-tier placement table — DESIGN.md → Background → Botanical Edge.

   One record per piece per width tier: where it sits, how wide it is, how far it is nudged from
   that anchor, how far it is turned, and whether the tier carries it at all. Sizes and offsets are
   a fraction of the viewport's width, so a value means the same thing at every window within its
   tier; they were band-relative until this pass, and a band that inverts between tiers cannot carry
   one number per piece.

   Plain `.ts` and no JSX, so `node --test` can run against it and the image generator can import it
   rather than parsing it out of a component.

   Every value here is the owner's, settled on a render. The laptop rows were converted from the
   approved laptop render (1512x850) rather than derived, and the other three tiers are seeded from
   them — phone, tablet and desktop are tuned against their own renders. */

export type BotanicalPiece =
  | "falling-spray"
  | "tied-bouquet"
  | "crossing-stems"
  | "drooping-stem"
  | "corner-spray"
  | "horizontal-garland"
  | "side-spread-left"
  | "side-spread-right"
  | "sprig-cross-left"
  | "sprig-cross-right"
  | "tall-column-a"
  | "tall-column-b"
  | "meadow-band";

export type NonMeadowPiece = Exclude<BotanicalPiece, "meadow-band">;

/* Where a piece sits before its own nudge. `low-right` sits 14% up from the section's bottom edge;
   `gap-*` sit on the section's top edge, where the gap above it reads; `band-bottom` spans the
   section's full width along its bottom edge. */
export type Anchor =
  | "top-span"
  | "low-right"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "mid-left"
  | "mid-right"
  | "gap-left"
  | "gap-right"
  | "band-bottom";

/* The four width tiers, keyed to the layout's own breakpoints: below 48rem, 48-64rem, 64-100rem
   and 100rem up. One vocabulary with the frame's. */
export type Tier = "phone" | "tablet" | "laptop" | "desktop";

export const TIERS = ["phone", "tablet", "laptop", "desktop"] as const;

export interface PieceTuning {
  /* Per tier, not per piece: a piece the narrow tiers have no side room for relocates into a top
     or bottom band instead of vanishing. */
  anchor: Anchor;
  /* vw, positive right, at every anchor — the emitter compensates for anchors that would otherwise
     move a piece by half its nudge or in the opposite direction. */
  x: number;
  /* vw, positive down. The same unit as the width, so an offset is a constant fraction of the piece
     itself at every window rather than of the window's height. */
  y: number;
  /* vw, the piece's width. `meadow-band` alone is read as a percentage of the section — see
     `botanical-css.ts`. */
  size: number;
  /* deg, turned on the piece itself. A transform on an ancestor isolates the multiply blend; one on
     the blended element does not. */
  rotation: number;
  /* Omit the piece at this tier. */
  drop?: true;
}

export const TUNING: Readonly<
  Record<BotanicalPiece, Readonly<Record<Tier, PieceTuning>>>
> = {
  "falling-spray": {
    phone: {
      anchor: "top-span",
      x: -2.380952,
      y: 0,
      size: 31.026636,
      rotation: 0,
    },
    tablet: {
      anchor: "top-span",
      x: -2.380952,
      y: 0,
      size: 31.026636,
      rotation: 0,
    },
    laptop: {
      anchor: "top-span",
      x: -2.380952,
      y: 0,
      size: 31.026636,
      rotation: 0,
    },
    desktop: {
      anchor: "top-span",
      x: -2.380952,
      y: 0,
      size: 31.026636,
      rotation: 0,
    },
  },
  "corner-spray": {
    phone: {
      anchor: "low-right",
      x: 0,
      y: 5.663029,
      size: 24.826389,
      rotation: 0,
    },
    tablet: {
      anchor: "low-right",
      x: 0,
      y: 5.663029,
      size: 24.826389,
      rotation: 0,
    },
    laptop: {
      anchor: "low-right",
      x: 0,
      y: 5.663029,
      size: 24.826389,
      rotation: 0,
    },
    desktop: {
      anchor: "low-right",
      x: 0,
      y: 5.663029,
      size: 24.826389,
      rotation: 0,
    },
  },
  "tied-bouquet": {
    phone: {
      anchor: "top-right",
      x: 0,
      y: 11.772337,
      size: 17.524339,
      rotation: 0,
    },
    tablet: {
      anchor: "top-right",
      x: 0,
      y: 11.772337,
      size: 17.524339,
      rotation: 0,
    },
    laptop: {
      anchor: "top-right",
      x: 0,
      y: 11.772337,
      size: 17.524339,
      rotation: 0,
    },
    desktop: {
      anchor: "top-right",
      x: 0,
      y: 11.772337,
      size: 17.524339,
      rotation: 0,
    },
  },
  "horizontal-garland": {
    phone: {
      anchor: "gap-left",
      x: -2.028464,
      y: -4.321628,
      size: 29.630661,
      rotation: 0,
    },
    tablet: {
      anchor: "gap-left",
      x: -2.028464,
      y: -4.321628,
      size: 29.630661,
      rotation: 0,
    },
    laptop: {
      anchor: "gap-left",
      x: -2.028464,
      y: -4.321628,
      size: 29.630661,
      rotation: 0,
    },
    desktop: {
      anchor: "gap-left",
      x: -2.028464,
      y: -4.321628,
      size: 29.630661,
      rotation: 0,
    },
  },
  "side-spread-left": {
    phone: {
      anchor: "mid-left",
      x: 0,
      y: -7.550902,
      size: 20.387938,
      rotation: 0,
    },
    tablet: {
      anchor: "mid-left",
      x: 0,
      y: -7.550902,
      size: 20.387938,
      rotation: 0,
    },
    laptop: {
      anchor: "mid-left",
      x: 0,
      y: -7.550902,
      size: 20.387938,
      rotation: 0,
    },
    desktop: {
      anchor: "mid-left",
      x: 0,
      y: -7.550902,
      size: 20.387938,
      rotation: 0,
    },
  },
  "side-spread-right": {
    phone: {
      anchor: "mid-right",
      x: 0,
      y: 4.246977,
      size: 18.938028,
      rotation: 0,
    },
    tablet: {
      anchor: "mid-right",
      x: 0,
      y: 4.246977,
      size: 18.938028,
      rotation: 0,
    },
    laptop: {
      anchor: "mid-right",
      x: 0,
      y: 4.246977,
      size: 18.938028,
      rotation: 0,
    },
    desktop: {
      anchor: "mid-right",
      x: 0,
      y: 4.246977,
      size: 18.938028,
      rotation: 0,
    },
  },
  "crossing-stems": {
    phone: {
      anchor: "top-left",
      x: -2.557565,
      y: -2.866602,
      size: 20.994742,
      rotation: 0,
    },
    tablet: {
      anchor: "top-left",
      x: -2.557565,
      y: -2.866602,
      size: 20.994742,
      rotation: 0,
    },
    laptop: {
      anchor: "top-left",
      x: -2.557565,
      y: -2.866602,
      size: 20.994742,
      rotation: 0,
    },
    desktop: {
      anchor: "top-left",
      x: -2.557565,
      y: -2.866602,
      size: 20.994742,
      rotation: 0,
    },
  },
  "drooping-stem": {
    phone: {
      anchor: "top-right",
      x: -1.985162,
      y: -2.24853,
      size: 21.332513,
      rotation: 0,
    },
    tablet: {
      anchor: "top-right",
      x: -1.985162,
      y: -2.24853,
      size: 21.332513,
      rotation: 0,
    },
    laptop: {
      anchor: "top-right",
      x: -1.985162,
      y: -2.24853,
      size: 21.332513,
      rotation: 0,
    },
    desktop: {
      anchor: "top-right",
      x: -1.985162,
      y: -2.24853,
      size: 21.332513,
      rotation: 0,
    },
  },
  "tall-column-a": {
    phone: {
      anchor: "mid-left",
      x: -0.530134,
      y: 0.970654,
      size: 19.048651,
      rotation: 0,
    },
    tablet: {
      anchor: "mid-left",
      x: -0.530134,
      y: 0.970654,
      size: 19.048651,
      rotation: 0,
    },
    laptop: {
      anchor: "mid-left",
      x: -0.530134,
      y: 0.970654,
      size: 19.048651,
      rotation: 0,
    },
    desktop: {
      anchor: "mid-left",
      x: -0.530134,
      y: 0.970654,
      size: 19.048651,
      rotation: 0,
    },
  },
  "tall-column-b": {
    phone: {
      anchor: "mid-right",
      x: -0.21928,
      y: 1.543257,
      size: 23.872511,
      rotation: 0,
    },
    tablet: {
      anchor: "mid-right",
      x: -0.21928,
      y: 1.543257,
      size: 23.872511,
      rotation: 0,
    },
    laptop: {
      anchor: "mid-right",
      x: -0.21928,
      y: 1.543257,
      size: 23.872511,
      rotation: 0,
    },
    desktop: {
      anchor: "mid-right",
      x: -0.21928,
      y: 1.543257,
      size: 23.872511,
      rotation: 0,
    },
  },
  "meadow-band": {
    phone: { anchor: "band-bottom", x: 0, y: 0, size: 100, rotation: 0 },
    tablet: { anchor: "band-bottom", x: 0, y: 0, size: 100, rotation: 0 },
    laptop: { anchor: "band-bottom", x: 0, y: 0, size: 100, rotation: 0 },
    desktop: {
      anchor: "band-bottom",
      x: 0,
      y: 0,
      size: 100,
      rotation: 0,
    },
  },
  "sprig-cross-left": {
    phone: {
      anchor: "gap-left",
      x: -0.897826,
      y: -4.295644,
      size: 27.091601,
      rotation: 0,
    },
    tablet: {
      anchor: "gap-left",
      x: -0.897826,
      y: -4.295644,
      size: 27.091601,
      rotation: 0,
    },
    laptop: {
      anchor: "gap-left",
      x: -0.897826,
      y: -4.295644,
      size: 27.091601,
      rotation: 0,
    },
    desktop: {
      anchor: "gap-left",
      x: -0.897826,
      y: -4.295644,
      size: 27.091601,
      rotation: 0,
    },
  },
  "sprig-cross-right": {
    phone: {
      anchor: "gap-right",
      x: 0,
      y: -4.295644,
      size: 18.121693,
      rotation: 0,
    },
    tablet: {
      anchor: "gap-right",
      x: 0,
      y: -4.295644,
      size: 18.121693,
      rotation: 0,
    },
    laptop: {
      anchor: "gap-right",
      x: 0,
      y: -4.295644,
      size: 18.121693,
      rotation: 0,
    },
    desktop: {
      anchor: "gap-right",
      x: 0,
      y: -4.295644,
      size: 18.121693,
      rotation: 0,
    },
  },
};
