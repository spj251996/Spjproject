import type {
  MeasuredFit,
  Orientation,
  WidthTier,
} from "./mounted-sheet-frame";

export type GroundKey = `${WidthTier}:${Orientation}`;

const TIERS: readonly WidthTier[] = ["phone", "tablet", "laptop", "desktop"];
const ORIENTATIONS: readonly Orientation[] = ["portrait", "landscape"];

/* One ground per (tier, orientation), shared by every section, so every card is the same width and
   the card edges line up down the scroll.

   The value returned is the widest content width any section needs in that cell — which is the
   SMALLEST ground, since the card is `width: 100%` inside the ground and the ground is what is left
   over. Taking the widest requirement is the safe direction: a wider card holds shorter content, so
   a section that fitted at its own narrower card still fits at the shared wider one. Taking the
   narrowest would force a section taller than it was measured at. */
export function sharedGrounds(
  fits: readonly MeasuredFit[],
): ReadonlyMap<GroundKey, number> {
  const grounds = new Map<GroundKey, number>();

  for (const tier of TIERS) {
    for (const orientation of ORIENTATIONS) {
      const key: GroundKey = `${tier}:${orientation}`;
      let widest = 0;
      for (const fit of fits) {
        for (const regime of fit.regimes[tier][orientation]) {
          widest = Math.max(widest, regime.minContentWidth);
        }
      }
      grounds.set(key, widest);
    }
  }

  return grounds;
}
