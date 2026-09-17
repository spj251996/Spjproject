/* Sample strings run at real copy length, so wrapping and card height are exercised. The portable
   components take flat scalars; object-shaped samples live in `./domain-samples`. */

import type { EventSegment, RitualStatus } from "@/content/types";

/* Generated sample images. A data-URI SVG is a separate document and cannot read CSS custom
   properties, so the palette values are written literally here as asset content. */
function svgImage(width: number, height: number, body: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="#ECE6D7"/>${body}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export const samplePortraitImage = svgImage(
  256,
  256,
  '<rect width="256" height="256" fill="#FFFEFA"/><circle cx="128" cy="96" r="46" fill="#D29B2F"/><path d="M32 256a96 96 0 0 1 192 0Z" fill="#0F3D2E"/>',
);

const sampleRitualImages = [
  svgImage(
    320,
    400,
    '<circle cx="160" cy="150" r="70" fill="#D29B2F"/><path d="M0 400 L120 240 L200 320 L320 200 V400Z" fill="#0F3D2E"/>',
  ),
  svgImage(
    320,
    240,
    '<rect x="40" y="40" width="240" height="160" fill="#FFFEFA"/><circle cx="160" cy="120" r="40" fill="#0F3D2E"/>',
  ),
  svgImage(
    320,
    480,
    '<path d="M160 60 L260 420 H60Z" fill="#D29B2F"/><rect x="0" y="420" width="320" height="60" fill="#0F3D2E"/>',
  ),
];

export const sampleEvent = {
  venue: "Placeholder Cathedral of the Sample Parish",
  mapUrl: "https://example.com/placeholder-map-location",
} satisfies Pick<EventSegment, "venue" | "mapUrl">;

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
