import type { ReactNode } from "react";
import {
  sampleEvent,
  sampleGalleryPanel,
  samplePortrait,
  samplePortraitImage,
  sampleTimelineNodes,
} from "@/app/design-system/_data/ui-samples";
import {
  ChromeFrame,
  GallerySection,
  Specimen,
} from "@/app/design-system/_kit";
import { MapIcon } from "@/components/icons";
import { Thread } from "@/components/shell/thread";
import { ThreadOverlay } from "@/components/shell/thread-overlay";
import { ButtonAction } from "@/components/ui/button-action";
import { GalleryModalPanel } from "@/components/ui/gallery-modal-panel";
import { ImagePlaceholder } from "@/components/ui/image-placeholder";
import { Portrait } from "@/components/ui/portrait";
import {
  GalleryButtonActionDemo,
  TimelineNodeDemo,
} from "./gallery-action-demos";

interface VariantProps {
  label: string;
  className?: string;
  children: ReactNode;
}

function Variant({ label, className, children }: VariantProps) {
  return (
    <div className={`flex flex-col gap-space-2xs ${className ?? ""}`}>
      {children}
      <span className="type-caption text-ink">{label}</span>
    </div>
  );
}

const THREAD_POSES = [0.25, 0.6, 1];

/* The composing section sets the diameter, and the specimen has none of its own, so it borrows
   Family's. These literals copy `components/family/family.tsx` and must follow it. */
const PORTRAIT_SIZING =
  "[--portrait-diameter:72px] md:[--portrait-diameter:112px] lg:[--portrait-diameter:72px] xl:[--portrait-diameter:88px]";

