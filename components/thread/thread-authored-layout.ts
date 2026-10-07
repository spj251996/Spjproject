import type { BandId } from "./thread-bands.ts";
import type { ThreadId } from "./thread-geometry.ts";

/* MEASURED on the real render (never `/thread-lab`, which has no cards) at each band's own
   nominal viewport, with `channel: "chromium"` — the pin every render figure on this project
   needs (a default `chromium.launch()` quantises glyph advances and renders text ~3% wider).
   Script: `tmp/thread-measure/authored-cards.mjs`. Re-measure by rendering the real page at a
   band's nominal viewport, waiting for `document.fonts.ready` and every image to report
   `complete && naturalWidth > 0`, then reading `.mounted-sheet-frame__box`'s rect for the card
   and the outer `<section>`'s rect for the height — never derive either from a CSS expression,
   which is the mechanism this warp replaces.

   `cardLeft` is the card's left edge in viewport pixels at the band's own nominal width; it is
   what a section's thread was authored offset from, not a general-purpose value at any other
   width. `sectionHeight` reproduces `thread-boxes.ts`'s `sectionBox`, measured the same way, and
   the two were cross-checked exactly rather than assumed to agree.

   THE BAND'S NOMINAL BOX IS `thread-bands.ts`'s — 393x700, 820x1180, 1536x695 — and not the wider
   viewports the thread's clearance gate sweeps. Measured at 360 / 834 / 1920 instead, Celebrations'
   `cardWidth` and `cardLeft` both appear to have moved; at the nominal boxes they reproduce
   345/24, 564/128 and 960/288 to the pixel. A card figure that looks changed is the wrong viewport
   before it is a regression. */
export type AuthoredCard = {
  cardWidth: number;
  cardLeft: number;
  sectionHeight: number;
};

type Sections = Record<Exclude<ThreadId, "not-found">, AuthoredCard>;

const TALL_CARDS: Sections = {
  invite: { cardWidth: 361, cardLeft: 16, sectionHeight: 700 },
  "event-info": { cardWidth: 361, cardLeft: 16, sectionHeight: 1400 },
  contact: { cardWidth: 361, cardLeft: 16, sectionHeight: 700 },
  family: { cardWidth: 361, cardLeft: 16, sectionHeight: 1400 },
  // Celebrations takes `mounted-sheet`'s `tall` mode (no measured fit), so its padding chain is
  // its own and its card is narrower than every fitted section's at this band.
  /* RE-MEASURED 2026-10-07 on the BUILT page, at this band's own nominal box, after
     `document.fonts.ready` and every image complete. The real five-ritual section replaced the
     placeholder these figures were taken from.
     THE THREAD'S ROUTE THROUGH CELEBRATIONS IS STILL COMPOSED FOR THE PLACEHOLDER: this height
     makes the stretch span the right distance, but its SHAPE awaits the owner's drawing on the
     built page (owner's decision, 2026-10-07). That is accepted, not a defect to fix here.
     THIS FIGURE INCLUDES THE FIRST TWO RITUALS' TEMPORARY PHOTOGRAPHS, which are dropped before
     main (`content/rituals.ts`). The photo-free base is 2308 / 2308 / 1520 at tall / upright /
     wide, and each ritual that gains photographs adds a CONSTANT +180 / +184 / +214 — measured to
     the pixel across 0, 1, 2 and 3 rituals, and independent of how many photographs any one of
     them carries. So removing them means subtracting two increments, not re-deriving the height. */
  celebrations: { cardWidth: 345, cardLeft: 24, sectionHeight: 2668 },
  wishes: { cardWidth: 361, cardLeft: 16, sectionHeight: 700 },
};

