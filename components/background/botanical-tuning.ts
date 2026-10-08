/* The per-tier placement table — DESIGN.md → Background → Botanical Edge.

   One record per piece per width tier: where it sits, how wide it is, how far it is nudged from
   that anchor, how far it is turned, and whether the tier carries it at all. Sizes and offsets are
   a fraction of the viewport's width, so a value means the same thing at every window within its
   tier; they were band-relative until this pass, and a band that inverts between tiers cannot carry
   one number per piece.

   Plain `.ts` and no JSX, so `node --test` can run against it and the image generator can import it
   rather than parsing it out of a component.

   Every value here is the owner's, settled on a real render of the tier it belongs to: a phone, a
   tablet, a laptop and an external monitor. The laptop rows began as a conversion of the approved
   laptop render rather than a derivation — and a conversion, not an arithmetic one: the browser
   quantises layout to 1/64px, so the values were converged against the render until it stopped
   moving. */

export type BotanicalPiece =
  | "falling-spray"
  | "tied-bouquet"
  | "crossing-stems"
  | "drooping-stem"
  | "corner-spray"
  | "horizontal-garland"
  | "poppy-spread"
  | "cosmos-arc"
  | "sprig-cross-left"
  | "sprig-cross-right"
  | "tall-column-a"
  | "tall-column-b"
  | "meadow-band-left"
  | "meadow-band-right"
  | "meadow-tuft"
  | "arching-branch"
  | "cascade-sprigs"
  | "wall-vine-left"
  | "wall-vine-right"
  | "blush-stem";

/* Where a piece sits before its own nudge, named for the point it pins to:
   - `top-*` / `bottom-*` — that corner of the section. A piece meant to straddle the seam with the
     section above sits on `top-*` and is nudged up through it.
   - `middle-*` — that side edge, vertically centred.
   - `above-bottom-*` — that side edge, lifted 14% off the bottom; its height cap drops with it so
     it cannot run off the bottom edge.

   The list is the type's source, not a copy of it: a second list of anchor names is exactly the
   kind of copy that drifts, and the emitter's own `switch` is checked against this one by the
   compiler. */
export const ANCHORS = [
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
  "middle-left",
  "middle-right",
  "above-bottom-left",
  "above-bottom-right",
] as const;

export type Anchor = (typeof ANCHORS)[number];

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
  /* vw, the piece's width. Every piece without exception: the closing band is two corner pieces
     precisely so that nothing is sized against the window. */
  size: number;
  /* deg, turned on the piece itself. A transform on an ancestor isolates the multiply blend; one on
     the blended element does not. */
  rotation: number;
  /* Mirror the piece across its own vertical axis. A piece whose composition roots in one side
     edge points the wrong way once it is anchored to the opposite one. Applied on the element, not
     baked into the art, so a piece can face one way at one tier and the other way at another. */
  flip?: true;
  /* Omit the piece at this tier. */
  drop?: true;
}

export const TUNING: Readonly<
  Record<BotanicalPiece, Readonly<Record<Tier, PieceTuning>>>
