import type { MeasuredFit } from "@/components/layout/mounted-sheet-frame";
import {
  frameScopeClass,
  tallScopeClass,
} from "@/components/layout/mounted-sheet-frame-css";
import styles from "./botanical.module.css";
import { botanicalCss, pieceClass } from "./botanical-css";
import { ASPECT_RATIO, type BotanicalPlacement } from "./botanical-placement";

/* Sparse wildflower elements at the screen edges — DESIGN.md → Botanical Edge. Full opacity,
   `mix-blend-mode: multiply` against the ivory ground, and no `z-index` anywhere in this layer: the
   card's frame (`mounted-sheet-frame__box`) carries the only explicit `z-index` in a framed section,
   so it always paints above this layer, and the section carries none either, which keeps the blend
   out of an isolating stacking context. Size and placement are per width tier and read from the
   viewport, not from the frame's ring bands. The wrapper carries the section's frame-scope class
   because the frame's own rule is what gives this layer the section's box to position against. */

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
