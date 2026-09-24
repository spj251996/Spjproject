import type { SectionBox } from "./thread-geometry.ts";

export type BandId = "tall" | "upright" | "wide";

/* `min`/`max` bound the section's aspect ratio (`width / height`), inclusive at `min` and exclusive
   at `max`, so no aspect can match two bands. The alternative — open-ended ranges that both match —
   silently lets whichever rule the stylesheet emits later win, which this project has been bitten
   by (Tailwind orders arbitrary variants by string, so `>=64rem` beat `>=100rem`). */
export type Band = { id: BandId; box: SectionBox; min: number; max: number };

/* ────────────────────────────────────────────────────────────────────────────────────────────────
   AN ESTIMATE, NOT A MEASUREMENT. A real reading replaces it.

   A page section is `100svh`, so the band's shape is the VIEWPORT's, not the phone's screen. The
   owner's iPhone 16 is 393x852 CSS px, and iOS Safari's small viewport subtracts its top and bottom
   bars — roughly 150 px of them, giving 700. It could not be measured: no headless browser has
   browser chrome, so `svh`, `lvh`, `dvh` and `vh` all come back equal to the screen under emulation
   (aspect 0.4613, the screen wearing a viewport's clothes), and the owner cannot open a local file
   on the phone to read the real one.

   WHY AN ESTIMATE IS SAFE HERE, which is not obvious and is why this does not block:

   - In portrait the `svmin` unit is the WIDTH, and the width is exact. `min(393, 700)` and
     `min(393, 852)` are both 393, so a wrong height cannot move a motif's attachment point at all
     — it changes only the vertical stretch of the composed curve.
   - The cost of being wrong is bounded and small. Anisotropy against this estimate: 6.1% off at
     h=660, 7.9% off at h=760, and 17.8% off even at the raw 852 with the chrome ignored entirely.
     The `wide` band is already accepted at 40% off at its own worst member, so this sits well
     inside tolerance the design already carries.
   ──────────────────────────────────────────────────────────────────────────────────────────────── */
export const TALL_BOX_HEIGHT = 700;

const TALL_BOX: SectionBox = { width: 393, height: TALL_BOX_HEIGHT };
const UPRIGHT_BOX: SectionBox = { width: 820, height: 1180 };

/* The GEOMETRIC mean of the two bands' nominal aspects (0.5614 and 0.6949), not the arithmetic one.
   A section drawn away from its band's nominal is stretched by the RATIO of the two aspects, so the
   geometric mean is the aspect that costs both neighbours the same factor — 1.1125 either side. */
export const TALL_UPRIGHT_BOUNDARY = Math.sqrt(
  (TALL_BOX.width / TALL_BOX.height) * (UPRIGHT_BOX.width / UPRIGHT_BOX.height),
);

/* A 4:3 landscape window. This is the edge Task 1's Q4 swept the anisotropy against (`wide` as
   `[1.33, oo)`, worst factor 40%, the worst case a landscape tablet), so its verdict — three bands,
   not four — is a verdict about THIS edge. Moving it voids that measurement, which is why this one
   is authored where its neighbour above is the geometric mean of two nominals. */
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
    box: TALL_BOX,
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
