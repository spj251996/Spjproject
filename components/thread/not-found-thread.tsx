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
          <path className={styles.notFoundInk} d={fallback.d} pathLength={1} />
        </svg>
      ))}
    </div>
  );
}
