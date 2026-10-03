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
import { CallIcon, ChatIcon, MapIcon } from "@/components/icons";
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

/* The composing section sets the diameter, and the specimen has none of its own, so it borrows
   Family's. These literals copy `components/family/family.tsx` and must follow it. */
const PORTRAIT_SIZING =
  "[--portrait-diameter:72px] md:[--portrait-diameter:112px] lg:[--portrait-diameter:72px] xl:[--portrait-diameter:88px]";

export function ComponentsSections() {
  return (
    <>
      <GallerySection
        id="ui"
        intro="Portable primitives: the action, portraits, timeline nodes, the gallery overlay and the image stand-in."
        mapsTo="Components → UI"
        source="@/components/ui/*"
        title="Components · UI"
      >
        <Specimen
          description="The page's one control: a mark on a small raised disc beside a sentence-case italic label, with no box around it. Used for the map action, a contact's call and WhatsApp actions, and for a completed timeline-node's gallery action."
          id="ui-button-action"
          name="button-action"
          note="The three states cannot be posed — hover it on a pointer device to see the disc and label grow and thicken without shifting, press it (on any device, phones having no hover) to see it dim, and tab to it for the focus ring. The gallery action here does nothing when pressed."
          source="@/components/ui/button-action"
          spec={[
            "rest · the mark on a touch-target disc in the bare surface-elevated colour with the mount shadow — never the bg-surface-elevated utility, which would lay the stock's grain; no fill, border or lift on the control itself",
            "the mark is scaled on the disc, never resized by its size prop — each mark's box derives from its own drawing's diagonal, so equal sizes give unequal boxes",
            "hover · the disc and label scale 1.06 and thicken optically — label 0.35px either side, mark 0.4px all round — so nothing reflows",
            "press · the whole mark dims",
            "focus · the focus ring on the target, never transitioned",
            "the target is transparent and at least the touch target each way, so the hit area stays full size around the disc and label",
            "a web destination opens in its own tab; a telephone handoff and a link home stay in this one",
          ]}
        >
          <div className="flex flex-wrap gap-space-2xl">
            <Variant
              className="items-start"
              label="The map action · map mark · reads Meet us here · named Map, <venue>"
            >
              <ButtonAction
                aria-label={`Map, ${sampleEvent.venue}`}
                href={sampleEvent.mapUrl}
                mark={<MapIcon size={24} />}
              >
                Meet us here
              </ButtonAction>
            </Variant>
            <Variant
              className="items-start"
              label="A contact's actions · call and chat marks · named Call/WhatsApp, <name> · always stacked, never side by side · one shared width and left edge, so the discs line up"
            >
              <div className="mx-auto flex w-fit flex-col items-stretch gap-space-2xs">
                <ButtonAction
                  align="stretchStart"
                  aria-label="Call, Name"
                  href="tel:+10000000000"
                  mark={<CallIcon size={24} />}
                >
                  Call
                </ButtonAction>
                <ButtonAction
                  align="stretchStart"
                  aria-label="WhatsApp, Name"
                  href="https://wa.me/10000000000"
                  mark={<ChatIcon size={24} />}
                >
                  WhatsApp
                </ButtonAction>
              </div>
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
          spec="circle crop · rim: stroke-divider accent-gold ring off a stroke-rim-offset paper ring · name in body, ink · relationship in caption-italic, ink-muted, drawn space-3xs up · image-placeholder fallback"
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
          spec="title in heading-lg · description in body · completed adds radius-card previews and the gallery action"
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
          spec="z-modal · scrim shadow-warm at 0.92 · masonry · radius-card tiles"
        >
          <ChromeFrame height={320}>
            <GalleryModalPanel {...sampleGalleryPanel} />
          </ChromeFrame>
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
