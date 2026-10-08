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
/* `contact` is off on the published page and on everywhere else, which is NOT a tidying choice.
   `contact` is a member of `THREAD_IDS`, and `page-thread.tsx`'s section measurement returns
   `undefined` when the section count does not equal it -- so a lab route rendering five sections would
   draw no thread at all, fail-soft, with nothing in the console. The lab routes exist to judge the
   thread. Contact leaves them in Phase 7's Half 3, together with its removal from the thread's own
   authored geometry; its files are in `scripts/retire-register.mjs` until Phase 9. */
export function Sections({
  thread = false,
  paint,
  contact = true,
}: {
  thread?: boolean;
  paint?: FramePaint;
  contact?: boolean;
}) {
  return (
    <>
      <InviteSection paint={paint} />
      <EventInfoSection paint={paint} />
      {contact ? <ContactSection paint={paint} /> : null}
      <FamilySection paint={paint} />
      <CelebrationsSection paint={paint} />
      <WishesSection paint={paint} thread={thread} />
      {thread ? <PageThread /> : null}
    </>
  );
}
