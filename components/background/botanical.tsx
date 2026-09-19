import type { MeasuredFit } from "@/components/layout/mounted-sheet-frame";
import {
  frameScopeClass,
  tallScopeClass,
} from "@/components/layout/mounted-sheet-frame-css";
import styles from "./botanical.module.css";
import {
  MEADOW_NATURAL_HEIGHT,
  MEADOW_NATURAL_WIDTH,
  MEADOW_VISIBLE_FRACTION,
} from "./botanical-meadow";

export {
  MEADOW_NATURAL_HEIGHT,
  MEADOW_NATURAL_WIDTH,
  MEADOW_VISIBLE_FRACTION,
} from "./botanical-meadow";

/* Sparse wildflower elements at the screen edges — DESIGN.md → Botanical Edge. Full opacity,
   `mix-blend-mode: multiply` against the ivory ground, no `z-index` anywhere in this layer: the
   card's own frame (`mounted-sheet-frame__box`) carries the only explicit `z-index` in a framed
   section, so it always paints above a layer that has none — the section itself carries no
   z-index either (removed from `app/page.tsx`), which is what frees the blend from an isolating
   stacking context in the first place.

   Sizing reads `--ring-block`/`--ring-side`, the two custom properties `mounted-sheet-frame-css.ts`
   emits on the section's own frame-scope div (`.mounted-sheet-frame--<section>` /
   `.mounted-sheet-frame--tall-section`) — one source for the ring ladder, shared with the card's own
   padding. This component's wrapper carries that same class so it resolves those properties
   directly, since it cannot reach inside `MountedSheet`/`MountedPair` to become a literal DOM child
   of their own instance of that div. */

export type BotanicalPiece =
  | "falling-spray"
  | "hanging-bunch"
  | "corner-spray"
  | "horizontal-garland"
  | "side-spread-left"
  | "side-spread-right"
  | "sprig-cross-left"
  | "sprig-cross-right"
  | "tall-column-a"
  | "tall-column-b"
  | "meadow-band";

type RingBand = "block" | "side";

type Anchor =
  | "top-span"
  | "low-right"
  | "top-right"
  | "bottom-left"
  | "mid-left"
  | "mid-right"
  | "gap-left"
  | "gap-right"
  | "band-bottom";

/* Which pieces each section carries, and the anchor each sits on. This is the ONE place the
   assignment lives: `app/page.tsx` renders from it and the dev tuning panel reads it to group its
   controls. A second copy has twice drifted out of step with a swap and sent nudges along an axis
   the piece was no longer anchored on, which moves it nowhere and reads as a dead slider. */
export const SECTION_PLACEMENT = {
  invite: [
    { piece: "falling-spray", anchor: "top-span" },
    { piece: "corner-spray", anchor: "low-right" },
  ],
  "event-info": [
    { piece: "hanging-bunch", anchor: "top-right" },
    { piece: "horizontal-garland", anchor: "bottom-left" },
  ],
  family: [
    { piece: "side-spread-left", anchor: "mid-left" },
    { piece: "side-spread-right", anchor: "mid-right" },
  ],
  celebrations: [
    { piece: "tall-column-a", anchor: "mid-left" },
    { piece: "tall-column-b", anchor: "mid-right" },
  ],
  wishes: [
    { piece: "meadow-band", anchor: "band-bottom" },
    { piece: "sprig-cross-left", anchor: "gap-left" },
    { piece: "sprig-cross-right", anchor: "gap-right" },
  ],
} as const satisfies Readonly<Record<string, readonly BotanicalPlacement[]>>;

export interface BotanicalPlacement {
  piece: BotanicalPiece;
  anchor: Anchor;
}

/* Exported, along with the three tables below, so the uncommitted `/preview` tuning panel
   (`app/preview/`) can read the live baseline rather than duplicating it as a second copy that
   would drift the moment a value is tuned here. */
export type NonMeadowPiece = Exclude<BotanicalPiece, "meadow-band">;

/* One knob per piece: k, the fraction of its ring band a piece's width occupies — width is
   `k × the ring band it enters from`. `meadow-band` is exempt — it is sized against the window,
   never the ring, and its own crop constants sit below.

   These are a MECHANICAL starting point, not a tuned one: the mock-derived seed (`k ≈ g × 0.6`,
   `tmp/botanical-preview/index.html`) let several pieces bleed off a section's top or bottom edge
   at wide tiers — `side-spread-left` measured far taller than its section at laptop-landscape
   card, 545px past the top. DESIGN.md → Botanical Edge allows a piece to bleed off the left or
   right window edge only, never the top or bottom.

   Each value here is the largest k at which that piece's height (its width, via its own aspect
   ratio) does not exceed its own section's real height, at every measured tier and orientation
   (phone/tablet/compact/laptop portrait and landscape, read off the built page — see
   `tmp/botanical-tune/`). It is a ceiling, not a design value: the owner tunes every piece down by
   eye from here, one section at a time (Wave 3), and cross-piece bloom-matching is explicitly out
   of scope (owner decision — every piece is tuned individually). */
