import { notFound } from "next/navigation";
import { InviteSection } from "@/app/_composition/sections";

/* Dev-only tweak surface for Phase 4. Carries every section confirmed so far, plus the one under
   tweak, so a section is judged while scrolling past its real neighbours rather than in isolation.

   Kept out of the production export by the `.dev.tsx` page extension, which next.config.ts treats
   as a page only outside production. **That gate is what omits the route, and it is the only thing
   that does.** The notFound() below is not a second omission mechanism and must not be read as one:
   notFound() renders a 404 body AT the path rather than omitting it, so on its own it would still
   ship a file — work/lessons.md, 2026-09-08, where a route kept this way shipped at 6.7 KB with a
   revealing title. It earns its place as content safety: if the extension gate were ever lost, the
   stray file would carry a 404 rather than the real page.

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
