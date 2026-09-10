import { notFound } from "next/navigation";
import { DemoViewOnly } from "@/app/design-system/_kit";
import { BackgroundSections } from "@/app/design-system/_sections/background";
import { ComponentsSections } from "@/app/design-system/_sections/components";
import { DomainSections } from "@/app/design-system/_sections/domain";
import { FoundationsSections } from "@/app/design-system/_sections/foundations";
import { TechnicalSections } from "@/app/design-system/_sections/technical";

/* Production exclusion (env-gate, per stack-adapters.md → (e) — chosen because this project has no
   release-allowlist snapshot step): under `output: "export"`, this page rendering to notFound()
   during a production build keeps the route out of `out/` entirely. Lands before any section content
   exists so there is never a window where a build could ship the gallery. */
export default function DesignSystemPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return (
    /* Dogfoods the documented content cap (--container-content, 1200px) and the doc's own
       section-spacing band (space-3xl). No SectionProgressNav: the skill's page template mounts a
       live rail, but this project ships no such component and the gallery may not invent one. No
       theme selector either — there is no theme system (DESIGN.md → Overview → One scheme, no theme system). */
    <main className="mx-auto flex max-w-content flex-col gap-space-3xl px-space-md py-space-3xl">
      <header className="flex flex-col gap-space-2xs">
        <h1 className="type-heading-xl text-ink">Design System</h1>
        <p className="type-body text-ink">
          Every sub-section of DESIGN.md, rendered with the design system it
          documents.
        </p>
        <p className="type-body text-ink">
          Dev-only reference, excluded from the production build.
        </p>
      </header>

      <DemoViewOnly className="flex flex-col gap-space-3xl">
        <FoundationsSections />
        <BackgroundSections />
        <ComponentsSections />
        <DomainSections />
        <TechnicalSections />
      </DemoViewOnly>
    </main>
  );
}
