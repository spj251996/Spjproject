import { InviteSection } from "@/app/_composition/sections";

/* The invitation, assembled incrementally — one section lands per Phase 4 pass, in the order the
   implementation plan fixes: invite, event info, family, timeline, wishes. The section list is
   mirrored in app/preview/page.dev.tsx, where the section under tweak is substituted.

   No thread-overlay mount. The thread is Phase 5 (IMPLEMENTATION-PLAN.md → Phase 5), and mounting
   the current fixed-position version would put uncoordinated decoration over every section being
   judged. */

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      <InviteSection />
    </main>
  );
}
