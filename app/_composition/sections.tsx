import { Invite } from "@/components/invite/invite";
import { events, invite } from "@/content";

/* The page and the dev-only preview route both render these. Sharing the WIRING is the point: a
   stale prop on the preview would poison the design judgement the preview exists to support, and
   nothing detects that — it typechecks, lints and renders. The section LIST is deliberately not
   shared. It is five lines in the phase's fixed order, visible at a glance in both files, and a
   missing entry shows the moment you scroll.

   Content is looked up by id rather than by array position so inserting an event cannot silently
   repoint the invite at the wrong one. */

function eventById(id: string) {
  const found = events.find((event) => event.id === id);
  if (found === undefined) {
    throw new Error(`sections: no event with id "${id}" in content/events.ts`);
  }
  return found;
}

export function InviteSection() {
  return (
    <Invite
      betrothal={eventById("engagement")}
      coupleNames={invite.coupleNames}
      eyebrow={invite.eyebrow}
      wedding={eventById("wedding")}
    />
  );
}
