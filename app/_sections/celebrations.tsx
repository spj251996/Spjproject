import celebrations from "@/app/celebrations.module.css";
import {
  Botanical,
  SECTION_PLACEMENT,
} from "@/components/background/botanical";
import { SprigIcon } from "@/components/icons";
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
                    {/* The leaf sits on the title's own line so a wrapping description cannot
                        orphan it, and it is ALWAYS the row's first child -- a mirrored row is
                        pushed and aligned by its parent, never reversed, which would render
                        the Malayalam before the English (owner). `items-baseline` rather than
                        `items-center`: the leaf reads as punctuation opening the title, and
                        punctuation sits on the text's baseline. */}
                    {/* `flex-wrap` rather than a media query, and it is self-adjusting: a flex
                        item moves to the next line on its MAX-CONTENT hypothetical size, so the
                        Malayalam drops below the title exactly when the three cannot share a line,
                        and the English then has the full width and stops wrapping itself. At 320px
                        that is what happens; from 360px up all three still fit on one line and
                        nothing moves (owner, 2026-10-07). No width is hardcoded, so a longer title
                        or a wider Malayalam is handled the day it arrives. */}
                    <div className="flex flex-wrap items-baseline gap-space-2xs">
                      <SprigIcon
                        className="shrink-0 text-accent-gold"
                        size={32}
                      />
                      <h3 className="type-heading-lg text-ink">
                        {ritual.title}
                      </h3>
                      {/* Beside the English title at every band (owner), never stacked under it.
                          `leading-tight` because Malayalam's own ascenders and the pre-base signs
                          otherwise grow the shared line box past the title's line height.
                          `type-caption`, NOT the `type-heading-lg` of the title beside it: Malayalam
                          carries more apparent height than Latin at the same point size, so at
                          heading-lg it out-weighed the English it accompanies -- and it is what
                          makes the title row fit the phone band (owner, 2026-10-07; the width
                          arithmetic is in DESIGN.md -> Timeline). */}
                      <span className="type-caption font-(family-name:--font-malayalam) text-accent-gold leading-tight">
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
