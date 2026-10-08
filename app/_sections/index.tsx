import type { FramePaint } from "@/components/layout/mounted-sheet-frame";
import { PageThread } from "@/components/thread/page-thread";
import { CelebrationsSection } from "./celebrations";
import { ContactSection } from "./contact";
import { EventInfoSection } from "./event-info";
import { FamilySection } from "./family";
import { InviteSection } from "./invite";
import { WishesSection } from "./wishes";

/* The ONE list of the page's sections. Every route composes this, so a section added here reaches all
   of them and cannot reach only one -- which is the whole reason the sections left `app/page.tsx`.

   `paint`, when set, is passed to every section and WINS over its call site. Absent, each section keeps
   its own value -- which is what `/` needs, because `/` is not uniform: an unpainted hero over five
   painted mounts. That configuration lives in the call sites, so the prop is optional here rather than
   defaulted, and `/` and `/thread/current` both pass nothing and differ only in `thread`.

   `thread` gates `PageThread` here rather than at the route, so a route cannot set the thread on the
   sections and forget the page-length one, or the reverse. The emitted DOM is unchanged: the thread
   stays the last child of `<main>`. */
export function Sections({
  thread = false,
  paint,
}: {
  thread?: boolean;
  paint?: FramePaint;
}) {
  return (
    <>
      <InviteSection paint={paint} />
      <EventInfoSection paint={paint} />
      <ContactSection paint={paint} />
      <FamilySection paint={paint} />
      <CelebrationsSection paint={paint} />
      <WishesSection paint={paint} thread={thread} />
      {thread ? <PageThread /> : null}
    </>
  );
}
