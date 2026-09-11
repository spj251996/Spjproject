import { GallerySection, RuleList } from "@/app/design-system/_kit";

/* curate-gallery — Bucket 2, the two Background sections, in DESIGN.md document order
   (curate-gallery → section-spine.md § 10–11). One module for the whole bucket, per the skill's pinned `sections/`
   structure ("exactly 5 files — the count is law").

   Background is a two-section bucket here, so both titles carry the `Background · ` prefix: the
   skill's prefix-free Background title assumes a single-section bucket, and this doc names two
   sub-sections (curate-gallery → section-spine.md).

   Prose renders through the semantic type classes directly — this project has no prose layer and
   the gallery may not invent one (DESIGN.md → Overview → No prose layer). */

/* § 10 — Paper Base, tagged [no component]. All three of the doc's visual bullets; token names carry
   the values, which § 1 Colors already renders as live swatches. */
const PAPER_BASE_RULES = [
  "Fills the viewport at surface-base on z-base, and paints #F8F7F3 once its grain is applied — see Foundations → Paper Grain.",
  "The texture is static and low-contrast — it reads as material, never as pattern.",
  "The one exception is the deep-green contrast section, which takes surface-contrast as an intentional visual event.",
];

const PAPER_BASE_NO_COMPONENT_RULES = [
  "The ground is painted directly on the page rather than by a dedicated layer, so there is nothing to render in isolation here.",
  "Grain binds to the surface rather than to the caller, so a component layer over the page ground would be a second grained surface and apply the texture twice.",
  "Reopens only if the botanical edge lands and the background becomes a genuine multi-layer subsystem.",
];

/* § 11 — Botanical Edge, tagged [no component]. Its four specification bullets. */
const BOTANICAL_RULES = [
  "Low opacity on z-botanical, never overlapping text or reducing readability.",
  "Placement may vary between sections, but the treatment stays cohesive across the page.",
  "Elements are sparse rather than a repeated pattern, in muted natural tones derived from the palette, introducing no competing bright color.",
  "The thread passes selectively in front of and behind these elements to produce the weaving illusion.",
];

const BOTANICAL_GAP_RULES = [
  "Treatment is deferred until layouts and content are settled — an Open Decision in DESIGN.md, not an oversight.",
  "The layer is reserved and carries no assets, so the entry produces no generated output and no component is emitted for it.",
  "Botanical assets have no source, tone tokens, or per-section placement — a standing Known Gap.",
];

export function BackgroundSections() {
  return (
    <>
      <GallerySection
        id="paper-base"
        intro="Full-viewport ivory paper carrying the paper grain, painted directly on the page rather than by a dedicated layer. The background does not change color between sections — section identity comes from composition, never from a background swap. Tagged [no component] in DESIGN.md — a layer over the page would be a second grained surface, so this section renders its specification rather than a live sample."
        mapsTo="Background → Paper Base"
        title="Background · Paper Base"
      >
        <RuleList rules={PAPER_BASE_RULES} />
        <RuleList label="No component" rules={PAPER_BASE_NO_COMPONENT_RULES} />
      </GallerySection>

      <GallerySection
        id="botanical-edge"
        intro="Sparse wildflower elements at the screen edges, sitting above the paper base and below all content. Tagged [no component] in DESIGN.md — the layer is reserved and carries no assets, so this section renders its specification rather than a stub."
        mapsTo="Background → Botanical Edge"
        title="Background · Botanical Edge"
      >
        <RuleList label="Specification" rules={BOTANICAL_RULES} />
        <RuleList label="Not yet implemented" rules={BOTANICAL_GAP_RULES} />
      </GallerySection>
    </>
  );
}
