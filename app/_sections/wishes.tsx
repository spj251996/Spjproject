import wishesStyles from "./wishes.module.css";
import "@/app/frames/wishes.css";
import { wishesFit } from "@/app/wishes-fit";
import { Botanical } from "@/components/background/botanical";
import { SECTION_PLACEMENT } from "@/components/background/botanical-placement";
import { MountedSheet } from "@/components/layout/mounted-sheet";
import { CardThread } from "@/components/thread/page-thread";
import { CoupleNames } from "@/components/ui/couple-names";
import { SprigOrnament } from "@/components/ui/sprig-ornament";
import { wishes } from "@/content";

/* The page's close. The illustration's size and bleed
   distance are settled in DESIGN.md → Wishes; it takes no crop, mask or edge fade of its own. The
   illustration is static and takes no entrance. */
export function WishesSection({ thread = false }: { thread?: boolean }) {
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
          <p className="type-eyebrow">
            <SprigOrnament>A life in love</SprigOrnament>
          </p>

          {/* This gap and the two below halve at phone, with `.figureCol`'s in `wishes.module.css`
              — the fourth of the same four, where the reason is written. */}
          <div className="mt-space-sm md:mt-space-lg [@media(64rem<=width<100rem)_and_(orientation:landscape)]:mt-space-md [@media(width>=100rem)_and_(orientation:landscape)]:mt-space-lg flex w-full flex-col items-center text-center">
            {/* Two passages, one per device class, swapped at `{breakpoints.lg}` exactly as the
                invite's are — see `InvitePassage` for why each pair is `contents` or `none`. */}
            {[
              {
                show: "contents lg:hidden",
                text: wishes.handheldPassage,
                cite: wishes.handheldPassageAttribution,
              },
              {
                show: "hidden lg:contents",
                text: wishes.passage,
                cite: wishes.passageAttribution,
              },
            ].map(({ show, text, cite }) => (
              <div className={show} key={cite}>
                <p className="type-body text-pretty">{text}</p>
                {/* The dash is chrome, not content — the citation itself is the reference alone,
                    the same treatment the invite's citation gets. */}
                <p className="type-caption-italic text-ink-muted mt-space-xs [@media(64rem<=width<100rem)_and_(orientation:landscape)]:mt-space-sm [@media(width>=100rem)_and_(orientation:landscape)]:mt-space-md">
                  {`— ${cite}`}
                </p>
              </div>
            ))}
          </div>

          <div className={wishesStyles.figureCol}>
            <div aria-hidden className={wishesStyles.figure}>
              {/* A lazy <img> rather than a CSS background: a background is fetched at first paint
                  wherever it sits, so every guest downloaded the drawing before reaching Wishes.
                  `<picture>` keeps the AVIF-first choice `image-set` made. The span is the
                  portraits' save cover, since an <img> offers "Save image" where a background
                  never did; it takes its pointer events back from `.figure`, which sets none. */}
              <picture>
                <source
                  srcSet="/couple/couple-1x.avif 1x, /couple/couple-2x.avif 2x"
                  type="image/avif"
                />
                <source
                  srcSet="/couple/couple-1x.webp 1x, /couple/couple-2x.webp 2x"
                  type="image/webp"
                />
                <img
                  alt=""
                  className="block size-full object-contain"
                  decoding="async"
                  loading="lazy"
                  src="/couple/couple-1x.webp"
                />
              </picture>
              <span
                aria-hidden="true"
                className="pointer-events-auto absolute inset-0"
              />
            </div>
          </div>
          {/* Wishes' own stretch of the thread (lab only), mounted inside the card rather than drawn
              by the page's trunk: the card's `mounted-sheet-frame__box` is a stacking context at
              `{z.content}` and the trunk is at `{z.thread}`, so a trunk-level stretch would paint
              over Wishes' type. Its containing block is that same `__box`. It mounts after the
              figure and before the names, so by document order it paints over the illustration
              and, at `tall`, over the type above it. */}
          {thread ? <CardThread /> : null}

          {/* The same drawn names on ONE line — one source, two layouts, placement arithmetic
              rather than a second trace. The paragraph takes `--text-heading-script` as its font
              size and nothing else: it is the `em` the asset's width resolves against, so the signature keeps the size it
              ships at today (260.8px at 56px, 335.2 at 72, 298 at 64 — 4.656em at every one). */}
          <p className="text-(length:--text-heading-script) mt-space-sm md:mt-space-lg [@media(64rem<=width<100rem)_and_(orientation:landscape)]:mt-space-xl [@media(width>=100rem)_and_(orientation:landscape)]:mt-space-2xl">
            {/* 3.2 units, picked by eye on a render: it lands this lockup's thinnest stroke at 0.90px
                on a phone, a hair UNDER the one-device-pixel floor the figures above derive; 3.8 is
                the number that reaches it. */}
            <CoupleNames
              layout="line"
              names={wishes.coupleNames}
              strokeUnits={3.2}
            />
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
