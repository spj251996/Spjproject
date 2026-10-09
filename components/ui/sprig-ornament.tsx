import type { ReactElement, ReactNode } from "react";
import { SprigIcon } from "@/components/icons";

/* A pair of sprig marks either side of whatever it is given — DESIGN.md → Components → UI →
   `sprig-ornament`.

   It carries NO type role and NO colour. Both are deliberate: the call site keeps its own element
   and role, which is what lets this serve an eyebrow and the ritual's Malayalam alike — and the
   Malayalam must not take `.type-eyebrow`, whose 0.2em tracking breaks its conjuncts. A colour
   utility here would beat `.type-eyebrow`'s own gold, declared in `@layer components`. */

/* The mark's `size` is a DIAGONAL; the floor below which its lines grey out is 16px of RENDERED
   HEIGHT, and for this mark those are different numbers — its viewBox is not square. 23 is the
   diagonal that renders 16.04px tall, which is why `ornamental-divider` reaches the same floor with
   the same number in its tablet band. */
const FLOOR_DIAGONAL = 23;

export function SprigOrnament({
  children,
  size = FLOOR_DIAGONAL,
}: {
  children: ReactNode;
  size?: number;
}): ReactElement {
  return (
    <span
      className="inline-flex items-center justify-center gap-space-2xs"
      data-sprig-ornament
    >
      {/* BOTH MARKS FACE THE WAY `ornamental-divider`'s DOES — unmirrored (owner, 2026-10-09).
          The mark has one canonical orientation in this system, set by the divider, which renders
          it plain; mirroring the trailing one made the pair symmetrical at the cost of putting a
          sprig on the page that points the wrong way. A later symmetry pass is the thing to guard
          against here, so the absence of a flip is asserted rather than left to read as an
          oversight. */}
      <SprigIcon className="shrink-0" size={size} />
      {children}
      <SprigIcon className="shrink-0" size={size} />
    </span>
  );
}
