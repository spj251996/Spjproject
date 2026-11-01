import type { Metadata } from "next";
import { Sections } from "@/app/_sections";
import { ReviewPanel } from "@/components/thread/review-panel";
import { variantBootScript } from "@/components/thread/thread-variant";

/* The lab is unlinked, not protected: robots.txt stops the crawl, and this states the same intent to anything that
   fetches the page regardless. Set per page, as on `/`, so the not-found page keeps Next's one injected tag. */
export const metadata: Metadata = { robots: { index: false, follow: false } };

/* The thread lab (DESIGN.md -> Technical Conventions -> Variant Routes): the published page's five sections plus the
   thread, so the thread is judged against exactly what `/` ships. `<main>` is the same shell as `/`'s, which keeps the
   two pages geometrically identical. */
export default function ThreadLabPage() {
  /* The review panel and its boot script are TEMPORARY (`components/thread/thread-variant.ts`): the
     script applies a stored candidate before the thread measures, and the panel is a sibling of
     `<main>` so it can neither wrap nor reflow what it is judging. Both leave before the release build. */
  return (
    <>
      <script>{variantBootScript()}</script>
      <main className="relative flex flex-1 flex-col overflow-y-clip">
        <Sections thread />
      </main>
      <ReviewPanel />
    </>
  );
}