const UPRIGHT_CARDS: Sections = {
  invite: { cardWidth: 564, cardLeft: 128, sectionHeight: 1180 },
  "event-info": { cardWidth: 564, cardLeft: 128, sectionHeight: 2360 },
  contact: { cardWidth: 564, cardLeft: 128, sectionHeight: 1180 },
  family: { cardWidth: 564, cardLeft: 128, sectionHeight: 2360 },
  /* RE-MEASURED 2026-10-07 on the BUILT page, at this band's own nominal box, after
     `document.fonts.ready` and every image complete. The real five-ritual section replaced the
     placeholder these figures were taken from.
     THE THREAD'S ROUTE THROUGH CELEBRATIONS IS STILL COMPOSED FOR THE PLACEHOLDER: this height
     makes the stretch span the right distance, but its SHAPE awaits the owner's drawing on the
     built page (owner's decision, 2026-10-07). That is accepted, not a defect to fix here.
     THIS FIGURE INCLUDES THE FIRST TWO RITUALS' TEMPORARY PHOTOGRAPHS, which are dropped before
     main (`content/rituals.ts`). The photo-free base is 2308 / 2308 / 1520 at tall / upright /
     wide, and each ritual that gains photographs adds a CONSTANT +180 / +184 / +214 — measured to
     the pixel across 0, 1, 2 and 3 rituals, and independent of how many photographs any one of
     them carries. So removing them means subtracting two increments, not re-deriving the height. */
  celebrations: { cardWidth: 564, cardLeft: 128, sectionHeight: 2676 },
  wishes: { cardWidth: 564, cardLeft: 128, sectionHeight: 1180 },
};

const WIDE_CARDS: Sections = {
  invite: { cardWidth: 960, cardLeft: 288, sectionHeight: 695 },
  "event-info": { cardWidth: 960, cardLeft: 288, sectionHeight: 695 },
  contact: { cardWidth: 960, cardLeft: 288, sectionHeight: 695 },
  family: { cardWidth: 960, cardLeft: 288, sectionHeight: 695 },
  /* RE-MEASURED 2026-10-07 on the BUILT page, at this band's own nominal box, after
     `document.fonts.ready` and every image complete. The real five-ritual section replaced the
     placeholder these figures were taken from.
     THE THREAD'S ROUTE THROUGH CELEBRATIONS IS STILL COMPOSED FOR THE PLACEHOLDER: this height
     makes the stretch span the right distance, but its SHAPE awaits the owner's drawing on the
     built page (owner's decision, 2026-10-07). That is accepted, not a defect to fix here.
     THIS FIGURE INCLUDES THE FIRST TWO RITUALS' TEMPORARY PHOTOGRAPHS, which are dropped before
     main (`content/rituals.ts`). The photo-free base is 2308 / 2308 / 1520 at tall / upright /
     wide, and each ritual that gains photographs adds a CONSTANT +180 / +184 / +214 — measured to
     the pixel across 0, 1, 2 and 3 rituals, and independent of how many photographs any one of
     them carries. So removing them means subtracting two increments, not re-deriving the height. */
  celebrations: { cardWidth: 960, cardLeft: 288, sectionHeight: 1948 },
  wishes: { cardWidth: 960, cardLeft: 288, sectionHeight: 695 },
};

const CARDS_BY_BAND: Record<BandId, Sections> = {
  tall: TALL_CARDS,
  upright: UPRIGHT_CARDS,
  wide: WIDE_CARDS,
};

/* `not-found` is the invite's geometry by construction (`thread-css.ts`'s `routeFor` resolves it
   the same way as `thread-boxes.ts`'s `sectionBox`), so it takes the invite's authored card
   rather than carrying its own row. */
export function authoredCard(id: ThreadId, band: BandId): AuthoredCard {
  const of = id === "not-found" ? "invite" : id;
  return CARDS_BY_BAND[band][of];
}

/* A point on the family card, as the fraction of its width/height a later warp can resolve
   against any measured card — the anchor fallback for `portraitLoop`, which must follow Flemy's
   and Sebastian's real portraits rather than a literal placement fraction. */
export type PortraitFraction = { x: number; y: number };

type FamilyPortraits = { flemy: PortraitFraction; sebastian: PortraitFraction };

const TALL_PORTRAITS: FamilyPortraits = {
  flemy: { x: 0.356, y: 0.3067 },
  sebastian: { x: 0.7881, y: 0.7868 },
};

const UPRIGHT_PORTRAITS: FamilyPortraits = {
  flemy: { x: 0.344, y: 0.2619 },
  sebastian: { x: 0.8121, y: 0.8026 },
};

const WIDE_PORTRAITS: FamilyPortraits = {
  flemy: { x: 0.1875, y: 0.5291 },
  sebastian: { x: 0.875, y: 0.5291 },
};

const PORTRAITS_BY_BAND: Record<BandId, FamilyPortraits> = {
  tall: TALL_PORTRAITS,
  upright: UPRIGHT_PORTRAITS,
  wide: WIDE_PORTRAITS,
};

export function familyPortraitFractions(band: BandId): FamilyPortraits {
  return PORTRAITS_BY_BAND[band];
}
