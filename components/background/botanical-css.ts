/* The botanical layer's per-tier geometry as a generated stylesheet — the same shape the frame's
   own `mountedSheetFrameCss` takes, and for the same reason: a hand-written stylesheet beside a
   hand-edited table is a second copy of a tuned value, and the two drift.

   Plain global class names, not CSS-module ones: a generated sheet cannot reference a hashed name.
   Every selector repeats the piece class so it carries two classes' specificity against
   `botanical.module.css`'s one, and wins whichever stylesheet the browser parses second.

   Nothing emitted here may isolate `mix-blend-mode` — no `z-index`, `isolation`, `contain`,
   `filter`, sub-1 `opacity` or `content-visibility`, and no transform other than `rotate` on the
   piece itself, which is the one a spike proved safe. `botanical.test.ts` asserts it. */
import { BREAKPOINT_REM } from "../layout/mounted-sheet-frame.ts";
import {
  type Anchor,
  type BotanicalPiece,
  type PieceTuning,
  TIERS,
  type Tier,
  TUNING,
} from "./botanical-tuning.ts";

export const PIECE_CLASS = "botanical-piece";

export function pieceClass(piece: BotanicalPiece): string {
  return `${PIECE_CLASS} ${PIECE_CLASS}--${piece}`;
}

function selector(piece: BotanicalPiece): string {
  return `.${PIECE_CLASS}.${PIECE_CLASS}--${piece}`;
}

/* Phone is the base rule and each wider tier a min-width query, emitted narrowest first: two
   open-ended queries both match on a wide window, so the later rule has to be the wider tier's.
   Ordering is the whole guarantee here — a bounded range per tier would say the same thing, at the
   cost of a second threshold per tier to keep in step with the frame's.

   **Laptop and desktop are landscape-only, and that is the point.** A tier is a width band, but
   what a section LOOKS like depends on its height too: a portrait window stacks its two cards into
   a section twice as tall, however wide it is. A 1024x1366 tablet held upright is one pixel into
   the laptop band and lays out nothing like a laptop — pieces tuned against a short side-by-side
   section arrive in a tall stacked one, sized small and stranded in a gap that does not exist at
   the window they were tuned at. So a portrait window keeps the tablet record, which is the one
   tuned against stacked cards, at every width. Nothing has to be tuned twice for it. */
const TIER_QUERY: Readonly<Record<Tier, string | null>> = {
  phone: null,
  tablet: `(width >= ${BREAKPOINT_REM.md}rem)`,
  laptop: `(width >= ${BREAKPOINT_REM.lg}rem) and (orientation: landscape)`,
  desktop: `(width >= ${BREAKPOINT_REM.xl}rem) and (orientation: landscape)`,
};

/* An `above-bottom-*` anchor spends 14% of the block extent before the piece begins, so its cap
   has to account for it — otherwise a piece tall enough to fill the section would start 14% down and run
   off the bottom, which DESIGN.md → Background → Botanical Edge forbids. */
const ABOVE_BOTTOM_OFFSET = "14%";
const ABOVE_BOTTOM_MAX_BLOCK = "86svh";
const DEFAULT_MAX_BLOCK = "100svh";

/* A zero keeps its unit: an `above-bottom-*` anchor subtracts this term inside a `calc()`, and
   `calc(14% - 0)` is invalid — the declaration would be dropped and the piece would fall back to
   `bottom: auto`, at no tier the emitter could warn about. */
function vw(value: number): string {
  return `${Math.round(value * 1000000) / 1000000}vw`;
}

/* One anchor-to-declarations mapping, holding one invariant: `+x` moves the piece right by exactly
   `x` vw and `+y` moves it down by exactly `y` vw, whatever the anchor. Two anchors need
   compensating for, and both were silently wrong before this mapping existed:

   - a piece anchored to the right or bottom edge is offset by an inset that grows the other way,
     so its nudge is negated;
   - a `mid-*` piece centres with `inset-block: 0` and `margin-block: auto`, which splits any block
     inset evenly between the two sides — so a naive `inset-block: y 0` moves it by half of `y`.
     The doubling below is what makes the slider mean what it says.

   Every block re-states every inset, because the anchor is per tier: a `top` left over from a
   narrower tier would otherwise fight the `bottom` a wider one sets. */
