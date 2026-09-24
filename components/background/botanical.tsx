import type { MeasuredFit } from "@/components/layout/mounted-sheet-frame";
import {
  frameScopeClass,
  tallScopeClass,
} from "@/components/layout/mounted-sheet-frame-css";
import styles from "./botanical.module.css";
import { botanicalCss, pieceClass } from "./botanical-css";
import {
  MEADOW_NATURAL_HEIGHT,
  MEADOW_NATURAL_WIDTH,
  MEADOW_VISIBLE_FRACTION,
} from "./botanical-meadow";
import type { BotanicalPiece, NonMeadowPiece } from "./botanical-tuning";

export {
  MEADOW_NATURAL_HEIGHT,
  MEADOW_NATURAL_WIDTH,
  MEADOW_VISIBLE_FRACTION,
} from "./botanical-meadow";

export type {
  Anchor,
  BotanicalPiece,
  NonMeadowPiece,
  PieceTuning,
  Tier,
} from "./botanical-tuning";
export { TIERS, TUNING } from "./botanical-tuning";

/* Sparse wildflower elements at the screen edges — DESIGN.md → Botanical Edge. Full opacity,
   `mix-blend-mode: multiply` against the ivory ground, no `z-index` anywhere in this layer: the
   card's own frame (`mounted-sheet-frame__box`) carries the only explicit `z-index` in a framed
   section, so it always paints above a layer that has none — the section itself carries no
   z-index either (removed from `app/page.tsx`), which is what frees the blend from an isolating
   stacking context in the first place.

   Size and placement are per width tier and read from the viewport, not from the frame's ring
   bands — `botanical-tuning.ts` holds the records and `botanical-css.ts` emits them as this
   layer's own stylesheet. The wrapper still carries the section's frame-scope class, because the
   frame's own rule is what gives this layer the section's box to position against. */

/* Which pieces each section carries. This is the ONE place the assignment lives: `app/page.tsx`
   renders from it and the dev tuning panel reads it to group its controls. A second copy has twice
   drifted out of step with a swap and sent nudges along an axis the piece was no longer anchored
   on, which moves it nowhere and reads as a dead slider. Where each piece sits is per tier and
   lives in `botanical-tuning.ts`. */
export const SECTION_PLACEMENT = {
  invite: [{ piece: "falling-spray" }, { piece: "corner-spray" }],
  "event-info": [{ piece: "tied-bouquet" }, { piece: "horizontal-garland" }],
  family: [{ piece: "side-spread-left" }, { piece: "side-spread-right" }],
  celebrations: [
    { piece: "crossing-stems" },
    { piece: "drooping-stem" },
    { piece: "tall-column-a" },
    { piece: "tall-column-b" },
  ],
  wishes: [
    { piece: "meadow-band" },
    { piece: "sprig-cross-left" },
    { piece: "sprig-cross-right" },
  ],
  /* The not-found screen is a standalone single-screen composition like the invite, not a closing
     section, so it takes the invite's own pieces rather than a section's gap-straddling ones —
     DESIGN.md → Not found. It stands outside the scroll, so nothing repeats in one reading. */
  "not-found": [{ piece: "falling-spray" }, { piece: "corner-spray" }],
} as const satisfies Readonly<Record<string, readonly BotanicalPlacement[]>>;

export interface BotanicalPlacement {
  piece: BotanicalPiece;
}

/* Each piece's own aspect ratio, read from its shipped laptop-tier file
   (`public/botanical/<piece>-laptop.avif`) so the box matches the art with no letterboxing —
   `background-size: contain` then fills it exactly. Unlike the meadow band's crop, a mismatch here
   only wastes canvas inside the box; it never breaks a crop, so no test asserts it. */
export const ASPECT_RATIO: Readonly<Record<NonMeadowPiece, string>> = {
  "falling-spray": "998 / 748",
  "tied-bouquet": "387 / 623",
  "crossing-stems": "1312 / 1199",
  "drooping-stem": "1312 / 1199",
  "corner-spray": "715 / 689",
  "horizontal-garland": "1536 / 1024",
  "side-spread-left": "738 / 1050",
  "side-spread-right": "713 / 1106",
  "sprig-cross-left": "635 / 400",
  "sprig-cross-right": "491 / 578",
  "tall-column-a": "827 / 1902",
  "tall-column-b": "821 / 1915",
};

/* `"998 / 748"` -> `1.3342`. Kept beside the table it reads so the two cannot drift. */
function aspectNumber(ratio: string): number {
  const [w, h] = ratio.split("/").map((n) => Number(n.trim()));
  return w / h;
}

function Bloom({ piece }: BotanicalPlacement) {
  if (piece === "meadow-band") {
    return (
      <div
        className={`${styles.bloom} ${styles["meadow-band"]} ${pieceClass(piece)}`}
        style={{
          aspectRatio: `${MEADOW_NATURAL_WIDTH} / ${MEADOW_NATURAL_HEIGHT * MEADOW_VISIBLE_FRACTION}`,
        }}
      />
    );
  }
  return (
    <div
      className={`${styles.bloom} ${styles[piece]} ${pieceClass(piece)}`}
      style={{
        aspectRatio: ASPECT_RATIO[piece],
        /* The same ratio as a bare number, so `.bloom` can cap its width by the block extent it has
           to live in. Without the cap a tuned width alone decides the height, and a width settled
           against one window bleeds past a section's top or bottom edge at a shorter one, which
           `DESIGN.md` forbids. The cap enforces that rule structurally rather than by hoping every
           tuned value was checked at every window. */
        ["--piece-aspect" as string]: aspectNumber(ASPECT_RATIO[piece]),
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
      <style>{botanicalCss(pieces.map((placement) => placement.piece))}</style>
      <div className={styles.clip}>
        {pieces.map((placement) => (
          <Bloom key={placement.piece} {...placement} />
        ))}
      </div>
    </div>
  );
}
