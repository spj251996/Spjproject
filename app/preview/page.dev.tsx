import { notFound } from "next/navigation";
import { InviteSection } from "@/app/_composition/sections";

/* Dev-only tweak surface for Phase 4. Carries every section confirmed so far, plus the one under
   tweak, so a section is judged while scrolling past its real neighbours rather than in isolation.

   Kept out of the production export by two independent gates, the same pair the design-system
   gallery uses: the `.dev.tsx` page extension is only treated as a page outside production
   (next.config.ts), and notFound() here means that even if the extension gate were lost the route
   would not be emitted. `notFound()` alone is not sufficient — it renders a 404 body at the path
   rather than omitting the route (work/lessons.md, 2026-09-08).

   Tweak variants live in app/preview/_tweaks/, stay uncommitted, and are deleted once the owner
   picks. Substitute the section under tweak here; leave every confirmed section reading from the
   shared wiring so the two pages cannot drift. */

export default function PreviewPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return (
    <main className="flex flex-1 flex-col">
      <InviteSection />
    </main>
  );
}
