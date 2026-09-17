/* Sample data for the portable `ui/` specimens (DESIGN.md → Components → UI).

   Convention: every string names what it is and is written at the length real copy will have — a
   specimen validated against short stubs proves nothing about wrapping, truncation or card height.

   Props were read from each component, not inferred from a type name: `portrait` and
   `timeline-node` take FLAT SCALARS, not a `WeddingEvent` / `FamilyMember` / `Ritual` object,
   because the portable layer may not name a domain type. The object-shaped samples the domain
   components consume live in `./domain-samples`. */

import type { EventSegment, RitualStatus } from "@/content/types";

/** The two `EventSegment` fields the `button-action` specimen needs — the venue its accessible name
    carries and the map target it hands off to — with no field the schema lacks. */
export const sampleEvent = {
  venue: "Placeholder Cathedral of the Sample Parish",
  mapUrl: "https://example.com/placeholder-map-location",
} satisfies Pick<EventSegment, "venue" | "mapUrl">;

/** `portrait` with `src: null` — the component's designed missing-image state, where
    `image-placeholder` shows through as the base layer. No portrait assets exist in this repo yet;
    that gap is carried to the sample-asset ask rather than filled with an invented file. */
export const samplePortrait = {
  name: "Placeholder Family Member",
  relationship: "Placeholder Relation",
  src: null,
};

interface TimelineNodeSample {
  title: string;
  description: string;
  status: RitualStatus;
  previewImages: string[];
  side: "left" | "right";
}

/** Both node states, which the spine requires the Timeline specimen to show. `previewImages` is
    empty because no ritual photography exists yet: `timeline-node` renders no preview strip for an
    empty list, so the completed state still reads correctly. */
export const sampleTimelineNodes: TimelineNodeSample[] = [
  {
    title: "Placeholder Completed Ritual",
    description:
      "A completed node at rest: the preview strip and the gallery action appear here once ritual photographs exist to fill them.",
    status: "completed",
    previewImages: [],
    side: "left",
  },
  {
    title: "Placeholder Upcoming Ritual",
    description:
      "An upcoming node carries the same copy weight but never a preview strip or a gallery action, whatever images the ritual turns out to have.",
    status: "upcoming",
    previewImages: [],
    side: "right",
  },
];

/** `gallery-modal-panel` is the presentational extraction `gallery-modal` demos through — it is the
    demo mechanism, not a specimen of its own. `images` is empty pending sample assets; the panel
    renders its contrast ground, title and close control regardless. */
export const sampleGalleryPanel = {
  title: "Placeholder Ritual Gallery",
  images: [] as string[],
};
