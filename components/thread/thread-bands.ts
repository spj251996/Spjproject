import type { SectionBox } from "./thread-geometry.ts";

export type BandId = "tall" | "upright" | "wide";

/* `min`/`max` bound the section's aspect ratio (`width / height`), inclusive at `min` and exclusive
   at `max`, so no aspect can match two bands. The alternative — open-ended ranges that both match —
   silently lets whichever rule the stylesheet emits later win, which this project has been bitten
   by (Tailwind orders arbitrary variants by string, so `>=64rem` beat `>=100rem`). */
export type Band = { id: BandId; box: SectionBox; min: number; max: number };

/* ────────────────────────────────────────────────────────────────────────────────────────────────
   `tall`'s HEIGHT IS NOT MEASURED, AND `Number.NaN` IS THE POINT.

   A page section is `100svh`, so the band's shape is the VIEWPORT's, not the phone's screen. `svh`
   is the viewport with the browser's bars shown, and a headless browser has no bars: under
   Playwright's own iPhone 16 descriptor `svh`, `lvh`, `dvh` and `vh` all come back equal to the
   screen (393x852, aspect 0.4613), which is the screen wearing a viewport's clothes. Deriving the
   band from it would ship a number nobody measured.

   The real value is one reading of `100svh` in Safari, portrait, on the owner's own iPhone 16
   (`tmp/thread-head-spike/svh.html` prints it). Until it arrives this stays `NaN`, so any geometry
   composed against the `tall` box emits `NaN` into the stylesheet and cannot be mistaken for a
   tuned value — a placeholder that is plausible is the failure this avoids.
   ──────────────────────────────────────────────────────────────────────────────────────────────── */
export const TALL_BOX_HEIGHT = Number.NaN;

const UPRIGHT_BOX: SectionBox = { width: 820, height: 1180 };

/* PROVISIONAL, and it moves when `TALL_BOX_HEIGHT` arrives. The settled boundary is between the two
   bands' nominal aspects, and one of them is unknown — so `upright` provisionally claims nothing
   below its own nominal aspect. That is wrong in the safe direction: every portrait phone viewport
   is narrower than a portrait tablet, so every phone still lands in `tall`, and only the strip
   between the true boundary and 0.6949 is misrouted. Nothing is known to sit there. */
export const TALL_UPRIGHT_BOUNDARY = UPRIGHT_BOX.width / UPRIGHT_BOX.height;

/* A 4:3 landscape window. This is the edge Task 1's Q4 swept the anisotropy against (`wide` as
   `[1.33, oo)`, worst factor 40%, the worst case a landscape tablet), so its verdict — three bands,
   not four — is a verdict about THIS edge. Moving it voids that measurement. */
export const UPRIGHT_WIDE_BOUNDARY = 4 / 3;

/* Thread geometry is emitted per ASPECT BAND, not per width tier: a motif is a square while a
   section is not, so it is the section's aspect that decides where a connector's ends land. Each
   band's `box` is the nominal pixel box of the device it was chosen for, and geometry composed
   against it is pixel-exact there — which is what lets a dash advance at a constant rate.

   Three bands, from devices the owner named: their iPhone 16, a mid-range iPad, and their own
   laptop viewport (1536x695 — a laptop viewport is far wider than its 16:9 screen, because chrome
   eats height and nothing eats width). A fourth band is additive: this is a list and the handoff
   test governs whichever entries are in it. */
export const THREAD_BANDS = [
  {
    id: "tall",
    box: { width: 393, height: TALL_BOX_HEIGHT },
    min: 0,
    max: TALL_UPRIGHT_BOUNDARY,
  },
  {
    id: "upright",
    box: UPRIGHT_BOX,
    min: TALL_UPRIGHT_BOUNDARY,
    max: UPRIGHT_WIDE_BOUNDARY,
  },
  {
    id: "wide",
    box: { width: 1536, height: 695 },
    min: UPRIGHT_WIDE_BOUNDARY,
    max: Number.POSITIVE_INFINITY,
  },
] as const satisfies readonly Band[];
