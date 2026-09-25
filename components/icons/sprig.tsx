import { IconBase } from "./icon-base";

/* References the one `<symbol>` in the root layout rather than carrying the path itself — see
   `sprig-symbol.tsx` for why. `IconBase`'s diagonal sizing is unaffected: it sets the `<svg>`'s own
   width and height, and the `<use>` fills that box exactly (proven on a render before this was
   built, because the invite's spacing floors are derived from this mark's rendered height).

   An OUTLINE, not a silhouette: each leaf is a closed contour with a hollow interior, so the line
   weight is fixed in the geometry and cannot be tuned per size. Below ~16px the lines fall under a
   pixel and the mark greys out — DESIGN.md → Foundations → Iconography states that floor. */

export function SprigIcon({
  size,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <IconBase className={className} size={size} viewBox="0 0 174.6 169.8">
      <use href="#sprig-mark" />
    </IconBase>
  );
}
