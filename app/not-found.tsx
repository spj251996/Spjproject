import { notFoundFit } from "@/app/not-found-fit";
import {
  Botanical,
  SECTION_PLACEMENT,
} from "@/components/background/botanical";
import { MountedSheet } from "@/components/layout/mounted-sheet";
import { ButtonAction } from "@/components/ui/button-action";
import { SprigOrnament } from "@/components/ui/sprig-ornament";

/* The screen an unmatched path reaches. It takes the section frame so a wrong turn still reads as
   part of the invitation, and it carries botanical at the invite's own placement — it is a
   standalone single-screen composition like the invite, not a closing section, so it takes the
   invite's anchors rather than a section's gap-straddling ones. DESIGN.md → Not found.

   The heading is a sentence, not a phrase — the site's only one, since an error screen has to say
   what happened. It carries no body line beneath it for the same reason.

   Nothing redirects. A timed redirect is a time limit, and none of the exceptions in the site's
   conformance target cover a courtesy one — the guest leaves by the action.

   THIS SCREEN CARRIES NO THREAD, and that is deliberate (2026-10-07). It briefly carried a closed
   replay of the invite's route drawn on a timer, which could not work in the normalised 0-1 box it
   was drawn in: a `1.6px` stroke is read as 1.6 USER-SPACE units there, so the screen painted solid
   red, and fixing that moved the dash into screen space where it collapsed to a pixel. Drawing it
   properly needs the page thread's own measured machinery on a screen almost nobody reaches, so the
   thread was retired instead — DESIGN.md → Not found carries the full reasoning. If one is ever
   wanted back, it has to measure this section and draw in real pixels; a normalised box is what
   caused every one of those failures. */
export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col overflow-y-clip">
      <section className="relative" id="not-found">
        <Botanical fit={notFoundFit} pieces={SECTION_PLACEMENT["not-found"]} />
        <MountedSheet fit={notFoundFit}>
          <div
            className="flex w-full flex-col items-center text-center"
            data-not-found-stack
          >
            <p className="type-eyebrow">
              <SprigOrnament>A Small Detour</SprigOrnament>
            </p>
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
