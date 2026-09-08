/* Sample data for the portable `ui/` specimens (DESIGN.md → Components → UI).

   Convention: every string names what it is and is written at the length real copy will have — a
   specimen validated against short stubs proves nothing about wrapping, truncation or card height.
   Numerals in placeholder dates, times and phone numbers are zeroed so no reader mistakes demo data
   for the real invitation, while the character count stays true to the real string.

   Props were read from each component, not inferred from a type name: `event-card`, `portrait` and
   `timeline-node` all take FLAT SCALARS, not a `WeddingEvent` / `FamilyMember` / `Ritual` object,
   because the portable layer may not name a domain type. The object-shaped samples the domain
   components consume live in `./domain-samples`. */

import type { RitualStatus } from "@/content/types";

/** Every optional field present. Field set matches `WeddingEvent` minus `id`, which the card,
    being portable, does not take. Consumed by Components → UI → `event-card`. */
export const sampleEventCard = {
  name: "Placeholder Ceremony",
  city: "Placeholder City",
  date: "Saturday, 00 Month 0000",
  venue: "Placeholder Cathedral of the Sample Parish",
  time: "00:00 AM onwards",
  address:
    "Placeholder Cathedral, 00 Sample Church Road, Placeholder District, Placeholder State 000000",
  mapUrl: "https://example.com/placeholder-map-location",
  contactPhone: "+00 00000 00000",
};

/** Same card with every optional field absent — demonstrates the documented behavior that a missing
    venue, time, address or action target renders nothing rather than a placeholder label
    (rules/data-integrity.md → Missing values). */
export const sampleEventCardMinimal = {
  name: "Placeholder Reception",
  city: "Placeholder City",
  date: "Saturday, 00 Month 0000",
  venue: null,
  time: null,
  address: null,
  mapUrl: null,
  contactPhone: null,
};

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
