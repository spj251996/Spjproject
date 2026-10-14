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
import { ChevronIcon, CloseIcon, GridIcon } from "@/components/icons";
import { CONTROL_CIRCLE } from "./gallery-control";
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

/* The arrows sit on the stage's edges, centred on its height; the header's two controls sit in its
   row. All four are the same round control. */
const ARROW = `${CONTROL_CIRCLE} absolute top-1/2 -translate-y-1/2`;

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
          <button
            aria-label="All photos"
            className={CONTROL_CIRCLE}
            onClick={onShowGrid}
            type="button"
          >
            <GridIcon size={20} />
          </button>
          <button
            aria-label="Close"
            className={CONTROL_CIRCLE}
            onClick={onClose}
            type="button"
          >
            <CloseIcon size={20} />
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
