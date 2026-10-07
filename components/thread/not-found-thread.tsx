import styles from "./thread.module.css";
import { sectionRouteFallback } from "./thread-fallback";

/* `not-found`'s own closed, timed thread — a SERVER component, needing no measurement at all. This
   screen has exactly one section, one card, nothing to scroll and no neighbour to hand the thread
   on to (`app/not-found.tsx`'s own header comment), so it needs none of `PageThread`'s DOM
   measurement machinery: the authored route, stretched into the card's own box by the browser's
   ordinary `preserveAspectRatio="none"` scaling, is the whole story — exactly the technique
   `PageThread`'s own static fallback already uses for the same reason (CSS alone can size a fixed
   drawing into a box; nothing here needs `getBoundingClientRect`).

   `sectionRouteFallback("invite")` (`page-thread.tsx`) is `not-found`'s own route: `authoredCard`/
   `sectionBox` already resolve `not-found` -> `invite` (`thread-authored-layout.ts`,
   `thread-boxes.ts`), so passing "invite" is what that resolution means in practice, and reusing
   the page's own identity-warp call means this can never disagree with what the page itself thinks
   `invite`'s authored geometry is. This is deliberately NOT the same shape as `PageThread`'s
   multi-section stitching: there is no neighbouring section to snap a boundary onto here, so the
   route's two ends are exactly the authored curve's own literal endpoints — already what a "free
   end" is in this project's newer thread model (`page-thread.tsx`'s own header: "invite's free
   start to wishes' exit", no separate stub construction). */

export function NotFoundThread() {
  const fallbacks = sectionRouteFallback("invite");

  return (
    <div aria-hidden="true" className={styles.notFoundRoot}>
      <style>
        {fallbacks
          .map(
            (fallback) =>
              `[data-notfound-band="${fallback.band}"] { display: none; } @media ${fallback.media} { [data-notfound-band="${fallback.band}"] { display: block; } }`,
          )
          .join("\n")}
      </style>
      {fallbacks.map((fallback) => (
        <svg
          className={styles.notFoundSvg}
          data-notfound-band={fallback.band}
          data-thread-svg="true"
          key={fallback.band}
          preserveAspectRatio="none"
          role="presentation"
          viewBox="0 0 1 1"
        >
          <path
            className={styles.notFoundInk}
            d={fallback.d}
            pathLength={1}
            /* The route's `d` is normalised into a 0-1 square (`thread-fallback.ts`), and this
               `viewBox` stretches that square over the whole section. Without this, the stroke's
               `1.6px` is read as 1.6 USER-SPACE units -- 1.6x the section's own width and height --
               and the screen paints a solid red rectangle rather than a thread. `page-thread.tsx`'s
               no-JS fallback carries the same attribute for the same reason and records the same
               failure; this path is the other half of that pair and shipped without it.

               It also makes `pathLength` INERT, and the dash with it: the whole stroke pipeline
               then resolves in SCREEN space, so `thread.module.css`'s `stroke-dasharray: 1.02`
               becomes a 1.02-PIXEL dash rather than the path's whole length, and the timed draw
               advances by about one pixel. Measured, not inferred -- a `5000` dash renders
               identically to no dash at all. The draw is therefore still broken here, separately
               from the width, and is tracked in `tasks.md`; it needs the screen length, which only
               a measured client can supply. Do not "fix" it by deleting this attribute. */
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      ))}
    </div>
  );
}
