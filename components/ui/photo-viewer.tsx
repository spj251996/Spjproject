"use client";

/* One ritual photograph, full screen — the layer a strip frame or a grid tile opens. Presentational
   plus its own load-failure state; the layer logic and the history live in `gallery-modal`.

   The viewer copy (bounded 2000×2000) is the only file fetched here, so only the photograph on
   screen costs its bytes. A failed copy reads as a message rather than vanishing — here it is the
   only thing on screen, so hiding it would leave a guest looking at nothing.

   The image fills its stage with `object-contain` rather than sizing itself against the viewport:
   the stage is whatever the header leaves, so no height has to be restated here, and the save cover
   over it covers the letterbox too. Previous / next follow the cover in the DOM so they paint above
   it and stay clickable. */

import { useState } from "react";

interface PhotoViewerPanelProps {
  title: string;
  titleId?: string;
  src: string;
  index: number;
  count: number;
  onClose?: () => void;
  onShowGrid?: () => void;
  onStep?: (delta: number) => void;
}

const CONTROL =
  "type-action inline-flex min-h-(--touch-target) min-w-(--touch-target) shrink-0 items-center justify-center rounded-card text-ink-inverse";

export function PhotoViewerPanel({
  title,
  titleId,
  src,
  index,
  count,
  onClose,
  onShowGrid,
  onStep,
}: PhotoViewerPanelProps) {
  /* Keyed by the source so stepping to the next photograph clears a previous failure. */
  const [failed, setFailed] = useState<string | null>(null);
  return (
    <div className="absolute inset-0 flex flex-col gap-space-md bg-shadow-warm/92 p-space-md [--focus-ring-color:var(--focus-ring-color-inverse)]">
      <header className="flex items-start justify-between gap-space-md">
        <h2 className="type-heading-sm text-ink-inverse" id={titleId}>
          {title}
        </h2>
        <p
          aria-live="polite"
          className="type-action inline-flex min-h-(--touch-target) shrink-0 items-center text-ink-inverse"
        >
          {index + 1} / {count}
        </p>
        <div className="flex shrink-0 gap-space-2xs">
          <button className={CONTROL} onClick={onShowGrid} type="button">
            All photos
          </button>
          <button className={CONTROL} onClick={onClose} type="button">
            Close
          </button>
        </div>
      </header>
      <div className="relative min-h-0 flex-1">
        {failed === src ? (
          <p className="type-body absolute inset-0 flex items-center justify-center text-ink-inverse">
            This photo couldn&apos;t load
          </p>
        ) : (
          <>
            <img
              alt=""
              className="absolute inset-0 size-full object-contain"
              draggable={false}
              key={src}
              onError={() => setFailed(src)}
              src={src}
            />
            <span aria-hidden="true" className="absolute inset-0" />
          </>
        )}
        {index > 0 && (
          <button
            aria-label="Previous photo"
            className={`${CONTROL} absolute top-1/2 left-0 -translate-y-1/2`}
            onClick={() => onStep?.(-1)}
            type="button"
          >
            ‹
          </button>
        )}
        {index < count - 1 && (
          <button
            aria-label="Next photo"
            className={`${CONTROL} absolute top-1/2 right-0 -translate-y-1/2`}
            onClick={() => onStep?.(1)}
            type="button"
          >
            ›
          </button>
        )}
      </div>
    </div>
  );
}
