import type { MeasuredFit } from "@/components/layout/mounted-sheet-frame";
import {
  frameScopeClass,
  tallScopeClass,
} from "@/components/layout/mounted-sheet-frame-css";
import styles from "./botanical.module.css";
import { botanicalCss, pieceClass } from "./botanical-css";
import type { BotanicalPiece } from "./botanical-tuning";

/* Sparse wildflower elements at the screen edges — DESIGN.md → Botanical Edge. Full opacity,
   `mix-blend-mode: multiply` against the ivory ground, and no `z-index` anywhere in this layer: the
   card's frame (`mounted-sheet-frame__box`) carries the only explicit `z-index` in a framed section,
   so it always paints above this layer, and the section carries none either, which keeps the blend
   out of an isolating stacking context. Size and placement are per width tier and read from the
   viewport, not from the frame's ring bands. The wrapper carries the section's frame-scope class
   because the frame's own rule is what gives this layer the section's box to position against. */

/* The invite's pieces, shared with the not-found screen — one layout, so a change to one is a change
   to both. */
const INVITE_PIECES = [
  { piece: "corner-trail" },
  { piece: "corner-spray" },
] as const satisfies readonly BotanicalPlacement[];

/* Which pieces each section carries. This is the ONE place the assignment lives: `app/_sections/`
   renders from it. A second copy has twice
   drifted out of step with a swap and sent nudges along an axis the piece was no longer anchored
   on, which moves it nowhere and reads as a dead slider. Where each piece sits is per tier and
   lives in `botanical-tuning.ts`. */
export const SECTION_PLACEMENT = {
  invite: INVITE_PIECES,
  /* `tall-column-a` (bottom-left) and `blush-stem` (middle-left) carry the rail at the tablet tier,
     where the two cards stack and the rail runs bare for the height of two cards. Both are dropped at
     every other tier: on a phone, and from the laptop tier up, where the cards sit side by side and
     there is no rail to carry. */
  "event-info": [
    { piece: "tied-bouquet" },
    { piece: "horizontal-garland" },
    { piece: "tall-column-a" },
    { piece: "blush-stem" },
  ],
  family: [
    { piece: "poppy-spread" },
    { piece: "tall-column-b" },
    { piece: "meadow-tuft" },
    { piece: "arching-branch" },
    { piece: "cascade-sprigs" },
  ],
  celebrations: [
    { piece: "crossing-stems" },
    { piece: "drooping-stem" },
    { piece: "wall-vine-left" },
    { piece: "wall-vine-right" },
  ],
  wishes: [
    { piece: "meadow-band-left" },
    { piece: "meadow-band-right" },
    { piece: "sprig-cross-left" },
    { piece: "sprig-cross-right" },
  ],
  /* The not-found screen is a standalone single-screen composition like the invite, not a closing
     section, so it reuses the invite's own list rather than a section's gap-straddling pieces —
     DESIGN.md → Not found. It stands outside the scroll, so nothing repeats in one reading. */
  "not-found": INVITE_PIECES,
} as const satisfies Readonly<Record<string, readonly BotanicalPlacement[]>>;

export interface BotanicalPlacement {
  piece: BotanicalPiece;
}

/* Each piece's own aspect ratio, its source width over height, which the generator preserves at
   every tier, so the box matches the art with no letterboxing and `background-size: contain` fills
   it exactly. A mismatch only wastes canvas inside the box and never breaks a crop, so no test
   asserts it. */
const ASPECT_RATIO: Readonly<Record<BotanicalPiece, string>> = {
  "corner-trail": "1536 / 1024",
  "tied-bouquet": "387 / 623",
  "crossing-stems": "1312 / 1199",
  "drooping-stem": "1312 / 1199",
  "corner-spray": "715 / 689",
  "horizontal-garland": "1536 / 1024",
  "poppy-spread": "1024 / 1536",
  "sprig-cross-left": "635 / 400",
  "sprig-cross-right": "491 / 578",
  "tall-column-a": "827 / 1902",
  "tall-column-b": "821 / 1915",
  "meadow-tuft": "1448 / 1086",
  "arching-branch": "1536 / 1024",
  "cascade-sprigs": "1024 / 1536",
  "wall-vine-left": "809 / 1942",
  "wall-vine-right": "809 / 1942",
  "meadow-band-left": "1983 / 793",
  "meadow-band-right": "2089 / 753",
  "blush-stem": "1024 / 1536",
};

/* `"1536 / 1024"` -> `1.5`. Kept beside the table it reads so the two cannot drift. */
function aspectNumber(ratio: string): number {
  const [w, h] = ratio.split("/").map((n) => Number(n.trim()));
  return w / h;
}

function Bloom({ piece }: BotanicalPlacement) {
  return (
    <div
      className={`${styles.bloom} ${pieceClass(piece)}`}
      style={{
        aspectRatio: ASPECT_RATIO[piece],
        /* The same ratio as a bare number, so `.bloom` can cap its width by its block extent
           (DESIGN.md → Botanical Edge). */
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
  /* Emit each piece's growth corner for the invite's opening (`app/invite.css`). The invite alone
     asks, so every other section's stylesheet is byte-identical without it. */
  corners?: boolean;
}

export function Botanical({ fit, pieces, corners = false }: BotanicalProps) {
  const scopeClass =
    fit !== undefined ? frameScopeClass(fit) : tallScopeClass();
  return (
    <div className={`${scopeClass} ${styles.layer}`}>
      <style>
        {botanicalCss(
          pieces.map((placement) => placement.piece),
          { corners },
        )}
      </style>
      <div className={styles.clip}>
        {pieces.map((placement) => (
          <Bloom key={placement.piece} {...placement} />
        ))}
      </div>
    </div>
  );
}
