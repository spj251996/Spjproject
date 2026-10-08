import { Sections } from "@/app/_sections";

/* The published invitation carries no thread -- the couple did not want it, and it lives at the lab
   route instead (DESIGN.md -> Technical Conventions -> Variant Routes). `relative` stays: it is what
   the lab route's absolutely positioned roots resolve against, and `<main>` is one shell for every
   route, which is what keeps the two pages geometrically identical. */
export default function Home() {
  return (
    <main className="relative flex flex-1 flex-col overflow-y-clip">
      <Sections />
    </main>
  );
}
