import { GallerySection, RuleList, Specimen } from "@/app/design-system/_kit";
import { SECTION_PLACEMENT } from "@/components/background/botanical-placement";

const PAPER_BASE_POINTERS = [
  "No component: this page's own background is the paper base.",
  "surface-base, painted in document order with no z-index of its own · grained paint → Foundations · Paper Grain",
];

const BOTANICAL_POINTERS = [
  "Nineteen named pieces, generated into public/botanical/.",
  "Each piece's width and placement are tuned per width tier and read from the viewport, never from the frame's ring bands.",
  "A portrait window takes the tablet tier's placement at any width, because a portrait window stacks its cards however wide it is.",
  "Composites with mix-blend-mode: multiply, so the layer and anything a piece sits inside carry no z-index — every card's frame at --z-content (20) keeps it below content.",
  "Only the invite's two pieces carry a z-index, --z-invite-bloom (1), on the piece itself, so they paint after every other piece: while they animate, WebKit would paint any piece painted after them as a white rectangle.",
  "The invite and the not-found screen share one layout: not-found reuses the invite's own list.",
];

/* Three real pieces at one tier, enough to show the drawings and the blend without restaging a
   section's placement. */
const SAMPLE_PIECES = ["arching-branch", "corner-spray", "corner-trail"];
const SAMPLE_TIER = "laptop";

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
        <Specimen
          description="Three of the generated pieces at the laptop tier, on the paper ground with the multiply blend they take on the page."
          id="botanical-pieces"
          name="Pieces"
          note="Shown side by side at a gallery size, not at their tuned widths or anchors — placement is per section and per tier, listed below."
          source="public/botanical/"
          spec="AVIF first, WebP fallback · mix-blend-mode: multiply on surface-base · no z-index but the invite's own two"
        >
          <div className="flex flex-wrap items-end gap-space-lg bg-surface-base p-space-md">
            {SAMPLE_PIECES.map((piece) => (
              <picture key={piece}>
                <source
                  srcSet={`/botanical/${piece}-${SAMPLE_TIER}.avif`}
                  type="image/avif"
                />
                {/* 200px: gallery layout constant. */}
                <img
                  alt=""
                  className="block w-[200px] mix-blend-multiply"
                  decoding="async"
                  loading="lazy"
                  src={`/botanical/${piece}-${SAMPLE_TIER}.webp`}
                />
              </picture>
            ))}
          </div>
        </Specimen>
        <RuleList rules={BOTANICAL_POINTERS} />
        <RuleList rules={BOTANICAL_INVENTORY} />
      </GallerySection>
    </>
  );
}
