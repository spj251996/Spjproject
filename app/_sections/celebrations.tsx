import celebrations from "@/app/celebrations.module.css";
import {
  Botanical,
  SECTION_PLACEMENT,
} from "@/components/background/botanical";
import { MountedSheet } from "@/components/layout/mounted-sheet";
import type { FramePaint } from "@/components/layout/mounted-sheet-frame";
import { PhotoStrip } from "@/components/ui/photo-strip";
import { SprigOrnament } from "@/components/ui/sprig-ornament";
import { rituals } from "@/content";

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

export function CelebrationsSection({ paint }: { paint?: FramePaint }) {
  /* Every ritual's set, keyed by id, handed WHOLE to each strip: `photoFit` must be solved across
     all of them or the section's height stops being a constant (`components/ui/photo-fit.ts`). */
  const photoSets = Object.fromEntries(
    rituals.map((ritual) => [ritual.id, ritual.images]),
  );

  return (
    <section className="relative" id="celebrations">
      <Botanical pieces={SECTION_PLACEMENT.celebrations} />
      <MountedSheet paint={paint} tall>
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
                    {/* THE MALAYALAM LEADS, IN THE EYEBROW POSITION, BRACKETED BY THE SPRIG
                        (owner, 2026-10-09), and the English title then has its row to itself and
                        grows into `type-heading-md`. What the split BUYS is measured rather than
                        asserted: the old shared line put the leaf, the English and the Malayalam
                        in one 216px block at 360px, where the Malayalam alone took 83px at
                        heading-lg's size -- so the three only ever fit by shortening a title and
                        stepping the Malayalam down to `type-caption`. On its own line that
                        constraint does not exist, which is what pays for the larger title.

                        NO ROW IS REVERSED, and that outlives the mirrored rows themselves —
                        they went with the alternating band on 2026-10-10. Reversing one renders
                        the Malayalam after the English, and the ornament's two marks with it, so
                        the ordering is the markup's rather than a parent's to flip.

                        `text-(length:--text-heading-lg)` and NOT `.type-heading-lg`: that role is
                        weight 700 and Noto Serif Malayalam ships no cut above 600, so the role
                        would render SYNTHETIC bold on the conjuncts -- a smeared outline, not a
                        heavier face. The size is taken from the role and the weight is stated
                        separately: 600, settled by the owner on a render (2026-10-10), and the only
                        cut `app/layout.tsx` now loads.

                        NOT `.type-eyebrow` despite taking the eyebrow's position: that role's
                        0.2em tracking breaks Malayalam conjuncts rather than spacing them, and its
                        10px phone size sits below every reading role in the system.

                        `leading-tight` because Malayalam's ascenders and its pre-base signs
                        otherwise grow the line box past the size's own line height. */}
                    <span className="font-(family-name:--font-malayalam) text-(length:--text-heading-lg) text-accent-gold font-semibold leading-tight">
                      <SprigOrnament>{ritual.malayalam}</SprigOrnament>
                    </span>
                    <h3 className="type-heading-md text-ink mt-space-2xs">
                      {ritual.title}
                    </h3>
                    <p className="type-body-italic text-ink-muted mt-space-2xs">
                      {ritual.tagline}
                    </p>
                    {/* No `max-w-text`: the block's own width IS the measure here (owner) -- the
                        36rem cap held every block width above about 65% at an identical 600px
                        paragraph, which made the width decision appear to do nothing. */}
                    <p className="type-body text-ink mt-space-2xs text-pretty">
                      {ritual.description}
                    </p>
                    {/* The only trigger. A ritual with no photographs renders no strip, no
                        gallery action and no client boundary at all, which is what ships today. */}
                    {ritual.images.length > 0 && (
                      <div className="mt-space-sm w-full">
                        <PhotoStrip
                          id={ritual.id}
                          sets={photoSets}
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
