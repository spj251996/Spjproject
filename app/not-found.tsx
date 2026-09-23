import { notFoundFit } from "@/app/not-found-fit";
import {
  Botanical,
  SECTION_PLACEMENT,
} from "@/components/background/botanical";
import { MountedSheet } from "@/components/layout/mounted-sheet";
import { ButtonAction } from "@/components/ui/button-action";

/* The screen an unmatched path reaches. It takes the section frame so a wrong turn still reads as
   part of the invitation, and it carries botanical at the invite's own placement — it is a
   standalone single-screen composition like the invite, not a closing section, so it takes the
   invite's anchors rather than a section's gap-straddling ones. DESIGN.md → Not found.

   The heading is a sentence, not a phrase — the site's only one, since an error screen has to say
   what happened. It carries no body line beneath it for the same reason.

   Nothing redirects. A timed redirect is a time limit, and none of the exceptions in the site's
   conformance target cover a courtesy one — the guest leaves by the action. */
export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col">
      <section className="relative" id="not-found">
        <Botanical fit={notFoundFit} pieces={SECTION_PLACEMENT["not-found"]} />
        <MountedSheet fit={notFoundFit}>
          <div
            className="flex w-full flex-col items-center text-center"
            data-not-found-stack
          >
            <p className="type-eyebrow">A Small Detour</p>
            <h1 className="type-heading-xl text-ink-muted mt-space-2xs">
              This page isn&apos;t part of the invitation.
            </h1>
            <div className="mt-space-2xl">
              <ButtonAction href="/">Back to the Invitation</ButtonAction>
            </div>
          </div>
        </MountedSheet>
      </section>
    </main>
  );
}
