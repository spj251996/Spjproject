/* Sample strings run at real copy length, so wrapping and card height are exercised. The portable
   components take flat scalars; object-shaped samples live in `./domain-samples`. */

import type { EventSegment, RitualStatus } from "@/content/types";

/* Generated stand-in photographs. A data-URI SVG is a separate document and cannot read a CSS
   custom property, so nothing here can resolve from the token layer.

   These tones are therefore deliberately OUTSIDE the design system — a neutral photographic grey,
   not a copy of any surface or accent value. A photograph is not made of design tokens, and a
   literal copy of one would be a second source that drifts silently the next time a surface moves.
   Their only job is to stand in for a real image at the right dimensions. */
const PHOTO_BACK = "#8C877C";
const PHOTO_MID = "#B4AEA2";
const PHOTO_FORE = "#5E5950";

function svgImage(width: number, height: number, body: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="${PHOTO_BACK}"/>${body}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export const samplePortraitImage = svgImage(
  256,
  256,
  `<rect width="256" height="256" fill="${PHOTO_MID}"/><circle cx="128" cy="96" r="46" fill="${PHOTO_BACK}"/><path d="M32 256a96 96 0 0 1 192 0Z" fill="${PHOTO_FORE}"/>`,
);

const sampleRitualImages = [
  svgImage(
    320,
    400,
    `<circle cx="160" cy="150" r="70" fill="${PHOTO_MID}"/><path d="M0 400 L120 240 L200 320 L320 200 V400Z" fill="${PHOTO_FORE}"/>`,
  ),
  svgImage(
    320,
    240,
    `<rect x="40" y="40" width="240" height="160" fill="${PHOTO_MID}"/><circle cx="160" cy="120" r="40" fill="${PHOTO_FORE}"/>`,
  ),
  svgImage(
    320,
    480,
    `<path d="M160 60 L260 420 H60Z" fill="${PHOTO_MID}"/><rect x="0" y="420" width="320" height="60" fill="${PHOTO_FORE}"/>`,
  ),
];

export const sampleEvent = {
  venue: "Placeholder Cathedral of the Sample Parish",
  mapUrl: "https://example.com/placeholder-map-location",
} satisfies Pick<EventSegment, "venue" | "mapUrl">;

export const samplePortrait = {
  name: "Name",
  relationship: "Relation",
  src: null,
};

interface TimelineNodeSample {
  title: string;
  description: string;
  status: RitualStatus;
  previewImages: string[];
  side: "left" | "right";
}

export const sampleTimelineNodes: TimelineNodeSample[] = [
  {
    title: "Placeholder Completed Ritual",
    description:
      "A completed node at rest, described at the length the real entries will run to.",
    status: "completed",
    previewImages: sampleRitualImages,
    side: "left",
  },
  {
    title: "Placeholder Upcoming Ritual",
    description:
      "An upcoming node, with the same copy weight and never a preview strip or gallery action.",
    status: "upcoming",
    previewImages: [],
    side: "right",
  },
];

export const sampleGalleryPanel = {
  title: "Placeholder Ritual Gallery",
  images: sampleRitualImages,
};
