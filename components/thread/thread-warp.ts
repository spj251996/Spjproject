/* Warps the owner's hand-drawn thread from the box it was AUTHORED against onto the box the
   browser actually laid out. Pure arithmetic — no DOM, no React — because Task 4's component reads
   real measurements and this module only needs to know how to map one box onto another; testing it
   needs no render at all.

   THE MODEL (owner decision, on measured evidence — `thread-and-motion.md`'s Task-11 review):
   x is anchored to the CARD, not the viewport. Across the `wide` band the viewport ranges roughly
   1024-2560px while the card only grows ~768-1200px, so a viewport-stretched thread drifts off the
   content it was drawn around (anisotropy 1.66 viewport-anchored against 1.00-1.38 card-anchored).
   y has no separate "card" concept — a section's height is its own measured height, full stop.

     x_page = cardLeft + (x_authored - authoredCardLeft) * (cardWidth / authoredCardWidth)
     y_page = sectionTop + y_authored * (sectionHeight / authoredSectionHeight)

   `from` is `AuthoredCard` (Task 1, `thread-authored-layout.ts`) rather than the generic
   `SectionBox` a first reading of the plan suggests: the formula needs `authoredCardLeft` and
   `authoredCardWidth`, and `AuthoredCard` is exactly the record Task 1 built to carry them —
   `SectionBox` (`thread-geometry.ts`) is only `{ width, height }` and cannot express a card offset
   at all. Task 1's own brief for this task says as much: "it is the `from` side of your warp". */

import type { AuthoredCard } from "./thread-authored-layout.ts";
import type { SectionBox } from "./thread-geometry.ts";
import type { Placement } from "./thread-paths.ts";

export type MeasuredSection = {
  top: number;
  height: number;
  cardLeft: number;
  cardWidth: number;
};

/* A DOMRect-shaped anchor, in the same page-absolute pixel space as `MeasuredSection` — the caller
   (Task 4) hands this in from `getBoundingClientRect()` on a real portrait/illustration element. */
export type Rect = { left: number; top: number; width: number; height: number };

type Point = { x: number; y: number };

function warpPoint(
  point: Point,
  from: AuthoredCard,
  to: MeasuredSection,
): Point {
  const scaleX = to.cardWidth / from.cardWidth;
  const scaleY = to.height / from.sectionHeight;
  return {
    x: to.cardLeft + (point.x - from.cardLeft) * scaleX,
    y: to.top + point.y * scaleY,
  };
}

/* A cubic's anchor and control points transform the same way under a per-axis affine map — each
   axis is scaled and offset independently of the other, and a Bezier curve is evaluated as a linear
   combination of its control points, so warping the four points and re-drawing the curve through
   them reproduces the warped curve exactly. Nothing here is a fit or an approximation. */
const PATH_TOKEN = /[A-Za-z]|-?\d*\.?\d+(?:[eE][-+]?\d+)?/g;

function assertKnownCommand(command: string): asserts command is "M" | "C" {
  if (command !== "M" && command !== "C") {
    throw new Error(
      `thread-warp: cannot warp path command "${command}" exactly — only M and C are affine-exact ` +
        "under a per-axis warp. Extend this parser deliberately before authoring one of these.",
    );
  }
}

function formatNumber(value: number): string {
  /* Rounding to 6 decimals only strips float noise from the arithmetic above; it is well inside
     the 0.01px tolerance every consumer of this path already works to. */
  return String(Math.round(value * 1e6) / 1e6);
}

export function warpSection(
  d: string,
  from: AuthoredCard,
  to: MeasuredSection,
): string {
  const tokens = d.match(PATH_TOKEN) ?? [];
  let index = 0;

  function nextNumber(): number {
    const token = tokens[index++];
    const value = token === undefined ? NaN : Number(token);
    if (Number.isNaN(value)) {
      throw new Error(
        `thread-warp: malformed path data (token ${index}) in "${d}"`,
      );
    }
    return value;
  }

  function warpedPointTokens(): string[] {
    const warped = warpPoint({ x: nextNumber(), y: nextNumber() }, from, to);
    return [formatNumber(warped.x), formatNumber(warped.y)];
  }

  const out: string[] = [];
  let command = "";
  while (index < tokens.length) {
    const token = tokens[index];
    if (/^[A-Za-z]$/.test(token)) {
      command = token;
      index++;
    }
    assertKnownCommand(command);
    if (command === "M") {
      out.push("M", ...warpedPointTokens());
    } else {
      out.push(
        "C",
        ...warpedPointTokens(),
        ...warpedPointTokens(),
        ...warpedPointTokens(),
      );
    }
  }

  return out.join(" ");
}

