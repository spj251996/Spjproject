import { ritualPhotoProps } from "@/app/_sections/ritual-photo-props";
import celebrations from "./celebrations.module.css";
import "@/app/frames/tall.css";
import { Botanical } from "@/components/background/botanical";
import { SECTION_PLACEMENT } from "@/components/background/botanical-placement";
import { SprigIcon } from "@/components/icons";
import { MountedSheet } from "@/components/layout/mounted-sheet";
import { PhotoStrip } from "@/components/ui/photo-strip";
import { FLOOR_DIAGONAL, SprigOrnament } from "@/components/ui/sprig-ornament";
import { rituals } from "@/content";
import { ritualPhotos } from "@/content/ritual-photos.generated";

/* The timeline card. The section is tall (`mounted-sheet`'s tall mode), so it takes no measured
   fit — it grows to its content and the page scrolls past it, which is why it is the one section
   that breaks the one-viewport rhythm. */
/* Two lines, not one paragraph, because the second does different work: it is what tells a guest
   photographs arrive here after the wedding, so it is set apart and set in italic. The card would
   otherwise read as finished rather than as still to come. */
const CELEBRATIONS_INTRO =
  "A look at the ceremonies and rituals that shape our wedding.";
const CELEBRATIONS_PROMISE =
  "Moments leading up to the day, shared as they unfold.";

/* No `mt-*` utility here: `celebrations.list`'s own `margin: 0` is a plain, unlayered rule, so it
   always beats a Tailwind margin utility regardless of value — the gap has to be set inside the
   module instead (celebrations.module.css), through `--celebrations-intro-gap`. */
const CELEBRATIONS_LIST_CLASS = `${celebrations.list} flex flex-col`;

export function CelebrationsSection() {
  /* Known at module load, so `photoFit` waits on nothing but the strip's own width measurement —
     never on an image decoding. The derivation and its reasons live in the helper. */
  const {
    sets: photoSets,
    aspects: photoAspects,
    thumbs: photoThumbs,
    fulls: photoFulls,
  } = ritualPhotoProps(rituals, ritualPhotos);

  return (
    <section className="relative" id="celebrations">
      <Botanical pieces={SECTION_PLACEMENT.celebrations} />
      <MountedSheet tall>
        <div
          className="flex w-full flex-col items-center"
          style={{
            ["--celebrations-measure" as string]: "36rem",
            ["--celebrations-intro-gap" as string]: "var(--spacing-space-lg)",
          }}
        >
          {/* The head keeps the 36rem reading measure and centres in it. The ritual list below
              does NOT: each block's own width is its paragraph's measure, which is the whole
              reason the block width was chosen (owner, 2026-10-07). */}
          <div className="flex w-full max-w-(--celebrations-measure) flex-col items-center text-center">
            {/* A colour utility here would override the colour `.type-eyebrow` owns. */}
            <p className="type-eyebrow">
              <SprigOrnament>Our traditions</SprigOrnament>
            </p>
            <h2 className="type-heading-xl text-ink-muted mt-space-2xs">
              The Celebrations
            </h2>

            <div className="mt-space-2xs flex flex-col gap-space-sm">
              <p className="type-body text-ink text-pretty">
                {CELEBRATIONS_INTRO}
              </p>
              <p className="type-body-italic text-ink text-pretty">
                {CELEBRATIONS_PROMISE}
              </p>
            </div>
          </div>

          {/* biome-ignore lint/a11y/noRedundantRoles: WebKit and VoiceOver need it once list-style is none */}
          <ol className={CELEBRATIONS_LIST_CLASS} role="list">
            {rituals.map((ritual) => (
              // `data-thread-row` is the one hook the thread's per-row scroll split needs
              // (`components/thread/page-thread.tsx`'s `measureSubdivisions`) -- nothing else here
              // identifies a single ritual row, and celebrations carries no `.mounted-sheet-frame__
              // leaf` (it is one tall card, not a stacked pair) for that mechanism to reuse.
              <li className={celebrations.row} data-thread-row key={ritual.id}>
                <div className={celebrations.block}>
                  <div className={celebrations.text}>
                    {/* THE HEADER LINE: sprig · English title · Malayalam, on one baseline at every
                        tier (owner, 2026-10-11). Where the line cannot hold all three the Malayalam
                        wraps under the title — a flex wrap, keyed to no width. `items-baseline`
                        aligns the title and the Malayalam; the sprig has no baseline of its own, so
                        it centres on the line instead, or the flex row would synthesise one from its
                        box and drop the title below the Malayalam's.

                        The sprig is the mark as drawn, ONCE — not `SprigOrnament`, whose outward pair
                        between rules belongs to the section eyebrows alone.

                        The Malayalam takes `heading-sm`'s SIZE at weight 600, never the role: the
                        role is weight 700 and Noto Serif Malayalam's heaviest cut loaded is 600, so
                        the role would render SYNTHETIC bold on the conjuncts. Not `.type-eyebrow`
                        either — its 0.2em tracking breaks conjuncts. `leading-tight` because
                        Malayalam's ascenders and pre-base signs otherwise grow the line box. */}
                    <div className={celebrations.header} data-ritual-header>
                      <SprigIcon
                        className="shrink-0 self-center text-accent-gold max-lg:hidden"
                        size={FLOOR_DIAGONAL}
                      />
                      <h3
                        className={`type-heading-md text-ink ${celebrations.title}`}
                      >
                        {ritual.title}
                      </h3>
                      <span className="font-(family-name:--font-malayalam) text-(length:--text-heading-sm) text-accent-gold font-semibold leading-tight max-md:ms-auto">
                        {ritual.malayalam}
                      </span>
                    </div>
                    <p className="type-body-italic text-ink-muted mt-space-2xs">
                      {ritual.tagline}
                    </p>
                    {/* No `max-w-text`: the block's own width IS the measure here (owner) -- the
                        36rem cap held every block width above about 65% at an identical 600px
                        paragraph, which made the width decision appear to do nothing. */}
                    <p className="type-body text-ink mt-space-2xs text-pretty">
                      {ritual.description}
                    </p>
                    {/* The only trigger, and it is the LIST'S LENGTH, never the manifest key's
                        presence: an uploaded-then-emptied directory leaves an empty list behind.
                        A ritual with no photographs renders no strip, no gallery action and no
                        client boundary at all. */}
                    {/* `text-end` places the shrink-wrapped strip at the block's right edge (owner,
                        2026-10-11); its action follows the strip's end inside `photo-row`. */}
                    {photoSets[ritual.id].length > 0 && (
                      <div className="mt-space-sm w-full text-end">
                        <PhotoStrip
                          aspects={photoAspects}
                          fulls={photoFulls}
                          id={ritual.id}
                          sets={photoSets}
                          thumbs={photoThumbs}
                          title={ritual.title}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </MountedSheet>
    </section>
  );
}
