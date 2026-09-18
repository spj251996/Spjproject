import { notFound } from "next/navigation";
import { DemoViewOnly } from "@/app/design-system/_kit";
import { BackgroundSections } from "@/app/design-system/_sections/background";
import { ComponentsSections } from "@/app/design-system/_sections/components";
import { DomainSections } from "@/app/design-system/_sections/domain";
import { FoundationsSections } from "@/app/design-system/_sections/foundations";
import { TechnicalSections } from "@/app/design-system/_sections/technical";

/* Belt and braces beside the `.dev.tsx` page extension, which is what keeps this route out of the
   production export. */
export default function DesignSystemPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return (
    <main className="mx-auto flex max-w-content flex-col gap-space-3xl px-space-md py-space-3xl">
      <header className="flex flex-col gap-space-2xs">
        <h1 className="type-heading-xl text-ink">Design System</h1>
        <p className="type-body text-ink">
          The visual parts of DESIGN.md, rendered with the design system they
          describe. Rules with nothing to render stay in the doc.
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
