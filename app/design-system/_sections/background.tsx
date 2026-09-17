import { GallerySection, RuleList } from "@/app/design-system/_kit";

const PAPER_BASE_POINTERS = [
  "No component: this page's own background is the paper base.",
  "surface-base on z-base · grained paint → Foundations · Paper Grain",
];

const BOTANICAL_POINTERS = [
  "No component and no assets yet; the layer is reserved on z-botanical.",
  "The thread passes in front of it → Technical · Z-Index Scale",
];

export function BackgroundSections() {
  return (
    <>
      <GallerySection
        id="paper-base"
        intro="Full-viewport ivory paper carrying the paper grain, the same behind every section."
        mapsTo="Background → Paper Base"
        title="Background · Paper Base"
      >
        <RuleList rules={PAPER_BASE_POINTERS} />
      </GallerySection>

      <GallerySection
        id="botanical-edge"
        intro="Sparse wildflower elements at the screen edges, above the paper base and below all content."
        mapsTo="Background → Botanical Edge"
        title="Background · Botanical Edge"
      >
        <RuleList rules={BOTANICAL_POINTERS} />
      </GallerySection>
    </>
  );
}
