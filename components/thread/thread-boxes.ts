import { type BandId, THREAD_BANDS } from "./thread-bands.ts";
import type { SectionBox, ThreadId } from "./thread-geometry.ts";

/* MEASURED on the real render at the band's own nominal viewport (the width below is that band's box
   width; only the height is section-specific). Re-measure from each section's own
   `getBoundingClientRect().height`, never `scrollHeight`, and validate the instrument against
   `wishes` (700 / 1180 / 695) before trusting a new number.

   One box per band was wrong because a section's height is not the band's: the paired sections
   stack in portrait and run roughly 2x a single card, and Celebrations grows by a fixed increment
   per photographed ritual. Composing against one box per band stretched those sections' geometry
   up to 2.4x past the render. */
type SectionHeights = Record<ThreadId, number>;

const TALL_HEIGHTS: SectionHeights = {
  /* One screen again since 2026-10-14, when the invite's phone content came back inside 393x700; it
     was 707 from 2026-10-11 and 845 at the audit. Re-measured on `/thread/current` (now `/thread`) with `contact` (since retired) and
     `wishes` reproducing 700 in the same run. */
  invite: 700,
  /* Two screens again since 2026-10-14: the frame now presses a window the full ground cannot hold
     (`mounted-sheet-frame-css.ts` → `windowFits`), where the stacked pair had overrun by 4.5-10.5px. */
  "event-info": 1400,
  family: 1400,
  /* Photo-free base, plus +184 / +184 / +190 per photographed ritual (tall / upright / wide);
     measured to the pixel across 0, 1, 2 and 3 rituals. Re-measure after any ritual or photo change.
     The thread's route through Celebrations is still composed for the placeholder section: this
     height is real, its shape awaits the redraw. */
  celebrations: 2173,
  wishes: 700,
};

const UPRIGHT_HEIGHTS: SectionHeights = {
  invite: 1180,
  "event-info": 2360,
  family: 2360,
  /* Photo-free base, plus +184 / +184 / +190 per photographed ritual (tall / upright / wide);
     measured to the pixel across 0, 1, 2 and 3 rituals. Re-measure after any ritual or photo change.
     The thread's route through Celebrations is still composed for the placeholder section: this
     height is real, its shape awaits the redraw. */
  celebrations: 2262,
  wishes: 1180,
};

const WIDE_HEIGHTS: SectionHeights = {
  invite: 695,
  "event-info": 695,
  family: 695,
  /* Photo-free base, plus +184 / +184 / +190 per photographed ritual (tall / upright / wide);
     measured to the pixel across 0, 1, 2 and 3 rituals. Re-measure after any ritual or photo change.
     The thread's route through Celebrations is still composed for the placeholder section: this
     height is real, its shape awaits the redraw. */
  celebrations: 1513,
  wishes: 695,
};

const HEIGHTS_BY_BAND: Record<BandId, SectionHeights> = {
  tall: TALL_HEIGHTS,
  upright: UPRIGHT_HEIGHTS,
  wide: WIDE_HEIGHTS,
};

const WIDTH_BY_BAND = Object.fromEntries(
  THREAD_BANDS.map((band) => [band.id, band.box.width]),
) as Record<BandId, number>;

export function sectionBox(id: ThreadId, band: BandId): SectionBox {
  return { width: WIDTH_BY_BAND[band], height: HEIGHTS_BY_BAND[band][id] };
}