function anchorDeclarations(anchor: Anchor, x: number, y: number): string {
  switch (anchor) {
    case "top-left":
      return `top: ${vw(y)}; left: ${vw(x)};`;
    case "top-right":
      return `top: ${vw(y)}; right: ${vw(-x)};`;
    case "bottom-left":
      return `bottom: ${vw(-y)}; left: ${vw(x)};`;
    case "bottom-right":
      return `bottom: ${vw(-y)}; right: ${vw(-x)};`;
    case "above-bottom-right":
      return `bottom: calc(${ABOVE_BOTTOM_OFFSET} - ${vw(y)}); right: ${vw(-x)}; --piece-max-block: ${ABOVE_BOTTOM_MAX_BLOCK};`;
    case "above-bottom-left":
      return `bottom: calc(${ABOVE_BOTTOM_OFFSET} - ${vw(y)}); left: ${vw(x)}; --piece-max-block: ${ABOVE_BOTTOM_MAX_BLOCK};`;
    case "middle-left":
      return `inset-block: ${vw(2 * y)} 0; margin-block: auto; left: ${vw(x)};`;
    case "middle-right":
      return `inset-block: ${vw(2 * y)} 0; margin-block: auto; right: ${vw(-x)};`;
  }
}

/* `none`, not `0deg`, at rest: a zero rotation is still a transform, which gives the piece its own
   stacking context and hands it to the compositor — harmless to the blend, but it resamples the
   drawing and moves pixels under a piece nobody turned. A tier still states the value, so a
   rotation tuned at one tier cannot leak into another. */
function rotationDeclaration(rotation: number): string {
  return rotation === 0 ? "rotate: none;" : `rotate: ${rotation}deg;`;
}

/* The mirror, on the element rather than baked into the art — DESIGN.md → Background → Botanical
   Edge. An element's own transform gives it its own stacking context, which isolates its CHILDREN
   — a bloom has none — and not its own blending with the ground behind it, so one drawing serves
   both edges and no piece needs a mirrored twin on disk. `none` at rest, never `1 1`, so an
   unmirrored piece is not handed to the compositor for nothing. */
function flipDeclaration(flip: true | undefined): string {
  return flip === true ? "scale: -1 1;" : "scale: none;";
}

/* Delivery is a CSS background, not an `<img>`: a non-matching media query fetches nothing, so a
   phone never learns the desktop file exists, and the layer needs no alt text — it is decorative by
   construction. The ladder lives here rather than in the stylesheet because only this module knows
   which tiers a piece is dropped at, and a dropped tier has no file to name. */
function imageDeclaration(piece: BotanicalPiece, tier: Tier): string {
  return (
    `background-image: image-set(` +
    `url("/botanical/${piece}-${tier}.avif") type("image/avif") 1x, ` +
    `url("/botanical/${piece}-${tier}.webp") type("image/webp") 1x);`
  );
}

function pieceRule(
  piece: BotanicalPiece,
  tuning: PieceTuning,
  at = selector(piece),
  tier?: Tier,
): string {
  if (tuning.drop === true) {
    return `${at} { display: none; }`;
  }
  const declarations = [
    "display: block;",
    "inset: auto;",
    "margin-block: 0;",
    `--piece-max-block: ${DEFAULT_MAX_BLOCK};`,
    anchorDeclarations(tuning.anchor, tuning.x, tuning.y),
    `--piece-size: ${vw(tuning.size)};`,
    rotationDeclaration(tuning.rotation),
    flipDeclaration(tuning.flip),
    ...(tier === undefined ? [] : [imageDeclaration(piece, tier)]),
  ].join(" ");
  return `${at} { ${declarations} }`;
}

/* One piece's rule for the dev tuning panel, at a selector one class heavier than the sheet's so it
   wins over every tier block whatever the window — the panel edits the tier it is in, and the
   mapping from a record to declarations stays here rather than being restated there. */
export function pieceOverrideCss(
  piece: BotanicalPiece,
  tuning: PieceTuning,
): string {
  return pieceRule(
    piece,
    tuning,
    `${selector(piece)}.${PIECE_CLASS}--${piece}`,
  );
}

/* Only the pieces the section carries, so five sections' stylesheets stay small and none restates
   another's rows. */
export function botanicalCss(pieces: readonly BotanicalPiece[]): string {
  return TIERS.map((tier) => {
    const rules = pieces
      .map((piece) => pieceRule(piece, TUNING[piece][tier], undefined, tier))
      .join("\n");
    const query = TIER_QUERY[tier];
    return query === null ? rules : `@media ${query} {\n${rules}\n}`;
  }).join("\n");
}
