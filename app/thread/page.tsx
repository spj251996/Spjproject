import { Sections } from "@/app/_sections";

/* The thread lab (DESIGN.md -> Technical Conventions -> Variant Routes): the published page's own five sections, in
   their own card paint, plus the thread -- so the thread is judged against exactly what `/` ships. One static route
   since 2026-10-14; the mount- and stock-painted variants were retired with their paints. `<main>` is the same shell
   as `/`'s, which is what keeps the two pages geometrically identical. */
export default function ThreadLabPage() {
  return (
    <main className="relative flex flex-1 flex-col overflow-y-clip">
      <Sections thread />
    </main>
  );
}