> = {
  "falling-spray": {
    phone: {
      anchor: "top-right",
      x: 2.380952,
      y: -6,
      size: 76.6,
      rotation: 0,
      flip: true,
    },
    tablet: {
      anchor: "top-right",
      x: 4,
      y: 0,
      size: 60,
      rotation: 0,
      flip: true,
    },
    laptop: {
      anchor: "top-right",
      x: 2.380952,
      y: 0,
      size: 35.6,
      rotation: 0,
      flip: true,
    },
    desktop: {
      anchor: "top-right",
      x: 2.380952,
      y: 0,
      size: 31.026636,
      rotation: 0,
      flip: true,
    },
  },
  "corner-spray": {
    phone: {
      anchor: "above-bottom-left",
      x: -1.6,
      y: 40,
      size: 62,
      rotation: 0,
    },
    tablet: { anchor: "bottom-left", x: 0, y: 6.998766, size: 45, rotation: 0 },
    laptop: {
      anchor: "above-bottom-left",
      x: 0,
      y: 8.463029,
      size: 24.826389,
      rotation: 0,
    },
    desktop: {
      anchor: "above-bottom-left",
      x: 0,
      y: 8.463029,
      size: 24.826389,
      rotation: 0,
    },
  },
  "tied-bouquet": {
    /* The one piece placed in the seam between two stacked sheets rather than against an edge.
       `middle-left` is what tracks that seam: a stacked pair is two sheets of near-equal height
       either side of one gap, so the section's own vertical centre IS the gap, at every window and
       whatever the give-way does to the sheets' heights. A `top-*` anchor with a vw offset cannot
       follow it — the seam moves with the sheets and the offset does not. */
    phone: {
      anchor: "middle-left",
      x: 19.8,
      y: -3.116987,
      size: 60,
      rotation: 11,
      flip: true,
    },
    tablet: {
      anchor: "middle-right",
      x: 2.4,
      y: 0.3,
      size: 32,
      rotation: 0,
      flip: true,
    },
    laptop: {
      anchor: "middle-left",
      x: 0.8,
      y: 0,
      size: 16,
      rotation: 0,
      flip: true,
    },
    desktop: {
      anchor: "middle-left",
      x: 0.8,
      y: 0,
      size: 16,
      rotation: 0,
      flip: true,
    },
  },
  "horizontal-garland": {
    phone: {
      anchor: "top-right",
      x: 12.2,
      y: -6.521628,
      size: 84.2,
      rotation: -2.5,
      flip: true,
    },
    tablet: {
      anchor: "top-right",
      x: 7,
      y: -10,
      size: 70,
      rotation: 0,
      flip: true,
    },
    laptop: {
      anchor: "top-right",
      x: 3.828464,
      y: -6.521628,
      size: 29.630661,
      rotation: -7,
      flip: true,
    },
    desktop: {
      anchor: "top-right",
      x: 3.828464,
      y: -6.521628,
      size: 29.630661,
      rotation: -7,
      flip: true,
    },
  },
  "poppy-spread": {
    phone: { anchor: "top-right", x: 4.6, y: -24, size: 48, rotation: -14 },
    tablet: {
      anchor: "top-right",
      x: 0.6,
      y: -20.299315,
      size: 40,
      rotation: -8,
    },
    laptop: {
      anchor: "top-right",
      x: 2,
      y: -0.116949,
      size: 19.7,
      rotation: -6,
    },
    desktop: {
      anchor: "top-right",
      x: 2,
      y: -0.100479,
      size: 19.7,
      rotation: -6,
    },
  },
  "cosmos-arc": {
    phone: {
      anchor: "bottom-left",
      x: -3.2,
      y: 52.2,
      size: 70,
      rotation: -1.5,
      flip: true,
    },
    tablet: {
      anchor: "bottom-left",
      x: 0,
      y: 28.699315,
      size: 40,
      rotation: 0,
      flip: true,
    },
    laptop: {
      anchor: "middle-left",
      x: -3.2,
      y: 0.246977,
      size: 23,
      rotation: -1.5,
      flip: true,
    },
    desktop: {
      anchor: "middle-left",
      x: -3.2,
      y: 0.246977,
      size: 23,
      rotation: -1.5,
      flip: true,
    },
  },
  "crossing-stems": {
    phone: {
      anchor: "top-left",
      x: -4.7,
      y: -6.5,
      size: 28.9,
      rotation: 14,
      drop: true,
    },
    tablet: { anchor: "top-left", x: -6.2, y: -18.7, size: 42, rotation: 7.5 },
    laptop: { anchor: "top-left", x: -4.7, y: -6.5, size: 22.3, rotation: 14 },
    desktop: { anchor: "top-left", x: -4.7, y: -6.5, size: 22.3, rotation: 14 },
  },
  "drooping-stem": {
    phone: { anchor: "top-right", x: 10.3, y: -5, size: 63.2, rotation: -45 },
    tablet: {
      anchor: "middle-right",
      x: 1.2,
      y: -35.479879,
      size: 46,
      rotation: 0,
    },
    laptop: {
      anchor: "top-right",
      x: -0.185162,
      y: 10,
      size: 23.132513,
      rotation: 9,
    },
    desktop: {
      anchor: "top-right",
      x: -0.185162,
      y: 10,
      size: 23.132513,
      rotation: 9,
    },
  },
  "tall-column-a": {
    phone: {
      anchor: "middle-left",
      x: -1.5,
      y: 0,
      size: 34,
      rotation: 0,
      drop: true,
    },
    tablet: {
      anchor: "bottom-left",
      x: -6.7,
      y: 33.342872,
      size: 34.3,
      rotation: -12.5,
    },
    laptop: {
      anchor: "middle-left",
      x: -1.5,
      y: 0,
      size: 34,
      rotation: 0,
      drop: true,
    },
    desktop: {
      anchor: "middle-left",
      x: -1.5,
      y: 0,
      size: 34,
      rotation: 0,
      drop: true,
    },
  },
  "tall-column-b": {
    phone: {
      anchor: "middle-right",
      x: -1.5,
      y: 0,
      size: 36,
      rotation: 0,
      drop: true,
    },
    tablet: {
      anchor: "middle-right",
      x: 3.4,
      y: 4.3,
      size: 36,
      rotation: 17.5,
    },
    laptop: {
      anchor: "middle-right",
      x: -1.5,
      y: 0,
      size: 36,
      rotation: 0,
      drop: true,
    },
    desktop: {
      anchor: "middle-right",
      x: -1.5,
      y: 0,
      size: 36,
      rotation: 0,
      drop: true,
    },
  },
  "meadow-band-left": {
    phone: { anchor: "bottom-left", x: 0, y: 2.7, size: 85, rotation: 0 },
    tablet: { anchor: "bottom-left", x: 0, y: 2.1, size: 60, rotation: 0 },
    laptop: { anchor: "bottom-left", x: 0, y: 2.7, size: 41, rotation: 0 },
    desktop: { anchor: "bottom-left", x: 0, y: 2.7, size: 41, rotation: 0 },
  },
  "meadow-band-right": {
    phone: { anchor: "bottom-right", x: 0, y: 4, size: 90, rotation: 0 },
    tablet: { anchor: "bottom-right", x: 0, y: 2, size: 60, rotation: 0 },
    laptop: { anchor: "bottom-right", x: 0, y: 4, size: 40, rotation: 0 },
    desktop: { anchor: "bottom-right", x: 0, y: 4, size: 40, rotation: 0 },
  },
  "sprig-cross-left": {
    phone: {
      anchor: "top-left",
      x: -0.897826,
      y: -4.295644,
      size: 54.7,
      rotation: 0,
    },
    tablet: { anchor: "top-left", x: -5, y: 3, size: 40, rotation: 46.5 },
    laptop: {
      anchor: "top-left",
      x: -0.897826,
      y: -4.295644,
      size: 27.091601,
      rotation: 0,
    },
    desktop: {
      anchor: "top-left",
      x: -0.897826,
      y: -4.295644,
      size: 27.091601,
      rotation: 0,
    },
  },
  "sprig-cross-right": {
    phone: { anchor: "top-right", x: 0, y: -4.295644, size: 38.5, rotation: 0 },
    tablet: { anchor: "top-right", x: 2.7, y: -2.5, size: 30, rotation: -1.5 },
    laptop: {
      anchor: "top-right",
      x: 0,
      y: -4.295644,
      size: 18.121693,
      rotation: 0,
    },
    desktop: {
      anchor: "top-right",
      x: 0,
      y: -4.295644,
      size: 18.121693,
      rotation: 0,
    },
  },
  "meadow-tuft": {
    phone: {
      anchor: "middle-right",
      x: -3.1,
      y: 3.303736,
      size: 75.6,
      rotation: 19,
    },
    tablet: {
      anchor: "bottom-right",
      x: 0.098986,
      y: 27.2,
      size: 46.9,
      rotation: 0,
    },
    laptop: {
      anchor: "middle-right",
      x: -3.601819,
      y: 3.303736,
      size: 25.1,
      rotation: 19,
    },
    desktop: {
      anchor: "middle-right",
      x: -3.601819,
      y: 3.303736,
      size: 25.1,
      rotation: 19,
    },
  },
  "arching-branch": {
    phone: {
      anchor: "bottom-left",
      x: -4.7,
      y: 19.8,
      size: 66.1,
      rotation: -17.5,
    },
    tablet: { anchor: "middle-left", x: -3, y: 7.9, size: 60, rotation: -12 },
    laptop: {
      anchor: "top-left",
      x: -2,
      y: -0.49084,
      size: 23.7,
      rotation: -17.5,
    },
    desktop: {
      anchor: "top-left",
      x: -2,
      y: -0.49084,
      size: 23.7,
      rotation: -17.5,
    },
  },
  "cascade-sprigs": {
    phone: {
      anchor: "top-right",
      x: -5.2,
      y: -9.3,
      size: 14,
      rotation: -39,
      drop: true,
    },
    tablet: {
      anchor: "top-right",
      x: -4.5,
      y: -26.2,
      size: 23.6,
      rotation: -25,
    },
    laptop: { anchor: "top-right", x: -5.2, y: -9.3, size: 14, rotation: -39 },
    desktop: { anchor: "top-right", x: -5.2, y: -9.3, size: 14, rotation: -39 },
  },
  "wall-vine-left": {
    phone: { anchor: "bottom-left", x: 0.4, y: 0, size: 45, rotation: 3 },
    tablet: {
      anchor: "bottom-left",
      x: 0,
      y: -1.893503,
      size: 27,
      rotation: 0,
    },
    laptop: {
      anchor: "bottom-left",
      x: 0.4,
      y: -4.026802,
      size: 19.3,
      rotation: 3,
    },
    desktop: {
      anchor: "bottom-left",
      x: 0.4,
      y: -4.026802,
      size: 19.3,
      rotation: 3,
    },
  },
  "wall-vine-right": {
    phone: { anchor: "bottom-right", x: -0.6, y: 0, size: 48.9, rotation: -2 },
    tablet: {
      anchor: "bottom-right",
      x: 0,
      y: -0.692502,
      size: 28,
      rotation: 0,
    },
    laptop: {
      anchor: "bottom-right",
      x: -0.6,
      y: -4.487624,
      size: 17.5,
      rotation: -2,
    },
    desktop: {
      anchor: "bottom-right",
      x: -0.6,
      y: -4.487624,
      size: 17.5,
      rotation: -2,
    },
  },
  "blush-stem": {
    phone: {
      anchor: "middle-right",
      x: -1,
      y: 0,
      size: 30,
      rotation: 0,
      flip: true,
      drop: true,
    },
    tablet: {
      anchor: "middle-left",
      x: -2.899766,
      y: -35,
      size: 30.2,
      rotation: -7.5,
      flip: true,
    },
    laptop: {
      anchor: "middle-right",
      x: -1,
      y: 0,
      size: 30,
      rotation: 0,
      flip: true,
      drop: true,
    },
    desktop: {
      anchor: "middle-right",
      x: -1,
      y: 0,
      size: 30,
      rotation: 0,
      flip: true,
      drop: true,
    },
  },
};
