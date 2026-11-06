import "@/app/_frame/sheets/not-found.css";
import { notFoundFit } from "@/app/_frame/not-found-fit";
import { Botanical } from "@/components/background/botanical";
import { SECTION_PLACEMENT } from "@/components/background/botanical-placement";
import { MountedSheet } from "@/components/layout/mounted-sheet";
import { ButtonAction } from "@/components/ui/button-action";
import { DesignerCredit } from "@/components/ui/designer-credit";
import { SprigOrnament } from "@/components/ui/sprig-ornament";

/* The screen an unmatched path reaches. It takes the section frame so a wrong turn still reads as
   part of the invitation, and it carries botanical at the invite's own placement — it is a
   standalone single-screen composition like the invite, not a closing section, so it takes the
   invite's anchors rather than a section's gap-straddling ones. DESIGN.md → Not found.

   The heading is a sentence, not a phrase — the site's only one, since an error screen has to say
   what happened. It carries no body line beneath it for the same reason.

   Nothing redirects. A timed redirect is a time limit, and none of the exceptions in the site's
   conformance target cover a courtesy one — the guest leaves by the action.

   This screen carries no thread; DESIGN.md → Not found has the reasoning. */
export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col overflow-y-clip">
      <section className="relative" id="not-found">
        <Botanical fit={notFoundFit} pieces={SECTION_PLACEMENT["not-found"]} />
        <MountedSheet fit={notFoundFit}>
          {/* Three tracks: the empty first mirrors the credit's last, so the eyebrow, heading and
              action stay centred in the card while the sign-off sits at its foot, in flow, where a
              short phone cannot put it over the action (DESIGN.md → Not found). */}
          <div
            className="grid w-full grow grid-rows-[1fr_auto_1fr] justify-items-center text-center"
            data-not-found-stack
          >
            <div className="row-start-2 flex flex-col items-center">
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
            <div className="row-start-3 self-end mt-space-2xl">
              <DesignerCredit layout="signoff" />
            </div>
          </div>
        </MountedSheet>
      </section>
    </main>
  );
}
