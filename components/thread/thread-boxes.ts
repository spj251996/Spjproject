import type { BandId } from "./thread-bands.ts";
import type { SectionBox, ThreadId } from "./thread-geometry.ts";

/* MEASURED on the real render, at the band's own nominal viewport (the width below is that band's
   box width; only the height is section-specific). Re-measure by rendering each section at its
   band's nominal width and reading `scrollHeight` off the section's own box, the same way Task 1's
   spike did — never derive a section's height from the band's box alone.

   READ THE SECTION'S OWN `getBoundingClientRect().height`, NOT `scrollHeight`. Re-measured
   2026-10-07: at each band's nominal box the rect reproduces the recorded `contact` and `wishes`
   figures (700 / 1180 / 695) exactly, while `scrollHeight` reads 909 / 1415 / 695 for `contact` —
   so these constants were taken from the rect, whatever this comment used to say. Validate any
   re-measure against those two sections before trusting a new number for a third.

   A band-wide box was wrong because a section's height is not the band's: the paired sections
   (Event Info, Family) stack in portrait, so they run roughly 2x a single card's height, and
   Celebrations is a list whose height will grow again when the photo gallery lands in Ship 2.
   Composing a thread against one box per band stretched those sections' geometry up to 2.4x
   vertically past what the render actually shows. */
/* RE-MEASURED 2026-10-08 after Phase 7's content round (the invite gained a line, Family's groom
   sheet was restructured) and UNCHANGED at all 18 figures. Not a skipped check: every section but
   `celebrations` is sized from the viewport rather than its content, so content that grows inside one
   screen does not move the section — the invite's own measured fit grew 10-12px and this did not
   move at all. Family came out height-neutral for a different reason: the nephew moved up a row and
   the groom moved down one, so the sheet kept its row count.
   Measured on the built export at `/thread/current.html`, at the band nominals below, via each
   section's own `getBoundingClientRect().height`. Instrument validated first on `contact` and
   `wishes`, which reproduced their recorded 700 / 1180 / 695 exactly. */
type SectionHeights = Record<Exclude<ThreadId, "not-found">, number>;

const TALL_HEIGHTS: SectionHeights = {
  invite: 700,
  "event-info": 1400,
  contact: 700,
  family: 1400,
  /* RE-MEASURED 2026-10-07 on the BUILT page, at this band's own nominal box, after
     `document.fonts.ready` and every image complete. The real five-ritual section replaced the
     placeholder these figures were taken from.
     THE THREAD'S ROUTE THROUGH CELEBRATIONS IS STILL COMPOSED FOR THE PLACEHOLDER: this height
     makes the stretch span the right distance, but its SHAPE awaits the owner's drawing on the
     built page (owner's decision, 2026-10-07). That is accepted, not a defect to fix here.
     THIS FIGURE INCLUDES THE FIRST TWO RITUALS' TEMPORARY PHOTOGRAPHS, which are dropped before
     main (`content/rituals.ts`). The photo-free base is 2404 / 2423 / 1666 at tall / upright /
     wide, and each ritual that gains photographs adds a CONSTANT +180 / +184 / +214 — so removing
     them means subtracting two increments, not re-deriving the height.
     RE-MEASURED 2026-10-10 on two changes at once, and the BASE moved while the INCREMENT did not:
     the ritual restructure put each Malayalam on its own line, and the alternating band above
     1024px was removed in favour of one full-width column at every tier with a single 48px gap
     (was a raw 64px below 1024 and 32 above). Base 2308 / 2308 / 1520 -> 2404 / 2423 / 1666; the
     photo increment is unchanged, which is what the separate base and increment are for — the
     strip's height is per tier and the gap is between rituals, so neither reaches the other.
     Instrument validated on `contact` and `wishes` first, both reproducing 700 / 1180 / 695. */
  celebrations: 2764,
  wishes: 700,
};

const UPRIGHT_HEIGHTS: SectionHeights = {
  invite: 1180,
  "event-info": 2360,
  contact: 1180,
  family: 2360,
  /* RE-MEASURED 2026-10-07 on the BUILT page, at this band's own nominal box, after
     `document.fonts.ready` and every image complete. The real five-ritual section replaced the
     placeholder these figures were taken from.
     THE THREAD'S ROUTE THROUGH CELEBRATIONS IS STILL COMPOSED FOR THE PLACEHOLDER: this height
     makes the stretch span the right distance, but its SHAPE awaits the owner's drawing on the
     built page (owner's decision, 2026-10-07). That is accepted, not a defect to fix here.
     THIS FIGURE INCLUDES THE FIRST TWO RITUALS' TEMPORARY PHOTOGRAPHS, which are dropped before
     main (`content/rituals.ts`). The photo-free base is 2404 / 2423 / 1666 at tall / upright /
     wide, and each ritual that gains photographs adds a CONSTANT +180 / +184 / +214 — measured to
     the pixel across 0, 1, 2 and 3 rituals, and independent of how many photographs any one of
     them carries. So removing them means subtracting two increments, not re-deriving the height. */
  celebrations: 2791,
  wishes: 1180,
};

const WIDE_HEIGHTS: SectionHeights = {
  invite: 695,
  "event-info": 695,
  contact: 695,
  family: 695,
  /* RE-MEASURED 2026-10-07 on the BUILT page, at this band's own nominal box, after
     `document.fonts.ready` and every image complete. The real five-ritual section replaced the
     placeholder these figures were taken from.
     THE THREAD'S ROUTE THROUGH CELEBRATIONS IS STILL COMPOSED FOR THE PLACEHOLDER: this height
     makes the stretch span the right distance, but its SHAPE awaits the owner's drawing on the
     built page (owner's decision, 2026-10-07). That is accepted, not a defect to fix here.
     THIS FIGURE INCLUDES THE FIRST TWO RITUALS' TEMPORARY PHOTOGRAPHS, which are dropped before
     main (`content/rituals.ts`). The photo-free base is 2404 / 2423 / 1666 at tall / upright /
     wide, and each ritual that gains photographs adds a CONSTANT +180 / +184 / +214 — measured to
     the pixel across 0, 1, 2 and 3 rituals, and independent of how many photographs any one of
     them carries. So removing them means subtracting two increments, not re-deriving the height. */
  celebrations: 2094,
  wishes: 695,
};

const HEIGHTS_BY_BAND: Record<BandId, SectionHeights> = {
  tall: TALL_HEIGHTS,
  upright: UPRIGHT_HEIGHTS,
  wide: WIDE_HEIGHTS,
};

const WIDTH_BY_BAND: Record<BandId, number> = {
  tall: 393,
  upright: 820,
  wide: 1536,
};

/* `not-found` is the invite's geometry by construction (`thread-css.ts`'s `routeFor` resolves it
   the same way), so it takes the invite's measured box rather than carrying its own row. */
export function sectionBox(id: ThreadId, band: BandId): SectionBox {
  const of = id === "not-found" ? "invite" : id;
  return { width: WIDTH_BY_BAND[band], height: HEIGHTS_BY_BAND[band][of] };
}
