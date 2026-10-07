import { notFound } from "next/navigation";
import { Sections } from "@/app/_sections";

/* The thread is not on the published page (DESIGN.md -> Technical Conventions -> Variant Routes).
   This route is the owner's lab: the same six sections, composed from the same module, with the
   thread. Plan 2 adds `mount` and `stock`, which differ from `current` in card paint alone. */
const VARIANTS = ["current"] as const;

/* Next 16's docs list a dynamic route with `dynamicParams: true` -- the DEFAULT -- as unsupported
   under `output: "export"`, so the set below is the whole set and an unlisted variant is a 404
   rather than something prerendered at request time. */
export const dynamicParams = false;

export function generateStaticParams() {
  return VARIANTS.map((variant) => ({ variant }));
}

export default async function ThreadLabPage({
  params,
}: {
  params: Promise<{ variant: string }>;
}) {
  const { variant } = await params;
  /* Belt and braces beside the static params, the way app/design-system/page.dev.tsx guards its own
     route: an unknown variant is a 404, never a half-built page. */
  if (!VARIANTS.includes(variant as (typeof VARIANTS)[number])) {
    notFound();
  }

  return (
    <main className="relative flex flex-1 flex-col overflow-y-clip">
      <Sections thread />
    </main>
  );
}
