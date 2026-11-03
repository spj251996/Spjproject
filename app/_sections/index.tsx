import { PageThread } from "@/components/thread/page-thread";
import { CelebrationsSection } from "./celebrations";
import { EventInfoSection } from "./event-info";
import { FamilySection } from "./family";
import { InviteSection } from "./invite";
import { WishesSection } from "./wishes";

/* The ONE list of the page's sections. Every route composes this, so a section added here reaches all
   of them and cannot reach only one -- which is the whole reason the sections left `app/page.tsx`.

   `thread` gates `PageThread` here rather than at the route, so a route cannot set the thread on the
   sections and forget the page-length one, or the reverse. The emitted DOM is unchanged: the thread
   stays the last child of `<main>`.

   `credit` puts the designer's credit at Wishes' foot. Only the lab passes it until the couple agree
   (PROJECT.md → Content Model → DesignerCredit). */
export function Sections({
  thread = false,
  credit = false,
}: {
  thread?: boolean;
  credit?: boolean;
}) {
  return (
    <>
      <InviteSection />
      <EventInfoSection />
      <FamilySection />
      <CelebrationsSection />
      <WishesSection credit={credit} thread={thread} />
      {thread ? <PageThread /> : null}
    </>
  );
}
