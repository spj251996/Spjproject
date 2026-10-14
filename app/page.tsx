import { Sections } from "@/app/_sections";
import { ScrollProgress } from "@/components/ui/scroll-progress";

/* The published invitation carries no thread -- the couple did not want it, and it lives at the lab
   route instead (DESIGN.md -> Technical Conventions -> Variant Routes). `relative` stays: it is what
   the lab route's absolutely positioned roots resolve against, and `<main>` is one shell for every
   route, which is what keeps the two pages geometrically identical.

   The scroll progress bar is `<main>`'s SIBLING, never its child: it is fixed and takes no space,
   and keeping it out of `<main>` keeps that block byte-identical to the lab route's and to every
   section fit. It is `/`'s scroll cue (PROJECT.md); the lab route keeps the thread's own. */
export default function Home() {
  return (
    <>
      <ScrollProgress />
      <main className="relative flex flex-1 flex-col overflow-y-clip">
        <Sections />
      </main>
    </>
  );
}
