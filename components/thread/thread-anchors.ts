"use client";

import { useEffect } from "react";

/* The three motifs that wrap real content — Flemy's portrait, Sebastian's, and the couple
   illustration — measured on the client and handed to CSS as two custom properties each.
   Everything else about the thread, the whole scrub included, stays in CSS; this moves a position
   and nothing more.

   WHY A SCRIPT AT ALL. The authored grid cell is a fraction of the section, and the content it is
   meant to wrap is not: a portrait moves with its column, its caption's wrap and the reader's text
   size. On those three the owner called a few percent off "a mistake rather than a placement".
   CSS anchor positioning would do this with no script and was rejected on support — no Firefox,
   recent in Safari — and this page goes to family on whatever phone they own. Baking the positions
   at build time was rejected too: it re-breaks on every content edit.

   FAIL SOFT IS THE WHOLE CONTRACT. Every property here is read through `var(..., <cell>)`, so the
   motif sits on its authored cell before this runs, if a selector matches nothing, if the script
   is blocked, and if scripting is off entirely. It is slightly off, never missing — which is why
   nothing below throws and nothing below waits.

   IT CANNOT RE-ENTER. The observer's callback writes custom properties on the thread ROOT, which is
   `position: absolute; inset: 0` and so takes its size from its containing block rather than from
   anything inside it. The properties are read only by the motifs, which are absolutely positioned
   and contribute no layout. The anchor elements are not descendants of the root, so a write cannot
   reach them either. Nothing the callback changes can change a size it observes.

   Re-observing inside the callback is deliberate and bounded: `observe` on an already-observed
   element is a no-op, and the anchor set is fixed and tiny, so an anchor that appears late is
   picked up in at most one extra pass. */

export type ThreadAnchor = { key: string; selector: string };

interface ThreadAnchorsProps {
  /* The thread's own scope class, so the measurement is relative to the same box the generated
     sheet resolves its percentages against. */
  scope: string;
  anchors: readonly ThreadAnchor[];
}

export function ThreadAnchors({ scope, anchors }: ThreadAnchorsProps) {
  useEffect(() => {
    if (anchors.length === 0) return;
    const roots = document.querySelectorAll<HTMLElement>(`.${scope}`);
    const observer = new ResizeObserver(() => measure());

    function measure() {
      /* One guard for the lot: a malformed selector makes `querySelector` throw, and an unset
         property is the designed fallback. */
      try {
        for (const root of roots) {
          const box = root.getBoundingClientRect();
          if (box.width === 0 || box.height === 0) continue;
          observer.observe(root);
          const within = root.closest("section") ?? document;
          for (const anchor of anchors) {
            const target = within.querySelector(anchor.selector);
            if (target === null) continue;
            const rect = target.getBoundingClientRect();
            root.style.setProperty(
              `--thread-anchor-${anchor.key}-x`,
              `${(rect.left + rect.width / 2 - box.left) / box.width}`,
            );
            root.style.setProperty(
              `--thread-anchor-${anchor.key}-y`,
              `${(rect.top + rect.height / 2 - box.top) / box.height}`,
            );
            observer.observe(target);
          }
        }
      } catch {
        /* nothing: the cells already hold the position */
      }
    }

    measure();
    /* A section is `100svh`, so its own box barely moves when text reflows — the load-bearing
       observation is of the anchor elements themselves, which the pass above registers. A font swap
       is the case no observer covers: it can move an anchor without resizing it, and a moved
       element reports nothing. */
    document.fonts.ready.then(measure, () => {});
    return () => observer.disconnect();
  }, [scope, anchors]);

  return null;
}
