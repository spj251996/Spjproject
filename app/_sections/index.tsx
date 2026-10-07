import { PageThread } from "@/components/thread/page-thread";
import { CelebrationsSection } from "./celebrations";
import { ContactSection } from "./contact";
import { EventInfoSection } from "./event-info";
import { FamilySection } from "./family";
import { InviteSection } from "./invite";
import { WishesSection } from "./wishes";

/* The ONE list of the page's sections. Both routes compose this, so a section added here reaches both
   and cannot reach only one -- which is the whole reason the sections left `app/page.tsx`.

   `thread` gates `PageThread` here rather than at the route, so a route cannot set the thread on the
   sections and forget the page-length one, or the reverse. The emitted DOM is unchanged: the thread
   stays the last child of `<main>`. */
export function Sections({ thread = false }: { thread?: boolean }) {
  return (
    <>
      <InviteSection />
      <EventInfoSection />
      <ContactSection />
      <FamilySection />
      <CelebrationsSection />
      <WishesSection thread={thread} />
      {thread ? <PageThread /> : null}
    </>
  );
}
