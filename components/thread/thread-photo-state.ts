import { ritualPhotos } from "../../content/ritual-photos.generated.ts";
import { rituals } from "../../content/rituals.ts";
import type { BandId } from "./thread-bands.ts";
import type { ThreadId } from "./thread-geometry.ts";
import {
  type Connector,
  PHOTO_STATE_PATHS,
  type PhotoCombination,
  THREAD_PATHS,
} from "./thread-paths.ts";

/* Which rituals carry photographs, one character per ritual in page order: "1" where a ritual has
   any. Photographs arrive ritual by ritual after each event, so any combination can ship, and the
   thread's route through Celebrations is generated for every one of them. */
export const PHOTO_COMBINATION: PhotoCombination = rituals
  .map((ritual) => ((ritualPhotos[ritual.id]?.length ?? 0) > 0 ? "1" : "0"))
  .join("");

export function photographedCount(combination: PhotoCombination): number {
  return [...combination].filter((c) => c === "1").length;
}

/* A section's connectors on the page with this combination of photographs: the combination's own
   where it re-shapes that section, the drawn route everywhere else. */
export function threadPaths(
  band: BandId,
  id: ThreadId,
  combination: PhotoCombination = PHOTO_COMBINATION,
): Connector[] {
  return PHOTO_STATE_PATHS[band][combination]?.[id] ?? THREAD_PATHS[band][id];
}
