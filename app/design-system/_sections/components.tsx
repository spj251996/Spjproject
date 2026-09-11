import type { ReactNode } from "react";
import {
  sampleEvent,
  sampleGalleryPanel,
  samplePortrait,
  sampleTimelineNodes,
} from "@/app/design-system/_data/ui-samples";
import {
  ChromeFrame,
  GallerySection,
  RuleList,
  Specimen,
} from "@/app/design-system/_kit";
import { ThreadOverlay } from "@/components/shell/thread-overlay";
import { ButtonAction } from "@/components/ui/button-action";
import { GalleryModalPanel } from "@/components/ui/gallery-modal-panel";
import { ImagePlaceholder } from "@/components/ui/image-placeholder";
import { Portrait } from "@/components/ui/portrait";
import { TimelineNode } from "@/components/ui/timeline-node";

/* curate-gallery — Bucket 3, the two Components sections, in DESIGN.md document order
   (curate-gallery → section-spine.md § 12–13). One module for the whole bucket, per the skill's pinned `sections/`
   structure ("exactly 5 files — the count is law").

   UI renders eight Specimens flat at h3 with no SpecimenGroup layer: the doc lists eight `###`
   entries under one heading with no sub-taxonomy to mirror, and `ui/` is below the flattening
   threshold. Each specimen's `spec` carries that entry's documented rules, condensed, plus what the
   demo can and cannot show — the skill's UI recipe puts variant notes there, and eight separate
   prose lists would bury the specimens they annotate. */

interface VariantProps {
  /** Caption naming what this cell shows; the skill's `name · usage` cell caption. */
  label: string;
  className?: string;
  children: ReactNode;
}

function Variant({ label, className, children }: VariantProps) {
  return (
    <div className={`flex flex-col gap-space-2xs ${className ?? ""}`}>
      {children}
      <span className="type-body text-ink">{label}</span>
    </div>
  );
}

/* A generated sample asset, per the skill's rule for a project with no asset system: no portrait
   photography exists in this repo, and `portrait`'s documented with-image state cannot be shown
   without one. Kept as a data URI so it adds no file to the tree. Its colors are the palette's own
   values written literally because a data-URI SVG is a separate document and cannot read the CSS
   custom properties — these are asset content, not styling values. */
const SAMPLE_PORTRAIT_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="#FFFEFA"/><circle cx="128" cy="96" r="46" fill="#D29B2F"/><path d="M32 256a96 96 0 0 1 192 0Z" fill="#0F3D2E"/></svg>';

const SAMPLE_PORTRAIT_IMAGE = `data:image/svg+xml,${encodeURIComponent(SAMPLE_PORTRAIT_SVG)}`;

/* § 12 — Shell. All eight of `thread-overlay`'s documented rules. The section is 1:1 with its single
   component, so the rules sit at section level, as Foundations · Layout does with the divider. */
const THREAD_RULES = [
  "ONE colour and ONE width on both stocks — thread-red at --stroke-thread (1.6px) everywhere. A real thread does not change colour or thickness, it catches light differently. Only the glow differs between stocks.",
  "The wisp is the thread's ENDS, not an ornament: the tail that shows it has travelled on as it leaves the frame. --stroke-thread-wisp (1.2px), same thread-red, 0.7 opacity.",
  "Two modes, both real — a plain drawn line and a glowing one, each defined on each stock.",
  "Glow is thread-vermilion and behaves differently per stock because the two stocks are not symmetrical: ivory sits at 0.96 relative luminance against the green's 0.02, so there is 27x less room to add light. A glow cannot exist on paper — the paper treatment is an ink bleed, made by darkening.",
  "The glow is masked to the green stock's own bounds, inset by the mount's reveal, so it never spills onto the mount or the ground.",
  "The thread runs down one margin per section and crosses the centre only in the gaps between sheets. It never passes under a glyph — at screen height the centred type block owns the middle, so the margin is the only empty band running the full height.",
  "At rest — after settling, and whenever reduced motion is active — the thread is fully drawn with its wisp at its natural terminals, rather than hidden or partially revealed.",
  "Anchors to meaningful points — the two family sides and each ritual node — rather than floating.",
  "The overlay spans the DOCUMENT, not the viewport: absolutely positioned at full document height so it can anchor to content, with masks driven by measured sheet bounds. A viewport-fixed overlay structurally cannot.",
  "Paths are predefined per layout; the timeline spine is the one segment generated to fit measured node positions.",
  "KNOWN DRIFT: the component in code is still the position:fixed version and renders as disconnected decorations. The rebuild is Phase 5 — this section renders the specification, not a claim about the current code.",
];

