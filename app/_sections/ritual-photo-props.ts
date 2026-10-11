import type { Ritual, RitualPhoto } from "../../content/types.ts";

/* Every ritual's set, keyed by id, is handed WHOLE to each strip: `photoFit` must be solved across all
   of them or the section's height stops being a constant (`components/ui/photo-fit.ts`). Everything
   is keyed on the DISPLAY path, the photograph's identity — the thumbnail and the viewer copy are
   further deliveries of the same photograph, not further photographs.

   Read from the rituals, never from the manifest's keys, so a folder left behind for a ritual that no
   longer exists reaches nothing in `next dev` (the build refuses that folder outright). */
export function ritualPhotoProps(
  rituals: Pick<Ritual, "id">[],
  manifest: Record<string, RitualPhoto[]>,
) {
  const photosOf = (id: string) => manifest[id] ?? [];
  const every = rituals.flatMap((ritual) => photosOf(ritual.id));
  return {
    sets: Object.fromEntries(
      rituals.map((ritual) => [
        ritual.id,
        photosOf(ritual.id).map((photo) => photo.display),
      ]),
    ),
    aspects: Object.fromEntries(
      every.map((photo) => [photo.display, photo.width / photo.height]),
    ),
    thumbs: Object.fromEntries(
      every.map((photo) => [photo.display, photo.thumb]),
    ),
    fulls: Object.fromEntries(
      every.map((photo) => [photo.display, photo.full]),
    ),
  };
}
