"use client";

/* One ritual's preview strip, the cue that its set continues, and the action that opens the
   gallery. A frame opens the full-screen viewer on its photograph; the frame carrying `+N` and the
   action open the grid, since the cue stands for the whole set. Every frame carries the save cover:
   a transparent `aria-hidden` layer over a non-draggable image, so a right-click, a long-press or a
   drag lands on the cover while a tap still reaches the frame. Presentational, plus its own modal
   state: the height and the frame count are decided
   for the WHOLE section in `photo-fit`, so the section's height does not depend on which
   photographs a ritual happens to carry.

   Flat props rather than `Ritual`: a portable component may not name a domain type. */

import { useEffect, useState } from "react";
import { ButtonAction } from "./button-action";
import { ensureForwardGuard, GalleryModal } from "./gallery-modal";
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
  /** Display path to its viewer copy (bounded 2000×2000). Required, like `thumbs`. */
  fulls: Record<string, string>;
}

export function PhotoRow({
  photos,
  rowHeight,
  shown,
  aspects,
  aspectCap,
  title,
  thumbs,
  fulls,
}: PhotoRowProps) {
  /* `undefined` is closed, `null` the grid, a number the viewer on that photograph. */
  const [start, setStart] = useState<number | null | undefined>(undefined);
  useEffect(ensureForwardGuard, []);
  const remaining = photos.length - shown;
  const frames = withKeys(photos.slice(0, shown));

  return (
    /* Shrink-wrapped, not `w-full`, so the frames sit together rather than spreading across the block.
       `items-end`: the action sits below the strip, aligned to its end (owner, 2026-10-11). The rituals
       are left-aligned and their photographs gather to the block's right edge, so the action follows
       the strip rather than the text. The caller places the strip itself. */
    <div className="inline-flex flex-col items-end gap-space-3xs">
      <ul className="m-0 inline-flex list-none gap-space-2xs p-0">
        {frames.map(({ src, key }, index) => {
          const aspect = cappedAspect(src, aspects, aspectCap);
          const cue = index === frames.length - 1 && remaining > 0;
          return (
            <li
              className="relative shrink-0 overflow-hidden rounded-card"
              key={key}
              style={{ height: rowHeight, width: aspect * rowHeight }}
            >
              <button
                aria-label={
                  cue
                    ? `All ${photos.length} photos`
                    : `Photo ${index + 1} of ${photos.length}`
                }
                className="block size-full"
                onClick={() => setStart(cue ? null : index)}
                type="button"
              >
                <ImagePlaceholder height={1} width={aspect} />
                {/* A bare `<img>`: `next.config.ts` sets `images: { unoptimized: true }` because a
                    static export has no runtime optimiser, so `next/image` would buy only the
                    sizing this frame already gets from its placeholder. */}
                <img
                  alt=""
                  className="absolute inset-0 size-full object-cover"
                  draggable={false}
                  loading="lazy"
                  /* The thumbnail, never the display copy: a 1000px file in a 150px tile is about
                     250KB where 50 was budgeted, and the difference is invisible on screen. The
                     fallback cannot normally be reached — the generator emits the two in pairs —
                     and exists so a lost pair degrades to a heavy image rather than a broken one. */
                  src={thumbs[src] ?? src}
                />
                {cue && (
                  /* The cue that the set continues. On the last frame rather than beside the row,
                     so it reads as "this strip is a window onto more" rather than as a caption. */
                  <span className="type-action absolute inset-0 flex items-center justify-center bg-shadow-warm/55 text-ink-inverse">
                    {`+${remaining}`}
                  </span>
                )}
                <span aria-hidden="true" className="absolute inset-0" />
              </button>
            </li>
          );
        })}
      </ul>
      <ButtonAction onClick={() => setStart(null)}>View photos</ButtonAction>
      {start !== undefined && (
        <GalleryModal
          fulls={fulls}
          images={photos}
          thumbs={thumbs}
          onClose={() => setStart(undefined)}
          start={start}
          title={title}
        />
      )}
    </div>
  );
}
