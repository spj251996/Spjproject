import type { SectionBox } from "./thread-geometry.ts";

export type BandId = "tall" | "upright" | "wide";

/* `media` is the window a band is drawn for, as a media query. The three queries cover every window
   exactly once (`thread-fallback.test.ts`), since a window matching two would let whichever rule is
   emitted later win. */
export type Band = { id: BandId; box: SectionBox; media: string };

/* ────────────────────────────────────────────────────────────────────────────────────────────────
   AN ESTIMATE, NOT A MEASUREMENT, and it stays one: the thread never ships to guests.

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
const TALL_BOX_HEIGHT = 700;

const TALL_BOX: SectionBox = { width: 393, height: TALL_BOX_HEIGHT };
const UPRIGHT_BOX: SectionBox = { width: 820, height: 1180 };

/* The GEOMETRIC mean of the two bands' nominal aspects (0.5614 and 0.6949), not the arithmetic one.
   A section drawn away from its band's nominal is stretched by the RATIO of the two aspects, so the
   geometric mean is the aspect that costs both neighbours the same factor — 1.1125 either side. */
export const TALL_UPRIGHT_BOUNDARY = Math.sqrt(
  (TALL_BOX.width / TALL_BOX.height) * (UPRIGHT_BOX.width / UPRIGHT_BOX.height),
);

/* Where the page lays its pairs out side by side — a landscape window at `{breakpoints.lg}` and wider,
   the line where the frame shows its mount (DESIGN.md → `mounted-pair`). `wide` was drawn on that
   arrangement and `tall`/`upright` on the stacked one, so the band follows it rather than the window's
   aspect: at 1024x800 an aspect edge at 4:3 put the upright drawing, authored for a 2360px stacked
   section, onto an 800px side-by-side one. */
const SIDE_BY_SIDE = "(width >= 64rem) and (orientation: landscape)";

/* Thread geometry is emitted per ASPECT BAND, not per width tier: a motif is a square while a
   section is not, so it is the section's aspect that decides where a connector's ends land. Each
   band's `box` is the nominal pixel box of the device it was chosen for — but it is not the box
   every section in that band composes against: a paired section stacks in portrait and
   Celebrations is a list, so both run taller than a single card, and
   `thread-authored-layout.ts` gives each `(band, section)` pair its own measured height instead.

   Three bands, from devices the owner named: their iPhone 16, a mid-range iPad, and their own
   laptop viewport (1536x695 — a laptop viewport is far wider than its 16:9 screen, because chrome
   eats height and nothing eats width). A fourth band is additive: this is a list and the handoff
   test governs whichever entries are in it. */
export const THREAD_BANDS = [
  {
    id: "tall",
    box: TALL_BOX,
    /* Narrower than any landscape window, so never side by side. */
    media: `(aspect-ratio < ${round(TALL_UPRIGHT_BOUNDARY)})`,
  },
  {
    id: "upright",
    box: UPRIGHT_BOX,
    /* Stacked: under 64rem, or in portrait. */
    media: [
      `(${round(TALL_UPRIGHT_BOUNDARY)} <= aspect-ratio) and (width < 64rem)`,
      `(${round(TALL_UPRIGHT_BOUNDARY)} <= aspect-ratio) and (orientation: portrait)`,
    ].join(", "),
  },
  {
    id: "wide",
    box: { width: 1536, height: 695 },
    media: SIDE_BY_SIDE,
  },
] as const satisfies readonly Band[];

function round(value: number): string {
  const fixed = value.toFixed(5).replace(/\.?0+$/, "");
  return fixed === "-0" ? "0" : fixed;
}
