"use client";

/* THE PHASE 8 SEAM — the ONLY file that knows where aspect ratios come from.
   Today: the browser's own decode. When the image manifest lands (Phase 8, `Ritual.images`
   carries no dimensions today), replace this hook's body with a manifest read and NOTHING
   else in the section changes.

   `new Image()` rather than reading rendered nodes: the widths decide WHAT to render, so
   measuring rendered tiles would be circular. */

import { useEffect, useState } from "react";

export function useAspects(sources: string[]): Record<string, number> {
  /* The sources are joined into one string so the effect depends on their CONTENT rather than on
     the array's identity, which a parent re-render replaces every time. */
  const key = Array.from(new Set(sources)).sort().join("|");
  const [aspects, setAspects] = useState<Record<string, number>>({});

  useEffect(() => {
    let live = true;
    const unique = key.split("|").filter(Boolean);
    if (unique.length === 0) {
      return;
    }
    Promise.all(
      unique.map(
        (src) =>
          new Promise<[string, number]>((resolve) => {
            const image = new Image();
            image.onload = () =>
              resolve([
                src,
                image.naturalHeight > 0
                  ? image.naturalWidth / image.naturalHeight
                  : 1,
              ]);
            /* A failed load still resolves, at 1, so one broken file cannot stall the section. */
            image.onerror = () => resolve([src, 1]);
            image.src = src;
          }),
      ),
    ).then((pairs) => {
      if (live) {
        setAspects(Object.fromEntries(pairs));
      }
    });
    return () => {
      live = false;
    };
  }, [key]);

  return aspects;
}
