import { notFound } from "next/navigation";
import { Sections } from "@/app/_sections";
import type { FramePaint } from "@/components/layout/mounted-sheet-frame";

/* The thread is not on the published page (DESIGN.md -> Technical Conventions -> Variant Routes).
   This route is the owner's lab: the same six sections, composed from the same module, with the
   thread. The three variants differ in CARD PAINT alone.

   `current` passes NO paint, so every section keeps its own call-site value and the page is
   paint-identical to `/` -- which is the point of having it, since `/` is not uniform: an unpainted
   hero over five painted mounts, a combination neither other variant reproduces. `mount` and `stock`
   pass one paint to every section, the hero included.

   One map, not a list plus a switch: a variant that existed without a paint, or a paint without a
   route, would be a half-built page, and `generateStaticParams` and the guard below both read the map's
   own keys. */
const VARIANT_PAINT = {
  current: undefined,
  mount: "mount",
  stock: "stock",
} as const satisfies Record<string, FramePaint | undefined>;

type Variant = keyof typeof VARIANT_PAINT;

const VARIANTS = Object.keys(VARIANT_PAINT) as Variant[];

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
     route: an unknown variant is a 404, never a half-built page. It also narrows `variant` to the
     map's keys, so the paint lookup below cannot be undefined by accident -- only by design, which is
     what `current` is. */
  if (!VARIANTS.includes(variant as Variant)) {
    notFound();
  }

  return (
    <main className="relative flex flex-1 flex-col overflow-y-clip">
      <Sections paint={VARIANT_PAINT[variant as Variant]} thread />
    </main>
  );
}
