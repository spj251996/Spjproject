import { GallerySection, RuleList } from "@/app/design-system/_kit";
import { SECTION_PLACEMENT } from "@/components/background/botanical";

const PAPER_BASE_POINTERS = [
  "No component: this page's own background is the paper base.",
  "surface-base on z-base · grained paint → Foundations · Paper Grain",
];

const BOTANICAL_POINTERS = [
  "Twenty named pieces, generated into public/botanical/.",
  "Each piece's width and placement are tuned per width tier and read from the viewport, never from the frame's ring bands.",
  "A portrait window takes the tablet tier's placement at any width, because a portrait window stacks its cards however wide it is.",
  "Composites with mix-blend-mode: multiply, so it never carries its own z-index — DOM order alone keeps it below content.",
];

/* Which drawing lives where — the one thing this gallery can show that DESIGN.md must not, since
   the assignment is implementation and the records behind it are tuned values. Rendered from the
   placement table itself: a hand-typed inventory is a second copy of an assignment that has
   already drifted twice in this project. */
const BOTANICAL_INVENTORY = Object.entries(SECTION_PLACEMENT).map(
  ([section, placements]) =>
    `${section}: ${placements.map((placement) => placement.piece).join(" · ")}`,
);

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
        <RuleList rules={BOTANICAL_INVENTORY} />
      </GallerySection>
    </>
  );
}