const THREAD_POSES = [0.25, 0.6, 1];

/* § 13 — `scroll-cue`, tagged [no component]: its three documented rules, rendered as its
   specification. No stub component is emitted for it. */
const SCROLL_CUE_RULES = [
  "No standalone component is generated for this entry — it is thread-overlay's own residual glow in thread-red, left near the bottom edge after the thread settles, not a separate artifact.",
  "Gold is not used here: the cue works because the eye follows the thread downward, and a second accent would compete with it.",
  "Never bounces, pulses, or animates on a loop.",
];

export function ComponentsSections() {
  return (
    <>
      <GallerySection
        id="shell"
        intro="Site-wide chrome mounted once by the root layout. This project's shell is a single component — the narrative spine that runs the length of the page."
        mapsTo="Components → Shell"
        title="Components · Shell"
      >
        <RuleList rules={THREAD_RULES} />

        <Specimen
          description="The narrative spine: one continuous red thread rendered as a single SVG overlay across the whole page, posed here at three points of its reveal."
          id="shell-thread-overlay"
          name="thread-overlay"
          source="@/components/shell/thread-overlay"
          spec="Live render at three fixed draw positions, using the component's own demoProgress affordance — the prop suppresses the scroll binding, which a bounded frame with no scrolling root cannot drive. Each frame's transform bounds a `fixed inset-0` overlay; the frames are aria-hidden because the thread is decoration the component already hides from assistive technology. Two things this demo cannot show, both known and deferred: the geometry is provisional stand-in curves, because DESIGN.md supplies no path data for either layout, and in the page itself the thread reads as disconnected decorations rather than one spine — it is position: fixed, so it cannot anchor to page content. The rebuild is Phase 5, recorded in work/tasks.md → Backlog → Project follow-ups."
        >
          <div className="grid gap-space-md md:grid-cols-3">
            {THREAD_POSES.map((progress) => (
              <Variant
                key={progress}
                label={`demoProgress ${progress} — ${Math.round(progress * 100)}% drawn`}
              >
                <ChromeFrame ariaHidden height={260}>
                  <ThreadOverlay demoProgress={progress} />
                </ChromeFrame>
              </Variant>
            ))}
          </div>
        </Specimen>
      </GallerySection>

      <GallerySection
        id="ui"
        intro="The portable primitive layer — six documented entries, five of which have components. `scroll-cue` is documented as thread-overlay's own residual glow rather than an artifact of its own, so it renders its specification. `divider` is not listed here: the doc's Layout sub-section owns it, and it renders under Foundations · Layout."
        mapsTo="Components → UI"
        source="@/components/ui/*"
        title="Components · UI"
      >
        <Specimen
          description="The only interactive control on the page, used for the map action."
          id="ui-button-action"
          name="button-action"
          source="@/components/ui/button-action"
          spec="An engraved rule, not a button: two --stroke-divider hairlines in accent-gold above and below the action type role in the same gold, with no fill, no side border and no radius. Hover turns the rules and the label to ink and warms the space between them — pointer over one to see it. Padding is space-sm horizontal and space-xs vertical, so the rules overrun the label rather than sitting tight against it, which is what makes them read as rules and not an underline. Minimum hit area 44px regardless of visual size. THE FOCUS RING NEVER TRANSITIONS: hover colours do, but a ring that fades in from the label's own gold spends that fade at 2.39:1, below the 3:1 an indicator needs — so the transitioned properties are named rather than using transition-colors, which in Tailwind v4 sweeps outline-color in with them. The documented instance is an anchor, live under the page-level guard that cancels the navigation. The component's second element form, an onClick button, exists only because DESIGN.md → timeline-node composes a button-action to open the gallery — which this entry's own rule contradicts, and which is reported as drift rather than resolved. It takes a handler, so it cannot be posed from this server-rendered page."
        >
          <div className="flex flex-wrap gap-space-lg">
            <Variant
              className="items-start"
              label="Map — hands off to an external map destination"
            >
              <ButtonAction href={sampleEvent.mapUrl}>Map</ButtonAction>
            </Variant>
          </div>
        </Specimen>

        <Specimen
          description="Circular family portrait with a text relationship label beneath it, used for every member of both family groups."
          id="ui-portrait"
          name="portrait"
          source="@/components/ui/portrait"
          spec="Circular crop — the only circular container in the system · the name sits in body and the relationship label below it in eyebrow · missing images fall back to image-placeholder without collapsing the grouping. The rendered diameter has no token behind it: DESIGN.md states no portrait dimension, so the component's own inferred 128px default is what shows. The first sample is a generated placeholder SVG — this repo holds no portrait photography, so the with-image state has no real asset behind it."
        >
          <div className="flex flex-wrap gap-space-2xl">
            <Variant className="items-start" label="With an image">
              <Portrait
                name="Placeholder Family Member"
                relationship="Placeholder Relation"
                src={SAMPLE_PORTRAIT_IMAGE}
              />
            </Variant>
            <Variant
              className="items-start"
              label="Missing image — image-placeholder shows through"
            >
              <Portrait {...samplePortrait} />
            </Variant>
          </div>
        </Specimen>

        <Specimen
          description="One ritual on the timeline, rendered in either an upcoming or a completed state."
          id="ui-timeline-node"
          name="timeline-node"
          source="@/components/ui/timeline-node"
          spec="Title in heading-lg and description in body, attached to the thread on the side the alternation assigns · the upcoming state shows title and description only, while the completed state adds a 2–3 image preview and a button-action to open the gallery · activates with a thread glow once on entering the viewport, without repeating · upcoming nodes group three per viewport on desktop and two on mobile, and a completed node expands to its own viewport on both. Neither the preview strip nor the gallery action appears on the completed sample: no ritual photography exists yet, and the gallery handler belongs to the composing client section rather than to this server-rendered page. The anchor mark reads identically in both cells: it is thread-red in either state and carries only the activation glow, which tracks viewport entry rather than status."
        >
          <div className="grid gap-space-lg md:grid-cols-2">
            {sampleTimelineNodes.map((node) => (
              <Variant
                key={node.title}
                label={
                  node.status === "completed"
                    ? "Completed — title and description; with no images and no handler, neither the preview strip nor the gallery action renders"
                    : "Upcoming — title and description only"
                }
              >
                <TimelineNode {...node} />
              </Variant>
            ))}
          </div>
        </Specimen>

        <Specimen
          description="Full-viewport overlay holding one ritual's images, opened from a completed timeline-node."
          id="ui-gallery-modal"
          name="gallery-modal"
          source="@/components/ui/gallery-modal"
          spec="Sits on z-modal above the thread, with a masonry arrangement inside · swipe navigates between images, and closing returns the page to the same scroll position · images load only when the overlay opens · missing images degrade to image-placeholder without breaking the masonry · the scrim is surface-contrast at 0.92 opacity, which is this system's only realized deep-green ground. Demoed through gallery-modal-panel, the presentational half: the modal itself owns the focus trap, scroll lock, keyboard dismissal and swipe handling, none of which a bounded frame can exercise. The masonry is empty because no ritual photography exists, and the panel emits its own h2, which lands out of order beneath this h3."
        >
          <ChromeFrame height={320}>
            <GalleryModalPanel {...sampleGalleryPanel} />
          </ChromeFrame>
        </Specimen>

        <Specimen
          description="Static cue at the lower edge of the invite indicating the page continues. Tagged [no component] — no standalone artifact is generated for it, so this entry renders its specification."
          id="ui-scroll-cue"
          name="scroll-cue"
        >
          <RuleList label="Specification" rules={SCROLL_CUE_RULES} />
        </Specimen>

        <Specimen
          description="Neutral stand-in shown when an image is missing or still loading."
          id="ui-image-placeholder"
          name="image-placeholder"
          source="@/components/ui/image-placeholder"
          spec="Holds the final dimensions of the image it replaces so nothing reflows on load · ivory-family tone with no icon or text · used by portrait, timeline-node previews, and gallery-modal. The tone is inferred, not transcribed: the doc names no token, so the component derives it from the elevated shadow's ink tint at 6%, which is why it reads as a tinted hold rather than as a second ivory. The two ratios are the ones its callers actually use; the 160px cell width is a gallery layout constant, not a design value."
        >
          <div className="flex flex-wrap gap-space-lg">
            <Variant className="w-[160px]" label="1:1 — the portrait crop">
              <ImagePlaceholder height={1} width={1} />
            </Variant>
            <Variant
              className="w-[160px]"
              label="4:5 — timeline-node and gallery previews"
            >
              <ImagePlaceholder height={5} width={4} />
            </Variant>
          </div>
        </Specimen>
      </GallerySection>
    </>
  );
}
