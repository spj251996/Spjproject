import type { ReactNode } from "react";
import {
  sampleEvent,
  sampleGalleryPanel,
  samplePhotoSets,
  samplePortrait,
  samplePortraitImage,
} from "@/app/design-system/_data/ui-samples";
import {
  ChromeFrame,
  GallerySection,
  Specimen,
} from "@/app/design-system/_kit";
import { CallIcon, ChatIcon, MapIcon } from "@/components/icons";
import { ButtonAction } from "@/components/ui/button-action";
import { CoupleNames } from "@/components/ui/couple-names";
import { GalleryModalPanel } from "@/components/ui/gallery-modal-panel";
import { ImagePlaceholder } from "@/components/ui/image-placeholder";
import { PhotoStrip } from "@/components/ui/photo-strip";
import { Portrait } from "@/components/ui/portrait";
import { SprigOrnament } from "@/components/ui/sprig-ornament";
import { invite, rituals } from "@/content";
import { GalleryButtonActionDemo } from "./gallery-action-demos";

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
/* The dilation is set PER CALL SITE and has no default, because the right value depends on how
   large the drawing renders there. These two literals copy `app/_sections/invite.tsx` and
   `app/_sections/wishes.tsx` and must follow them. */
const NAMES_STROKE_UNITS = { invite: 1.6, wishes: 2.2 };

const PORTRAIT_SIZING =
  "[--portrait-diameter:72px] md:[--portrait-diameter:112px] lg:[--portrait-diameter:72px] xl:[--portrait-diameter:88px]";

