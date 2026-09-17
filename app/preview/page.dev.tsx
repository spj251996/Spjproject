import { notFound } from "next/navigation";
import {
  EventInfoSection,
  FamilySection,
  InviteSection,
} from "@/app/_composition/sections";

/* Dev-only: mirrors app/page.tsx's section list, with a section under review substituted here.

   The `.dev.tsx` extension gate in next.config.ts is the only thing that omits this route from the
   export. `notFound()` still emits a 404 body at the path, so it is a fallback if that gate is ever
   lost, not an omission. */

export default function PreviewPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return (
    <main className="flex flex-1 flex-col">
      <InviteSection />
      <EventInfoSection />
      <FamilySection />
    </main>
  );
}
