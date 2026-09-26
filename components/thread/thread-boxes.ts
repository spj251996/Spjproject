import type { BandId } from "./thread-bands.ts";
import type { SectionBox, ThreadId } from "./thread-geometry.ts";

/* MEASURED on the real render, at the band's own nominal viewport (the width below is that band's
   box width; only the height is section-specific). Re-measure by rendering each section at its
   band's nominal width and reading `scrollHeight` off the section's own box, the same way Task 1's
   spike did — never derive a section's height from the band's box alone.

   A band-wide box was wrong because a section's height is not the band's: the paired sections
   (Event Info, Family) stack in portrait, so they run roughly 2x a single card's height, and
   Celebrations is a list whose height will grow again when the photo gallery lands in Ship 2.
   Composing a thread against one box per band stretched those sections' geometry up to 2.4x
   vertically past what the render actually shows. */
type SectionHeights = Record<Exclude<ThreadId, "not-found">, number>;

const TALL_HEIGHTS: SectionHeights = {
  invite: 700,
  "event-info": 1400,
  contact: 700,
  family: 1400,
  celebrations: 1668,
  wishes: 700,
};

const UPRIGHT_HEIGHTS: SectionHeights = {
  invite: 1180,
  "event-info": 2360,
  contact: 1180,
  family: 2360,
  celebrations: 1732,
  wishes: 1180,
};

const WIDE_HEIGHTS: SectionHeights = {
  invite: 695,
  "event-info": 695,
  contact: 695,
  family: 695,
  celebrations: 1320,
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
