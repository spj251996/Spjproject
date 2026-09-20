import { GallerySection, RuleList } from "@/app/design-system/_kit";

const PAPER_BASE_POINTERS = [
  "No component: this page's own background is the paper base.",
  "surface-base on z-base · grained paint → Foundations · Paper Grain",
];

const BOTANICAL_POINTERS = [
  "Thirteen named pieces, generated into public/botanical/.",
  "Composites with mix-blend-mode: multiply, so it never carries its own z-index — DOM order alone keeps it below content.",
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
        source="@/components/background/botanical"
        title="Background · Botanical Edge"
      >
        <RuleList rules={BOTANICAL_POINTERS} />
      </GallerySection>
    </>
  );
}
