"use client";

/* One ritual's preview strip, the cue that its set continues, and the action that opens the
   gallery. Presentational, plus its own modal state: the height and the frame count are decided
   for the WHOLE section in `photo-fit`, so the section's height does not depend on which
   photographs a ritual happens to carry.

   Flat props rather than `Ritual`: a portable component may not name a domain type. */

import { useState } from "react";
import { ButtonAction } from "./button-action";
import { GalleryModal } from "./gallery-modal";
import { ImagePlaceholder } from "./image-placeholder";
import { cappedAspect } from "./photo-fit";

/* The same URL can appear twice, so keys are the URL plus its occurrence count rather than the
   array index, which would change identity whenever the set is reordered. */
function withKeys(photos: string[]) {
  const seen = new Map<string, number>();
  return photos.map((src) => {
    const occurrence = seen.get(src) ?? 0;
    seen.set(src, occurrence + 1);
    return { src, key: occurrence === 0 ? src : `${src}#${occurrence}` };
  });
}

interface PhotoRowProps {
  photos: string[];
  /** The one height solved for the whole section by `photoFit`. */
  rowHeight: number;
  /** How many frames this ritual shows, from `photoFit`. */
  shown: number;
  aspects: Record<string, number>;
  /** Must be the value the fit was solved with, or the row overflows its block. */
  aspectCap: number;
  /** Names the gallery for assistive technology; never rendered in the strip. */
  title: string;
  /** Display path to its 600px thumbnail. Required, not optional: an optional prop is how this
      project last shipped a frame generated at the wrong paint with tsc clean. */
  thumbs: Record<string, string>;
}

export function PhotoRow({
  photos,
  rowHeight,
  shown,
  aspects,
  aspectCap,
  title,
  thumbs,
}: PhotoRowProps) {
  const [open, setOpen] = useState(false);
  const remaining = photos.length - shown;
  const frames = withKeys(photos.slice(0, shown));

  return (
    /* Shrink-wrapped, not `w-full`, so the frames sit together rather than spreading across the block.
       `items-center`, not `items-end` — the action centres under its strip (owner, 2026-10-10), which
       OVERRIDES the recorded "action below the strip, aligned to its end". That rule was written for a
       ritual block whose text aligned to one side; the rituals centre now, and an end-aligned button
       under a centred column reads as the one thing that missed the memo. */
    <div className="inline-flex flex-col items-center gap-space-3xs">
      <ul className="m-0 inline-flex list-none gap-space-2xs p-0">
        {frames.map(({ src, key }, index) => {
          const aspect = cappedAspect(src, aspects, aspectCap);
          return (
            <li
              className="relative shrink-0 overflow-hidden rounded-card"
              key={key}
              style={{ height: rowHeight, width: aspect * rowHeight }}
            >
              <button
                className="block size-full"
                onClick={() => setOpen(true)}
                type="button"
              >
                <ImagePlaceholder height={1} width={aspect} />
                {/* A bare `<img>`: `next.config.ts` sets `images: { unoptimized: true }` because a
                    static export has no runtime optimiser, so `next/image` would buy only the
                    sizing this frame already gets from its placeholder. */}
                <img
                  alt=""
                  className="absolute inset-0 size-full object-cover"
                  loading="lazy"
                  /* The thumbnail, never the display copy: a 1000px file in a 150px tile is about
                     250KB where 50 was budgeted, and the difference is invisible on screen. The
                     fallback cannot normally be reached — the generator emits the two in pairs —
                     and exists so a lost pair degrades to a heavy image rather than a broken one. */
                  src={thumbs[src] ?? src}
                />
                {index === frames.length - 1 && remaining > 0 && (
                  /* The cue that the set continues. On the last frame rather than beside the row,
                     so it reads as "this strip is a window onto more" rather than as a caption. */
                  <span className="type-action absolute inset-0 flex items-center justify-center bg-shadow-warm/55 text-ink-inverse">
                    {`+${remaining}`}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      <ButtonAction onClick={() => setOpen(true)}>View photos</ButtonAction>
      {open && (
        <GalleryModal
          images={photos}
          onClose={() => setOpen(false)}
          title={title}
        />
      )}
    </div>
  );
}
