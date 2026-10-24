import type { ReactNode } from "react";
import {
  sampleEvent,
  sampleGalleryPanel,
  samplePhotoSets,
  samplePortrait,
  samplePortraitImage,
  sampleRitualAspects,
  sampleRitualFulls,
  sampleRitualImages,
  sampleRitualThumbs,
} from "@/app/design-system/_data/ui-samples";
import {
  ChromeFrame,
  GallerySection,
  Specimen,
  SpecimenGroup,
} from "@/app/design-system/_kit";
import { MapIcon, SprigIcon } from "@/components/icons";
import { ButtonAction } from "@/components/ui/button-action";
import { CoupleNames } from "@/components/ui/couple-names";
import { GalleryModalPanel } from "@/components/ui/gallery/gallery-modal-panel";
import { PhotoStrip } from "@/components/ui/gallery/photo-strip";
import { PhotoViewerPanel } from "@/components/ui/gallery/photo-viewer";
import { ImagePlaceholder } from "@/components/ui/image-placeholder";
import { Portrait } from "@/components/ui/portrait";
import { ScrollProgress } from "@/components/ui/scroll-progress";
import { SprigOrnament } from "@/components/ui/sprig-ornament";
import { invite, wishes } from "@/content";
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

/* The dilation is set PER CALL SITE and has no default, because the right value depends on how
   large the drawing renders there. These two literals copy `app/_sections/invite.tsx` and
   `app/_sections/wishes.tsx` and must follow them. */
const NAMES_STROKE_UNITS = { invite: 1.6, wishes: 3.2 };

/* The composing section sets the diameter, and the specimen has none of its own, so it borrows
   Family's. These literals copy `components/family/family.tsx` and must follow it. */
const PORTRAIT_SIZING =
  "[--portrait-diameter:72px] md:[--portrait-diameter:112px] lg:[--portrait-diameter:72px] xl:[--portrait-diameter:88px]";

