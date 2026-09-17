import {
  EventInfoSection,
  FamilySection,
  InviteSection,
} from "@/app/_composition/sections";

/* The section list is mirrored in app/preview/page.dev.tsx. */

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      <InviteSection />
      <EventInfoSection />
      <FamilySection />
    </main>
  );
}
