import type { MeasuredFit } from "@/components/layout/mounted-sheet-frame";
import {
  frameScopeClass,
  tallScopeClass,
} from "@/components/layout/mounted-sheet-frame-css";
import styles from "./botanical.module.css";
import { botanicalCss, pieceClass } from "./botanical-css";
import { ASPECT_RATIO, type BotanicalPlacement } from "./botanical-placement";

/* Sparse wildflower elements at the screen edges — DESIGN.md → Botanical Edge. Full opacity,
   `mix-blend-mode: multiply` against the ivory ground, and no `z-index` on this layer or anything a
   piece sits inside: the card's frame (`mounted-sheet-frame__box`) sits at `--z-content`, so it always
   paints above this layer, and the section carries none, which keeps the blend out of an isolating
   stacking context. The invite's own pieces take `--z-invite-bloom` on the piece itself
   (`app/_sections/invite.css`), which isolates nothing they blend with. Size and placement are per width tier and read from the
   viewport, not from the frame's ring bands. The wrapper carries the section's frame-scope class
   because the frame's own rule is what gives this layer the section's box to position against. */

/* `"1536 / 1024"` -> `1.5`, for the ratios in `botanical-placement.ts`. */
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
  /* Emit each piece's growth corner for the invite's opening (`app/_sections/invite.css`). The invite alone
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
