import { splitCoupleNames } from "@/app/_sections/shared";
import wishesStyles from "@/app/wishes.module.css";
import { wishesFit } from "@/app/wishes-fit";
import {
  Botanical,
  SECTION_PLACEMENT,
} from "@/components/background/botanical";
import { MountedSheet } from "@/components/layout/mounted-sheet";
import { CardThread } from "@/components/thread/page-thread";
import { wishes } from "@/content";

/* The page's close. The illustration's size and bleed
   distance are settled in DESIGN.md → Wishes; it takes no crop, mask or edge fade of its own. The
   illustration is static — Phase 4 renders no motion, and its entrance is decided in Phase 5 with
   the thread. */
export function WishesSection({ thread = false }: { thread?: boolean }) {
  const wishesNames = splitCoupleNames(wishes.coupleNames);

  return (
    <section className="relative" id="wishes">
      <Botanical fit={wishesFit} pieces={SECTION_PLACEMENT.wishes} />
      <MountedSheet fit={wishesFit}>
        <div
          className={`${wishesStyles.stack} wishes-stack flex w-full flex-col items-center`}
          style={{
            /* The drawing's own proportions once its transparent border is trimmed off. */
            ["--wishes-figure-ratio" as string]: "560 / 550",
          }}
        >
          <p className="type-eyebrow">A life in love</p>

          {/* This gap and the two below halve at phone, with `.figureCol`'s in `wishes.module.css`
              — the fourth of the same four, where the reason is written. */}
          <div className="mt-space-sm md:mt-space-lg [@media(64rem<=width<100rem)_and_(orientation:landscape)]:mt-space-md [@media(width>=100rem)_and_(orientation:landscape)]:mt-space-lg flex w-full flex-col items-center text-center">
            <p className="type-body text-pretty">{wishes.passage}</p>
            {/* The dash is chrome, not content — the citation itself is the reference alone, the
                same treatment the invite's citation gets. */}
            <p className="type-caption-italic text-ink-muted mt-space-xs [@media(64rem<=width<100rem)_and_(orientation:landscape)]:mt-space-sm [@media(width>=100rem)_and_(orientation:landscape)]:mt-space-md">
              {`— ${wishes.passageAttribution}`}
            </p>
          </div>

          {/* Wishes' own stretch of the thread, and the one reason it is mounted inside a card rather
              than drawn by the page's trunk: the card's `mounted-sheet-frame__box` is a stacking
              context at `{z.content}` and the thread's trunk is at `{z.thread}`, so a trunk-level
              stretch would paint over Wishes' type, where this one, carrying no z-index of its own,
              paints behind it. Its containing block is that same `__box`, the nearest positioned
              ancestor inside the stacking context. It sits after the illustration, so it paints in
              front of it. */}
          <div className={wishesStyles.figureCol}>
            <div aria-hidden className={wishesStyles.figure} />
          </div>
          {thread ? <CardThread /> : null}

          <p className="type-heading-script mt-space-sm md:mt-space-lg [@media(64rem<=width<100rem)_and_(orientation:landscape)]:mt-space-xl [@media(width>=100rem)_and_(orientation:landscape)]:mt-space-2xl">
            {wishesNames ? (
              <>
                <span>{wishesNames[0]}</span>
                <span className="type-heading-script__joiner">{" & "}</span>
                <span>{wishesNames[1]}</span>
              </>
            ) : (
              wishes.coupleNames
            )}
          </p>

          {/* Two lines in both layouts: the lead in italic, the names who send it in regular. */}
          <p
            className={`${wishesStyles.signoff} type-caption text-ink-muted mt-space-sm md:mt-space-lg [@media(64rem<=width<100rem)_and_(orientation:landscape)]:mt-space-2xl [@media(width>=100rem)_and_(orientation:landscape)]:mt-space-2xl text-center`}
          >
            <span className="type-caption-italic">{wishes.wishesLead}</span>
            <span>{wishes.wishesLine}</span>
          </p>
        </div>
      </MountedSheet>
    </section>
  );
}