export function ComponentsSections() {
  return (
    <>
      <GallerySection
        id="shell"
        intro="The thread: the one continuous overlay that runs the length of the page, and the family section's own drawing of it."
        mapsTo="Components → Shell"
        title="Components · Shell"
      >
        <Specimen
          description="The narrative spine, one SVG overlay across the whole page, posed at three points of its reveal."
          id="shell-thread-overlay"
          name="thread-overlay"
          note="Known gap until the Phase 5 rebuild: the interim component is viewport-fixed with stand-in curves, draws no wisp, and glows in one thread-red shadow instead of the vermilion stack."
          source="@/components/shell/thread-overlay"
          spec="thread-red · stroke-thread · round caps · z-thread · doc: wisp at 0.7, vermilion glow in three stacked shadows"
        >
          <div className="grid gap-space-md md:grid-cols-3">
            {THREAD_POSES.map((progress) => (
              <Variant
                key={progress}
                label={`${Math.round(progress * 100)}% drawn`}
              >
                <ChromeFrame ariaHidden height={260}>
                  <ThreadOverlay demoProgress={progress} />
                </ChromeFrame>
              </Variant>
            ))}
          </div>
        </Specimen>

        <Specimen
          description="A section-anchored drawing of the thread that curls back on itself: the family wrap, joining the bride side to the groom side."
          id="shell-thread"
          name="thread"
          note="Draws once as it scrolls into view; reload to replay. Drawn in full under reduced motion. Its paths are placeholders and it renders on no page before Phase 5. It draws no wisp, and glows in one thread-red shadow where the doc's thread-overlay describes a vermilion stack. The mobile path shows below lg, the desktop path from lg."
          source="@/components/shell/thread"
          spec="thread-red · stroke-thread · round caps · z-thread · section-anchored · duration-slow draw · glow as the draw ends"
        >
          <ChromeFrame ariaHidden height={320}>
            <Thread />
          </ChromeFrame>
        </Specimen>
      </GallerySection>

      <GallerySection
        id="ui"
        intro="Portable primitives: the engraved-rule control, portraits, timeline nodes, the gallery overlay and the image stand-in."
        mapsTo="Components → UI"
        source="@/components/ui/*"
        title="Components · UI"
      >
        <Specimen
          description="The page's one control, an engraved rule: the map action, and a completed timeline-node's gallery action."
          id="ui-button-action"
          name="button-action"
          note="Hover anywhere on the target, or tab to it for the focus ring. The gallery action here does nothing when pressed."
          source="@/components/ui/button-action"
          spec="two stroke-divider rules · action in accent-gold · optional mark · 44px target"
        >
          <div className="flex flex-wrap gap-space-2xl">
            <Variant
              className="items-start"
              label="The map action · map mark · named Map, <venue>"
            >
              <ButtonAction
                aria-label={`Map, ${sampleEvent.venue}`}
                href={sampleEvent.mapUrl}
                mark={<MapIcon size={24} />}
              >
                Map
              </ButtonAction>
            </Variant>
            <Variant className="items-start" label="The gallery action">
              <GalleryButtonActionDemo />
            </Variant>
          </div>
        </Specimen>

        <Specimen
          description="Circular, gold-rimmed family portrait with the person's name and relationship beneath it, used for every family member."
          id="ui-portrait"
          name="portrait"
          note="The composing section sets the diameter; the specimen borrows Family's. Set on the paper stock, whose colour fills the ring between photo and rim. The with-image sample is a generated placeholder."
          source="@/components/ui/portrait"
          spec="circle crop · rim: stroke-divider accent-gold ring off a stroke-rim-offset paper ring · name in body · relationship in caption, drawn space-3xs up · both ink · image-placeholder fallback"
        >
          <div
            className={`flex flex-wrap gap-space-2xl bg-surface-elevated p-space-md ${PORTRAIT_SIZING}`}
          >
            <Variant className="items-start" label="With an image">
              <Portrait {...samplePortrait} src={samplePortraitImage} />
            </Variant>
            <Variant className="items-start" label="Missing image">
              <Portrait {...samplePortrait} />
            </Variant>
          </div>
        </Specimen>

        <Specimen
          description="One ritual on the timeline, upcoming or completed."
          id="ui-timeline-node"
          name="timeline-node"
          note="Preview images are generated samples; the gallery action does nothing when pressed."
          source="@/components/ui/timeline-node"
          spec="title in heading-lg · description in body · completed adds radius-sm previews and the gallery action"
        >
          <div className="grid gap-space-lg md:grid-cols-2">
            {sampleTimelineNodes.map((node) => (
              <Variant key={node.title} label={node.status}>
                <TimelineNodeDemo {...node} />
              </Variant>
            ))}
          </div>
        </Specimen>

        <Specimen
          description="Full-viewport overlay holding one ritual's images, opened from a completed timeline-node."
          id="ui-gallery-modal"
          name="gallery-modal"
          note="Shown through its presentational panel with generated sample images: swipe, focus handling and the scroll restore on close need the live modal."
          source="@/components/ui/gallery-modal"
          spec="z-modal · scrim surface-contrast at 0.92 · masonry · radius-sm tiles"
        >
          <ChromeFrame height={320}>
            <GalleryModalPanel {...sampleGalleryPanel} />
          </ChromeFrame>
        </Specimen>

        <Specimen
          description="The cue at the invite's lower edge that the page continues."
          id="ui-scroll-cue"
          name="scroll-cue"
          note="No component: it is thread-overlay's residual glow in thread-vermilion, so there is nothing to render on its own."
        >
          {null}
        </Specimen>

        <Specimen
          description="Neutral stand-in shown while an image is missing or loading."
          id="ui-image-placeholder"
          name="image-placeholder"
          source="@/components/ui/image-placeholder"
          spec="holds final dimensions · ivory-family tone · no icon or text"
        >
          <div className="flex flex-wrap gap-space-lg">
            {/* 160px cell width: gallery layout constant. */}
            <Variant className="w-[160px]" label="1:1 · portrait">
              <ImagePlaceholder height={1} width={1} />
            </Variant>
            <Variant
              className="w-[160px]"
              label="4:5 · timeline-node and gallery previews"
            >
              <ImagePlaceholder height={5} width={4} />
            </Variant>
          </div>
        </Specimen>
      </GallerySection>
    </>
  );
}
