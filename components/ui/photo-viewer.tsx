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
import { ChevronIcon } from "@/components/icons";
import motion from "./gallery-motion.module.css";

interface PhotoViewerPanelProps {
  title: string;
  titleId?: string;
  src: string;
  index: number;
  count: number;
  onClose?: () => void;
  onShowGrid?: () => void;
  onStep?: (delta: number) => void;
  /** The side the photograph came from: 1 after Next, -1 after Previous, 0 when first shown. */
  direction?: 1 | -1 | 0;
  /** Play the one-time swipe nudge on this photograph. */
  hint?: boolean;
}

/* Hover thickens the label optically, as `button-action` does — a heavier cut would widen it. The
   `hover:` variant only applies on a device that can hover, and every transition is motion-gated. */
const CONTROL =
  "type-action inline-flex min-h-(--touch-target) min-w-(--touch-target) shrink-0 items-center justify-center rounded-card text-ink-inverse hover:[text-shadow:0.35px_0_0_currentColor,-0.35px_0_0_currentColor] active:opacity-80 motion-safe:transition-[text-shadow,opacity] motion-safe:duration-(--duration-fast) motion-safe:ease-settle";

/* 48px — past the touch-target floor — so the mark reads at a glance; the dark ground keeps it
   visible wherever the circle overlaps a photograph. */
const ARROW =
  "absolute top-1/2 inline-flex size-space-xl -translate-y-1/2 items-center justify-center rounded-full bg-scrim/60 text-ink-inverse hover:bg-ink-inverse/15 active:opacity-80 motion-safe:transition-[background-color,opacity] motion-safe:duration-(--duration-fast) motion-safe:ease-settle";

const SLIDE = {
  1: motion["slide-next"],
  [-1]: motion["slide-previous"],
  0: "",
} as const;

export function PhotoViewerPanel({
  title,
  titleId,
  src,
  index,
  count,
  onClose,
  onShowGrid,
  onStep,
  direction = 0,
  hint = false,
}: PhotoViewerPanelProps) {
  /* Keyed by the source so stepping to the next photograph clears a previous failure. */
  const [failed, setFailed] = useState<string | null>(null);
  return (
    <div className="absolute inset-0 flex flex-col gap-space-md bg-scrim/92 p-space-md [--focus-ring-color:var(--focus-ring-color-inverse)]">
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
              data-viewer-photo
              className={`absolute inset-0 size-full object-contain ${hint && direction === 0 ? motion.nudge : SLIDE[direction]}`}
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
            className={`${ARROW} left-0`}
            onClick={() => onStep?.(-1)}
            type="button"
          >
            <ChevronIcon flip size={28} />
          </button>
        )}
        {index < count - 1 && (
          <button
            aria-label="Next photo"
            className={`${ARROW} right-0`}
            onClick={() => onStep?.(1)}
            type="button"
          >
            <ChevronIcon size={28} />
          </button>
        )}
      </div>
    </div>
  );
}
