"use client";

/* The client seam between the server-rendered section and the presentational `photo-row`: it
   measures the room a block has, reads the aspects, solves the fit, and hands `PhotoRow` the
   answer.

   ONE INSTANCE PER RITUAL THAT HAS PHOTOGRAPHS, AND EACH SOLVES THE WHOLE SECTION. That reads
   wasteful and is deliberate: `photoFit` must be solved across EVERY ritual's set or the height
   stops being a constant (see `photo-fit.ts`), and every block is the same share of the card, so
   every instance measures the same width and is given the same `sets`. Identical inputs give
   identical output, so the shared height is REPRODUCED rather than coordinated — no context, no
   lifted state, and nothing mounts at all while every ritual's `images` is empty, which is what
   ships today. */

import { useEffect, useRef, useState } from "react";
import { DEFAULT_ASPECT_CAP, photoFit } from "./photo-fit";
import { PhotoRow } from "./photo-row";
import { useAspects } from "./use-aspects";

const PREVIEW_CAP = 3;

interface PhotoStripProps {
  /** Every ritual's photographs, keyed by id — not just this one's. The fit needs all of them. */
  sets: Record<string, string[]>;
  /** Which of `sets` this strip renders. */
  id: string;
  /** Names the gallery for assistive technology. */
  title: string;
}

/* Both measured values come off the element that carries them, in one pass. The NOMINAL HEIGHT is
   read from CSS rather than passed in so the 1024px alternating threshold lives in exactly one
   place — `celebrations.module.css` — instead of being restated here as a `matchMedia` query that
   could drift from it. */
interface Room {
  available: number;
  nominalHeight: number;
}

const FALLBACK_HEIGHT = 120;

export function PhotoStrip({ sets, id, title }: PhotoStripProps) {
  const anchorRef = useRef<HTMLDivElement>(null);
  /* `available: 0` until the first layout pass, which `photoFit` treats as unsolved rather than
     dividing by — a loop bounded by a measured value is unbounded before the first measurement. */
  const [room, setRoom] = useState<Room>({
    available: 0,
    nominalHeight: FALLBACK_HEIGHT,
  });

  useEffect(() => {
    const element = anchorRef.current;
    if (element === null) {
      return;
    }
    const sync = () => {
      const declared = Number.parseFloat(
        getComputedStyle(element).getPropertyValue(
          "--celebrations-photo-height",
        ),
      );
      setRoom({
        available: element.getBoundingClientRect().width,
        nominalHeight:
          Number.isFinite(declared) && declared > 0
            ? declared
            : FALLBACK_HEIGHT,
      });
    };
    sync();
    /* A resize that crosses the breakpoint changes the block's width, so the same observer
       re-reads the height token without a second listener. */
    const observer = new ResizeObserver(sync);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  /* Only the previewable frames are decoded — the rest load when the gallery opens. */
  const aspects = useAspects(
    Object.values(sets).flatMap((photos) => photos.slice(0, PREVIEW_CAP)),
  );
  const fit = photoFit(
    sets,
    room.nominalHeight,
    room.available,
    aspects,
    DEFAULT_ASPECT_CAP,
  );
  const photos = sets[id] ?? [];

  return (
    /* Full width so the measurement is the block's room, not the strip's own shrink-wrapped
       width — which is what the fit is being asked to decide. */
    <div className="w-full" data-photo-ready={fit.ready} ref={anchorRef}>
      <PhotoRow
        aspectCap={DEFAULT_ASPECT_CAP}
        aspects={aspects}
        photos={photos}
        rowHeight={fit.rowHeight}
        shown={fit.shown[id] ?? Math.min(2, photos.length)}
        title={title}
      />
    </div>
  );
}
