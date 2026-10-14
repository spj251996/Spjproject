import Home from "@/app/page";
import { LeverPanel } from "./_panel";
import "./preview.css";

/* THE COUPLE'S REVIEW ROUTE — `[retire]`, deleted before merge.
   DESIGN.md → Technical Conventions → Variant Routes.

   AN ORDINARY ROUTE, NOT `.dev.tsx`: `next.config.ts` drops that extension from
   `pageExtensions` in production, and this route has to SHIP so the couple can open it on a
   Vercel preview from their own handsets. `robots.txt` already carries a wildcard `Disallow: /`
   and the site has no sitemap, and `vercel.json` sends `X-Robots-Tag: noindex, nofollow` on every
   path, so it is unlisted the moment it ships and needs no crawler work of its own.

   It renders the PUBLISHED PAGE rather than re-composing `Sections`, which is a deliberate
   departure from the spec's letter in favour of its intent: a second composition is a second copy
   of `<main>`'s class string and of the section order, and it drifts. Rendering `app/page.tsx`
   makes the geometry invariant hold by construction — at shipped, this route's `<main>` is the
   same markup `/` emits, which Task 12 asserts by extracting both.

   The panel is a SIBLING, never a wrapper: a wrapping client boundary can establish a stacking
   context, and a stacking context on any ancestor of a `.botanical-piece` isolates
   `mix-blend-mode: multiply` with no error and every gate green. */
export default function Preview() {
  return (
    <>
      <Home />
      <LeverPanel />
    </>
  );
}
