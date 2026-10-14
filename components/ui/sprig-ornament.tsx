import type { ReactElement, ReactNode } from "react";
import { SprigIcon } from "@/components/icons";

/* The section-head eyebrow's frame — DESIGN.md → Components → UI → `sprig-ornament`: two sprig
   marks mirrored OUTWARD, each pointing away from the words, between two hairline rules.

   It carries NO type role and NO colour: the call site keeps its own element and role, and a colour
   utility here would beat `.type-eyebrow`'s own gold, declared in `@layer components`. */

/* The mark's `size` is a DIAGONAL; the floor below which its lines grey out is 16px of RENDERED
   HEIGHT, and for this mark those are different numbers — its viewBox is not square. 23 is the
   diagonal that renders 16.04px tall, which is why `ornamental-divider` reaches the same floor with
   the same number in its tablet band. Exported because the ritual header's single sprig sits at the
   same floor. FIXED rather than a prop: the mark is deliberately flat across tiers. */
export const FLOOR_DIAGONAL = 23;

/* ONE FORM (owner, 2026-10-11, on `/preview` from six). Its plain pair served the ritual's
   Malayalam until the rituals' header line took one leading sprig instead, and left with it.

   OUTWARD MEANS THE LEADING MARK FLIPS AND THE TRAILING ONE DOES NOT. The mark as drawn points
   right — the way `ornamental-divider`'s does, which sets its canonical direction — so on the
   trailing side it already points away from the words. The rules are elements rather than
   pseudo-elements so the wrapper's `gap` spaces them like the marks, and `border-current` makes an
   eyebrow's rules its own gold without this component naming a colour.

   EACH RULE IS A BORDER, NOT A FILLED BOX (owner, 2026-10-11). A half-pixel box lands on a fractional
   device pixel and is rounded by where it sits on the page, so on a phone two eyebrows painted two
   different weights. A border width snaps to whole device pixels, so every eyebrow paints one. */
const RULE =
  "h-0 w-space-lg shrink-0 border-t-(length:--stroke-hairline) border-current";

export function SprigOrnament({
  children,
}: {
  children: ReactNode;
}): ReactElement {
  return (
    <span className="inline-flex items-center justify-center gap-space-2xs">
      <span aria-hidden className={RULE} />
      <SprigIcon className="shrink-0 -scale-x-100" size={FLOOR_DIAGONAL} />
      {children}
      <SprigIcon className="shrink-0" size={FLOOR_DIAGONAL} />
      <span aria-hidden className={RULE} />
    </span>
  );
}