export function ComponentsSections() {
  return (
    <>
      <GallerySection
        id="ui"
        intro="Portable primitives: the action, the sprig ornament, the couple's drawn names, portraits, the preview row, the gallery overlay and the image stand-in."
        mapsTo="Components → UI"
        source="@/components/ui/*"
        title="Components · UI"
      >
        <Specimen
          description="The page's one control: a mark on a small raised disc beside a sentence-case italic label, with no box around it. Used for the map action, a contact's call and WhatsApp actions, and for a ritual's photo-row gallery action."
          id="ui-button-action"
          name="button-action"
          note="The three states cannot be posed — hover it on a pointer device to see the disc and label grow and thicken without shifting, press it (on any device, phones having no hover) to see it dim, and tab to it for the focus ring. The gallery action here does nothing when pressed."
          source="@/components/ui/button-action"
          spec={[
            "rest · the mark on an --action-disc (32px) disc in the bare surface-elevated colour with the mount shadow — never the bg-surface-elevated utility, which would lay the stock's grain; no fill, border or lift on the control itself",
            "the mark is scaled on the disc, never resized by its size prop — each mark's box derives from its own drawing's diagonal, so equal sizes give unequal boxes; the scale moves with the disc in proportion, so the mark keeps its share of the circle",
            "hover · the disc and label scale 1.06 and thicken optically — label 0.35px either side, mark 0.4px all round — so nothing reflows",
            "press · the whole mark dims",
            "focus · the focus ring on the target, never transitioned",
            "the target is transparent and at least --touch-target (44px) each way — the disc stopped being the touch target in 2026-10, so the hit area stays full size whatever the disc does",
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
          description="A pair of sprig marks either side of whatever it is given. Used on five section-head eyebrows — Event Info's, Family's, the timeline's, Wishes' and the not-found screen's — and on each ritual's Malayalam title. Six call sites; ELEVEN ornaments on the published page, since Event Info and Family each render theirs twice and there are five rituals."
          id="ui-sprig-ornament"
          name="sprig-ornament"
          note="It carries no type role and no colour, which is what lets one component serve both rows below: each call site keeps its own element and role. A colour utility here would beat .type-eyebrow's own gold, declared in @layer components, and the Malayalam must not take that role at all — its 0.2em tracking breaks conjuncts rather than spacing them. The second row is the real Malayalam from content, not a sample. The invite's eyebrow and Contact's deliberately take none: the invite's leads the hero, and Contact's files are scheduled for removal. A second arrangement — the marks between two short rules — is behind a lever at /preview for the couple to judge (DESIGN.md → Iteration Notes → Open Decisions); the marks alone are the default and what ships."
          source="@/components/ui/sprig-ornament"
          spec="the sprig mark at 23px on the diagonal, which renders 16px tall — the Iconography floor for this mark, whose viewBox is not square · gap space-2xs each side · NEITHER mark flipped, so both face the way ornamental-divider's does"
        >
          <div className="flex flex-col items-center gap-space-md">
            <p className="type-eyebrow">
              <SprigOrnament>Our traditions</SprigOrnament>
            </p>
            <span className="font-(family-name:--font-malayalam) text-(length:--text-heading-lg) text-accent-gold font-semibold leading-tight">
              <SprigOrnament>{rituals[0].malayalam}</SprigOrnament>
            </span>
          </div>
        </Specimen>

        <Specimen
          description="The couple's names as drawn geometry rather than type, traced from the legacy invitation's own lettering. One source serves the invite's stack and Wishes' single line by translation alone."
          id="ui-couple-names"
          name="couple-names"
          note="Each lockup here is sized by the type role it replaces, read from the token rather than copied, which is how the drawing stays on the names scale rather than on a size chosen for it — so the two specimens step at the breakpoints their roles do. The dilation is per call site and has no default (the values above copy the two sections). What a specimen cannot show: the invite switches between these two forms on orientation, and the single line grows to 5.3em at laptop and 5.8em at desktop in landscape. The names are real text to a reader — an sr-only span carries them and the drawing is aria-hidden, so the invite's h1 has an accessible name. It supersedes display-name and heading-script, both tagged [retire] along with the two __joiner selectors that share one declaration between them, and their SIZE TOKENS must outlive them because these em widths resolve against them."
          source="@/components/ui/couple-names"
          spec={[
            "the invite's stack · 1.85em wide at phone, 2.513em from md up · dilated 1.6 units",
            "Wishes' line · 3.65em at phone, 4.656em from md up · dilated 2.2 units · 6.09 : 1",
            "the ampersand drawn 35% smaller than the trace while keeping its full layout slot — a narrower slot would render the names larger, the width being a fixed em",
            "viewBox padded three stroke widths every side, or the swash tips clip flat at dpr 1 · fill currentColor, set to ink-muted INSIDE the component rather than at either call site — the invite's h1 carries text-ink and this overrides it",
          ]}
        >
          <div className="flex flex-col items-center gap-space-lg">
            <Variant label="stacked · the invite">
              <div style={{ fontSize: "var(--text-display-name)" }}>
                <CoupleNames
                  layout="stacked"
                  names={invite.coupleNames}
                  strokeUnits={NAMES_STROKE_UNITS.invite}
                />
              </div>
            </Variant>
            <Variant label="one line · Wishes">
              <div style={{ fontSize: "var(--text-heading-script)" }}>
                <CoupleNames
                  layout="line"
                  names={invite.coupleNames}
                  strokeUnits={NAMES_STROKE_UNITS.wishes}
                />
              </div>
            </Variant>
          </div>
        </Specimen>

        <Specimen
          description="One ritual's preview strip, the cue that its set continues, and the action that opens the gallery. A ritual with no photographs renders none of it — which is what ships today, so this specimen is the only place the row can be seen."
          id="ui-photo-row"
          name="photo-row"
          note="Shown through photo-row's client seam, photo-strip, which measures this cell rather than a ritual's block — so the frame count and row height are this box's answer, not the section's. The five frames come from a three-image sample set, so the +N cue has something to count. Pressing a frame or the action opens the real gallery."
          source="@/components/ui/photo-row"
          spec="one solved row height · frame width is the capped aspect times it · 3 frames when 3 fit, else 2 · +N on the last frame · action below the strip, centred under it — it aligned to the strip's end until 2026-10-10, when the rituals became one centred column"
        >
          <PhotoStrip
            id="ritual"
            sets={samplePhotoSets}
            title="Placeholder Ritual Gallery"
          />
        </Specimen>

        <Specimen
          description="Full-viewport overlay holding one ritual's images, opened from that ritual's photo-row."
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
            <Variant className="w-[160px]" label="4:5 · gallery previews">
              <ImagePlaceholder height={5} width={4} />
            </Variant>
          </div>
        </Specimen>
      </GallerySection>
    </>
  );
}
