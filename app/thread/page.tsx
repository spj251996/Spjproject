import { Sections } from "@/app/_sections";

/* The thread lab (DESIGN.md -> Technical Conventions -> Variant Routes): the published page's five sections plus the
   thread, so the thread is judged against exactly what `/` ships. `<main>` is the same shell as `/`'s, which keeps the
   two pages geometrically identical. */
export default function ThreadLabPage() {
  return (
    <main className="relative flex flex-1 flex-col overflow-y-clip">
      <Sections thread />
    </main>
  );
}
