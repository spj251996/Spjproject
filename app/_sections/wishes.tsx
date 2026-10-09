import "@/app/couple-names.css";
import { splitCoupleNames } from "@/app/_sections/shared";
import wishesStyles from "@/app/wishes.module.css";
import { wishesFit } from "@/app/wishes-fit";
import {
  Botanical,
  SECTION_PLACEMENT,
} from "@/components/background/botanical";
import { MountedSheet } from "@/components/layout/mounted-sheet";
import type { FramePaint } from "@/components/layout/mounted-sheet-frame";
import { CardThread } from "@/components/thread/page-thread";
import { CoupleNames } from "@/components/ui/couple-names";
import { SprigOrnament } from "@/components/ui/sprig-ornament";
import { wishes } from "@/content";

/* The page's close. The illustration's size and bleed
   distance are settled in DESIGN.md → Wishes; it takes no crop, mask or edge fade of its own. The
   illustration is static — Phase 4 renders no motion, and its entrance is decided in Phase 5 with
   the thread. */
export function WishesSection({
  paint,
  thread = false,
}: {
  paint?: FramePaint;
  thread?: boolean;
}) {
  const wishesNames = splitCoupleNames(wishes.coupleNames);

  return (
    <section className="relative" id="wishes">
      <Botanical fit={wishesFit} pieces={SECTION_PLACEMENT.wishes} />
      <MountedSheet fit={wishesFit} paint={paint}>
        <div
          className={`${wishesStyles.stack} wishes-stack flex w-full flex-col items-center`}
          style={{
            /* The drawing's own proportions once its transparent border is trimmed off. */
            ["--wishes-figure-ratio" as string]: "560 / 550",
          }}
        >
          <p className="type-eyebrow">
            <SprigOrnament>A life in love</SprigOrnament>
          </p>

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

          {/* The same drawn names on ONE line — one source, two layouts, placement arithmetic
              rather than a second trace. The role stays for the same reason it does at the invite:
              it is the `em` the asset's width resolves against, so the signature keeps the size it
              ships at today (260.8px at 56px, 335.2 at 72, 298 at 64 — 4.656em at every one). */}
          <p className="type-heading-script mt-space-sm md:mt-space-lg [@media(64rem<=width<100rem)_and_(orientation:landscape)]:mt-space-xl [@media(width>=100rem)_and_(orientation:landscape)]:mt-space-2xl">
            {/* 2.2 units, kept where the owner settled it on the render. Note it lands this lockup's
                thinnest stroke at 0.95px on a phone, a hair UNDER the one-device-pixel floor the
                figures above derive — their eye governs over the floor, and 2.5 is the number if it
                ever reads washed out on a monitor. */}
            <CoupleNames
              layout="line"
              names={wishes.coupleNames}
              strokeUnits={2.2}
            />
            {/* Lever 2's alternate, hidden by `app/couple-names.css`. */}
            <span data-names-alt>
              {wishesNames ? (
                <>
                  <span>{wishesNames[0]}</span>
                  <span className="type-heading-script__joiner">{" & "}</span>
                  <span>{wishesNames[1]}</span>
                </>
              ) : (
                wishes.coupleNames
              )}
            </span>
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