/* A motif's own drawing must never shear, or its aspect stops holding across viewports — the exact
   property Task 1's spike measured at 0.0% spread for a uniform scale against 82.9% for either
   axis-independent alternative. So position warps per-axis like a path point, but SIZE resolves to
   ONE factor.

   THE BASIS IS THE BAND'S NOMINAL BOX, NEVER THE CARD OR THE SECTION HEIGHT — read directly off the
   code this warp replaces, because the wrong basis is invisible at the identity point and wrong
   everywhere else. `thread-css.ts:497` computes a motif's AUTHORED side as
     authoredSide = place.scale * Math.min(band.box.width, band.box.height)
   off `band.box` — the band's nominal viewport (`thread-bands.ts`), a constant for every section in
   that band, never a section's own card width or measured height. `thread-css.ts:1190-1199` then
   expresses that side as a fraction of the card, so a motif tracks the card at runtime:
     pageSide = authoredSide * (to.cardWidth / from.cardWidth)
   An earlier version of this function substituted `Math.min(from.cardWidth, from.sectionHeight)` —
   a per-SECTION quantity — for the authored unit. That silently swaps bands for cards: at `upright`
   (`thread-bands.ts`'s `UPRIGHT_BOX`, 820x1180) every section's authored card is 564
   (`thread-authored-layout.ts`'s `UPRIGHT_CARDS`), so the substitution undersized every motif in the
   band 31% at the identity point, where `from` and `to` are equal and nothing has reflowed yet.
   `bandBox` is threaded in and used explicitly, computed the same way as the source formula it
   mirrors, rather than assumed constant and derived from the card — that assumption is exactly the
   mistake being corrected. Task 3 bakes the resulting `scale` into the motif's own transform; this
   only resolves the number. */
function uniformScaleFactor(
  from: AuthoredCard,
  to: MeasuredSection,
  bandBox: SectionBox,
): number {
  const nominalUnit = Math.min(bandBox.width, bandBox.height);
  const authoredSide = nominalUnit; // `place.scale` multiplies this in the caller
  const pageSide = authoredSide * (to.cardWidth / from.cardWidth);
  /* `nominalUnit` cancels out of this ratio (`pageSide / authoredSide` reduces to
     `to.cardWidth / from.cardWidth`), so `bandBox` is not load-bearing for the RATIO returned here —
     do not "fix" the apparent unused-parameter smell by letting `from` and `to` resolve against
     different band boxes, which would silently reintroduce cross-band scaling. It is threaded
     through anyway so this derivation traces exactly against `thread-css.ts:497`/`:1190-1199`'s
     two-step formula (authored side, then page side), and so the caller has the same `bandBox` in
     scope to recover the motif's ABSOLUTE pixel side afterwards: `warped.scale * Math.min(bandBox.width,
     bandBox.height)`. */
  return pageSide / authoredSide;
}

export function warpPlacement(
  placement: Placement,
  from: AuthoredCard,
  to: MeasuredSection,
  bandBox: SectionBox,
  anchor?: Rect,
): Placement {
  const warped = warpPoint({ x: placement.x, y: placement.y }, from, to);
  /* An anchor is a stronger fact than the warp: it is the real portrait's or illustration's
     measured position, not an estimate of where the authored placement would land. It replaces the
     warped centre outright rather than nudging it — "additionally translates so the centre lands on
     the anchor's centre" means the anchor wins, full stop. */
  const centre =
    anchor === undefined
      ? warped
      : {
          x: anchor.left + anchor.width / 2,
          y: anchor.top + anchor.height / 2,
        };

  return {
    ...placement,
    x: centre.x,
    y: centre.y,
    scale: placement.scale * uniformScaleFactor(from, to, bandBox),
  };
}