export function ComponentsSections() {
  return (
    <>
      <GallerySection
        id="shell"
        intro="DESIGN.md → Components → Shell."
        mapsTo="Components → Shell"
        title="Components · Shell"
      >
        <Specimen
          description="The traced sprig, defined once for the whole document as the symbol every sprig mark draws."
          id="shell-sprig-symbol"
          name="sprig-symbol"
          source="@/components/shell/sprig-symbol"
          spec={[
            "the path is the couple's own drawing, traced, with the tracer's flip and scale baked into the coordinates and the box re-origined on the drawing's ink",
            "mounted once in the root layout: a mark resolves its symbol against the document, so the symbol has to exist wherever any mark renders",
            "defined once rather than inlined at every mark, so one ornament no longer weighs several kilobytes of the page",
          ]}
        >
          <Variant className="items-start" label="The sprig mark · 48px">
            <SprigIcon size={48} />
          </Variant>
        </Specimen>

        <Specimen
          description="The drawn couple's names, defined once for the whole document as three word-group symbols: each name and the ampersand."
          id="shell-couple-names-symbol"
          name="couple-names-symbol"
          source="@/components/shell/couple-names-symbol"
          spec={[
            "generated, never hand-edited: Components → UI → couple-names names its source of record and the script that regenerates it",
            "mounted once in the root layout for the same reason as sprig-symbol; it renders in two sections, so inlining the geometry would ship it twice",
          ]}
        >
          <div style={{ fontSize: "var(--text-display-name)" }}>
            <CoupleNames
              layout="stacked"
              names={invite.coupleNames}
              strokeUnits={NAMES_STROKE_UNITS.invite}
            />
          </div>
        </Specimen>
      </GallerySection>

      <GallerySection
        id="ui"
        intro="Portable primitives: the action, the sprig ornament, the couple's drawn names, portraits, the preview row, the gallery overlay, the full-screen photo viewer and the image stand-in."
        mapsTo="Components → UI"
        source="@/components/ui/*"
        title="Components · UI"
      >
        <Specimen
          description="The page's one control: a mark on a small raised disc beside a sentence-case italic label, with no box around it. Used for the map action and for a ritual's photo-row gallery action."
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
            "the target is transparent and at least --touch-target (44px) each way, so the hit area stays full size whatever the disc does",
            "a web destination opens in its own tab; a link home stays in this one",
          ]}
        >
          <div className="flex flex-wrap gap-space-2xl">
            <Variant
              className="items-start"
              label="The map action · map mark · reads Meet us here · named Meet us here, <venue>"
            >
              <ButtonAction
                aria-label={`Meet us here, ${sampleEvent.venue}`}
                href={sampleEvent.mapUrl}
                mark={<MapIcon size={24} />}
              >
                Meet us here
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
          spec="circle crop · rim: stroke-divider accent-gold ring off a stroke-rim-offset paper ring · name in body, ink · relationship in caption-italic, ink-muted, drawn space-3xs up · glow: shadow-glow-couple outward of the rim, set by the composing section on the bride's and the groom's alone · image-placeholder fallback"
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

        <SpecimenGroup title="Gallery">
          <Specimen
            description="One ritual's preview strip, the cue that its set continues, and the action that opens the gallery. A ritual with no photographs renders none of it."
            headingLevel={4}
            id="ui-photo-row"
            name="photo-row"
            note="Shown through photo-row's client seam, photo-strip, which measures this cell rather than a ritual's block — so the frame count and row height are this box's answer, not the section's. The five frames come from a three-image sample set, so the +N cue has something to count, and each sample is its own thumbnail — the specimen shows the component, not the build-time pipeline that derives three deliveries on the page. Pressing a frame opens the real viewer on that photograph; the +N frame and the action open the real grid."
            source="@/components/ui/gallery/photo-row"
            spec="one solved row height · frame width is the capped aspect times it · 3 frames when 3 fit, else 2 · +N on the last frame · action below the strip, aligned to its end; on the page the strip and its action sit at the ritual block's right edge · a frame opens the viewer, the +N frame and the action the grid · a frame shows the copy bounded 600×600, the grid the 1000px one, the viewer the copy bounded 2000×2000, so the strip never fetches a larger file · every frame under a transparent save cover, which draws the frame's focus ring as a 2px inset band"
          >
            <PhotoStrip
              aspects={sampleRitualAspects}
              id="ritual"
              sets={samplePhotoSets}
              thumbs={sampleRitualThumbs}
              fulls={sampleRitualFulls}
              title="Placeholder Ritual Gallery"
            />
          </Specimen>

          <Specimen
            description="Full-viewport overlay holding one ritual's images, opened from that ritual's photo-row. Two layers: this grid, and photo-viewer."
            headingLevel={4}
            id="ui-gallery-modal"
            name="gallery-modal"
            note="Shown through its grid panel with generated sample images; tiles here open nothing. The history that lets back pop one layer, focus handling and the scroll restore on close need the live modal — open it from photo-row above."
            source="@/components/ui/gallery/gallery-modal"
            spec="z-modal · scrim at 0.92 · masonry whose column count follows the photographs it shows (1 → one, centred · 2–4 → two · 5+ → two, three from lg) · radius-card tiles · a tile opens photo-viewer · scrolling is the grid's only gesture · a tile holds no place until its photograph has loaded, and one that fails is hidden whole, leaving no gap or focus stop · every tile under a transparent save cover, which draws the tile's focus ring as a 2px inset band · on hover a tile shows the zoom-in cursor and its photograph grows 3% in its frame · Close is the viewer's round control, a cross in a 48px dark circle · opens and closes with a fade and a 24px rise (duration-base) · a layer change fades the new layer's content (duration-fast), the scrim never moving · a deliberate tap on empty space (down and up, under 10px) goes back one layer · reduced motion: instant"
          >
            <ChromeFrame height={320}>
              <GalleryModalPanel {...sampleGalleryPanel} />
            </ChromeFrame>
          </Specimen>

          <Specimen
            description="One ritual photograph, full screen — the layer a photo-row frame or a gallery-modal tile opens."
            headingLevel={4}
            id="ui-photo-viewer"
            name="photo-viewer"
            note="Shown through its panel at the second of three sample images, so both previous and next show; the controls here move nothing. Swipe, the arrow keys, the slide, the fades, a tap outside and back popping one layer need the live modal — open a frame in photo-row above."
            source="@/components/ui/gallery/photo-viewer"
            spec="the grid's scrim · one photograph fitted whole (object-contain), never cropped · counter n / N in type-action · every control a drawn mark in a 48px circle of the scrim at 60%, going fully dark and growing 10% on hover and on press: All photos (four tiles) and Close (a cross), icon only and named for screen readers, and previous / next chevrons absent at the ends · the viewer copy only for the photograph on screen, with its strip copy drawn under the stage while it loads so the stage never goes dark · a failed copy reads This photo couldn't load, and a tap on its dark stage closes the viewer · a transparent save cover · the next photograph slides 32px in from the side it came from (duration-fast), after release · the letterbox around the fitted photograph is empty space · on touch, the first full-screen photograph of a visit nudges once toward the next"
          >
            <ChromeFrame height={320}>
              <PhotoViewerPanel
                count={3}
                index={1}
                src={sampleRitualImages[1]}
                title="Placeholder Ritual Gallery"
              />
            </ChromeFrame>
          </Specimen>
        </SpecimenGroup>

        <Specimen
          description="Neutral stand-in shown while an image is missing or loading."
          id="ui-image-placeholder"
          name="image-placeholder"
          source="@/components/ui/image-placeholder"
          spec="holds final dimensions · a faint wash of ink · no icon or text"
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

        <Specimen
          description="The section-head eyebrow's frame: two sprig marks mirrored outward between two hairline rules, on five eyebrows — Event Info's, Family's, the timeline's, Wishes' and the not-found screen's. Five call sites; SIX ornaments on the published page, since Event Info and Family each render theirs twice and the not-found screen is not part of it."
          id="ui-sprig-ornament"
          name="sprig-ornament"
          note="It carries no type role and no colour: the call site keeps its own element and role, and a colour utility here would beat .type-eyebrow's own gold, declared in @layer components. The invite's eyebrow deliberately takes none: it leads the hero. The rituals' header line carries one leading sprig instead; see it on the page at Domain · Celebrations."
          source="@/components/ui/sprig-ornament"
          spec="the sprig mark at 23px on the diagonal, which renders 16px tall — the Iconography floor for this mark, whose viewBox is not square · gap space-2xs between every item · the LEADING mark flipped so both point outward — the trailing one as drawn already does · a rule outside each mark, space-lg (32px) long, a top border at --stroke-hairline (0.5px), in the wrapper's own colour"
        >
          <p className="type-eyebrow">
            <SprigOrnament>Our traditions</SprigOrnament>
          </p>
        </Specimen>

        <Specimen
          description="The couple's names as drawn geometry rather than type, traced from the legacy invitation's own lettering. One source serves the invite's stack and Wishes' single line by translation alone."
          id="ui-couple-names"
          name="couple-names"
          note="Each lockup here is sized in em of a size token — --text-display-name for the stack, --text-heading-script for the line — read from the token rather than copied, which is how the drawing stays on the names scale rather than on a size chosen for it, so the two specimens step at the breakpoints those tokens do. The dilation is per call site and has no default (the values above copy the two sections). What a specimen cannot show: the invite switches between these two forms on orientation, and the single line grows to 5.3em at laptop and 5.8em at desktop in landscape. The names are real text to a reader — an sr-only span carries them and the drawing is aria-hidden, so the invite's h1 has an accessible name. The names are drawn geometry, not a type role; two SIZE tokens are left, and these em widths resolve against them."
          source="@/components/ui/couple-names"
          spec={[
            "the invite's stack · 2.59em wide at phone, 2.513em from md up · dilated 1.6 units",
            "Wishes' line · 3.65em at phone, 4.656em from md up · dilated 3.2 units · 6.09 : 1",
            "the ampersand drawn 35% smaller than the trace while keeping its full layout slot — a narrower slot would render the names larger, the width being a fixed em · in the stack it is lifted 24 source units above centre (AMPERSAND_LIFT)",
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
                  /* Wishes' OWN field, not the invite's. They hold the same string today and are
                     two separate content fields, so a later edit can diverge them — at which
                     point a specimen reading the invite's would misrepresent the section. */
                  names={wishes.coupleNames}
                  strokeUnits={NAMES_STROKE_UNITS.wishes}
                />
              </div>
            </Variant>
          </div>
        </Specimen>

        <Specimen
          description="A hairline across the top of the screen on / that fills as the guest scrolls. Its track is /'s scroll cue: present from the first screen, it says the page continues before anything has moved."
          id="ui-scroll-progress"
          name="scroll-progress"
          note="The real component, held inside a frame so its fixed position resolves here instead of over the gallery — so its fill is LIVE and follows this gallery page's own scroll. Fixed beside <main> on /, never inside it, so no section's box or fit can move; the lab routes carry none and keep the thread as their cue."
          source="@/components/ui/scroll-progress"
          spec="track --progress-track, ink at 10% · --progress-height, 2px on a phone and 3px from md up · fill --progress-fill, thread-red → thread-vermilion at 82% → thread-core at the leading edge · glow --progress-glow, the thread's vermilion · fixed at the top, z --z-progress (45), under the gallery's scrim · fill = share of the page scrolled, clamped 0–1, exactly 1 at the last scroll position, a page with nothing to scroll reads as full, no transition · the track is server-rendered, so it shows with no script · the track arrives as the opening's last beat at --opening-type-end · aria-hidden, never focusable, unchanged under reduced motion"
        >
          {/* 48px: gallery layout constant, a strip tall enough to read the progress line against. */}
          <ChromeFrame height={48}>
            <ScrollProgress />
          </ChromeFrame>
        </Specimen>
      </GallerySection>
    </>
  );
}