export const RING_FRACTION: Readonly<Record<NonMeadowPiece, number>> = {
  "falling-spray": 7.33,
  "hanging-bunch": 4.3,
  "corner-spray": 2.74,
  "horizontal-garland": 4.34,
  "side-spread-left": 2.25,
  "side-spread-right": 2.09,
  "sprig-cross-left": 2.99,
  "sprig-cross-right": 2,
  "tall-column-a": 1.76,
  "tall-column-b": 1.84,
};

/* A piece entering from a section's top or bottom edge is sized against `--ring-block`; one
   entering from a side edge against `--ring-side`. */
export const RING_BAND: Readonly<Record<NonMeadowPiece, RingBand>> = {
  "falling-spray": "block",
  "hanging-bunch": "block",
  "corner-spray": "side",
  "horizontal-garland": "block",
  "side-spread-left": "side",
  "side-spread-right": "side",
  "sprig-cross-left": "side",
  "sprig-cross-right": "side",
  "tall-column-a": "side",
  "tall-column-b": "side",
};

const RING_VAR: Readonly<Record<RingBand, string>> = {
  block: "var(--ring-block)",
  side: "var(--ring-side)",
};

/* Each piece's own aspect ratio, read from its shipped laptop-tier file
   (`public/botanical/<piece>-laptop.avif`) so the box matches the art with no letterboxing —
   `background-size: contain` then fills it exactly. Unlike the meadow band's crop, a mismatch here
   only wastes canvas inside the box; it never breaks a crop, so no test asserts it. */
export const ASPECT_RATIO: Readonly<Record<NonMeadowPiece, string>> = {
  "falling-spray": "998 / 748",
  "hanging-bunch": "387 / 623",
  "corner-spray": "715 / 689",
  "horizontal-garland": "1536 / 1024",
  "side-spread-left": "738 / 1050",
  "side-spread-right": "713 / 1106",
  "sprig-cross-left": "635 / 400",
  "sprig-cross-right": "491 / 578",
  "tall-column-a": "441 / 1707",
  "tall-column-b": "482 / 1726",
};

/* `"998 / 748"` -> `1.3342`. Kept beside the table it reads so the two cannot drift. */
function aspectNumber(ratio: string): number {
  const [w, h] = ratio.split("/").map((n) => Number(n.trim()));
  return w / h;
}

function Bloom({ piece, anchor }: BotanicalPlacement) {
  if (piece === "meadow-band") {
    return (
      <div
        className={`${styles.bloom} ${styles["meadow-band"]} ${styles[anchor]}`}
        style={{
          aspectRatio: `${MEADOW_NATURAL_WIDTH} / ${MEADOW_NATURAL_HEIGHT * MEADOW_VISIBLE_FRACTION}`,
        }}
      />
    );
  }
  const band = RING_BAND[piece];
  return (
    <div
      className={`${styles.bloom} ${styles[piece]} ${styles[anchor]}`}
      style={{
        aspectRatio: ASPECT_RATIO[piece],
        /* The same ratio as a bare number, so `.bloom` can cap its width by the block extent it has
           to live in. Without this cap a piece is sized purely by the ring, and the ring itself
           grows with window height once the frame's `max()` takes over above ~1104px — so a `k`
           tuned at one window silently bleeds past a section's top or bottom at a taller one, which
           `DESIGN.md` forbids. The cap enforces that rule structurally rather than by hoping every
           hand-tuned constant was checked at every window. */
        ["--piece-aspect" as string]: aspectNumber(ASPECT_RATIO[piece]),
        /* `--piece-ring`/`--piece-k` feed `.bloom`'s own `width: calc(...)` in the stylesheet, so
           the fraction lives once, here, rather than being restated as a literal in CSS. */
        ["--piece-ring" as string]: RING_VAR[band],
        ["--piece-k" as string]: RING_FRACTION[piece],
      }}
    />
  );
}

interface BotanicalProps {
  /* A single-sheet or pair section's measured fit — pass this for Invite, Event Info, Family and
     Wishes. Omit it for Celebrations, the page's one `tall` section, which has no measured fit. */
  fit?: MeasuredFit;
  pieces: readonly BotanicalPlacement[];
}

export function Botanical({ fit, pieces }: BotanicalProps) {
  const scopeClass =
    fit !== undefined ? frameScopeClass(fit) : tallScopeClass(false);
  return (
    <div className={`${scopeClass} ${styles.layer}`}>
      {pieces.map((placement) => (
        <Bloom key={placement.piece} {...placement} />
      ))}
    </div>
  );
}
