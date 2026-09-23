import { notFoundFit } from "@/app/not-found-fit";
import { MountedSheet } from "@/components/layout/mounted-sheet";
import { ButtonAction } from "@/components/ui/button-action";

/* The screen an unmatched path reaches. It takes the section frame so a wrong turn still reads as
   part of the invitation, and it carries no botanical: the pieces are placed per section of the
   scroll, and this is not one.

   Nothing redirects. A timed redirect is a time limit, and none of the exceptions in the site's
   conformance target cover a courtesy one — the guest leaves by the action. */
export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col">
      <section className="relative" id="not-found">
        <MountedSheet fit={notFoundFit}>
          <div
            className="flex w-full flex-col items-center text-center"
            data-not-found-stack
          >
            <p className="type-eyebrow">Oops</p>
            <h1 className="type-heading-xl text-ink-muted mt-space-2xs">
              A Wrong Turn
            </h1>
            <p className="type-body text-ink mt-space-sm">
              This page isn&apos;t part of the invitation.
            </p>
            <div className="mt-space-lg">
              <ButtonAction href="/">Open the invitation</ButtonAction>
            </div>
          </div>
        </MountedSheet>
      </section>
    </main>
  );
}
