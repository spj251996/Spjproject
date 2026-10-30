import type { BandId } from "./thread-bands.ts";
import type { ThreadId } from "./thread-geometry.ts";

/* MEASURED on the real render at each band's nominal viewport (`thread-bands.ts`: 393x700, 820x1180,
   1536x695, not the wider viewports the clearance gate sweeps; a card figure that looks changed is the
   wrong viewport before it is a regression), with `channel: "chromium"` (a default
   `chromium.launch()` renders text about 3% wider). Script: `scripts/thread/measure-authored-cards.mjs`.
   Re-measure after `document.fonts.ready` and every image reporting `complete && naturalWidth > 0`,
   reading `.mounted-sheet-frame__box`'s rect for the card and the outer `<section>`'s rect for the
   height; never derive either from a CSS expression.

   `cardLeft` is the card's left edge at the band's own nominal width: what a section's thread was
   authored offset from, not a general-purpose value at any other width. `sectionHeight` reproduces
   `thread-boxes.ts`'s `sectionBox`, measured the same way. */
export type AuthoredCard = {
  cardWidth: number;
  cardLeft: number;
  sectionHeight: number;
};

type Sections = Record<ThreadId, AuthoredCard>;

const TALL_CARDS: Sections = {
  invite: { cardWidth: 361, cardLeft: 16, sectionHeight: 700 },
  "event-info": { cardWidth: 361, cardLeft: 16, sectionHeight: 1400 },
  family: { cardWidth: 361, cardLeft: 16, sectionHeight: 1400 },
  // Celebrations takes `mounted-sheet`'s `tall` mode (no measured fit), so its padding chain is
  // its own and its card is narrower than every fitted section's at this band.
  /* Photo-free base, plus +184 / +184 / +190 per photographed ritual (tall / upright / wide);
     measured to the pixel across 0, 1, 2 and 3 rituals. Re-measure after any ritual or photo change.
     The thread's route through Celebrations is still composed for the placeholder section: this
     height is real, its shape awaits the redraw. */
  celebrations: { cardWidth: 345, cardLeft: 24, sectionHeight: 1895 },
  wishes: { cardWidth: 361, cardLeft: 16, sectionHeight: 700 },
};

const UPRIGHT_CARDS: Sections = {
  invite: { cardWidth: 564, cardLeft: 128, sectionHeight: 1180 },
  "event-info": { cardWidth: 564, cardLeft: 128, sectionHeight: 2360 },
  family: { cardWidth: 564, cardLeft: 128, sectionHeight: 2360 },
  /* Photo-free base, plus +184 / +184 / +190 per photographed ritual (tall / upright / wide);
     measured to the pixel across 0, 1, 2 and 3 rituals. Re-measure after any ritual or photo change.
     The thread's route through Celebrations is still composed for the placeholder section: this
     height is real, its shape awaits the redraw. */
  celebrations: { cardWidth: 564, cardLeft: 128, sectionHeight: 1968 },
  wishes: { cardWidth: 564, cardLeft: 128, sectionHeight: 1180 },
};

const WIDE_CARDS: Sections = {
  invite: { cardWidth: 960, cardLeft: 288, sectionHeight: 695 },
  "event-info": { cardWidth: 960, cardLeft: 288, sectionHeight: 695 },
  family: { cardWidth: 960, cardLeft: 288, sectionHeight: 695 },
  /* Photo-free base, plus +184 / +184 / +190 per photographed ritual (tall / upright / wide);
     measured to the pixel across 0, 1, 2 and 3 rituals. Re-measure after any ritual or photo change.
     The thread's route through Celebrations is still composed for the placeholder section: this
     height is real, its shape awaits the redraw. */
  celebrations: { cardWidth: 960, cardLeft: 288, sectionHeight: 1339 },
  wishes: { cardWidth: 960, cardLeft: 288, sectionHeight: 695 },
};

const CARDS_BY_BAND: Record<BandId, Sections> = {
  tall: TALL_CARDS,
  upright: UPRIGHT_CARDS,
  wide: WIDE_CARDS,
};

export function authoredCard(id: ThreadId, band: BandId): AuthoredCard {
  return CARDS_BY_BAND[band][id];
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
