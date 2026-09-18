import {
  CelebrationsSection,
  EventInfoSection,
  FamilySection,
  InviteSection,
  WishesSection,
} from "@/app/_composition/sections";

/* The section list is mirrored in app/preview/page.dev.tsx. */

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      <InviteSection />
      <EventInfoSection />
      <FamilySection />
      <CelebrationsSection />
      <WishesSection />
    </main>
  );
}
