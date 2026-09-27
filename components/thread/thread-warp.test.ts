import assert from "node:assert/strict";
import { test } from "node:test";
import type { AuthoredCard } from "./thread-authored-layout.ts";
import { authoredCard } from "./thread-authored-layout.ts";
import { THREAD_BANDS } from "./thread-bands.ts";
import type { SectionBox } from "./thread-geometry.ts";
import type { Placement } from "./thread-paths.ts";
import {
  type MeasuredSection,
  type Rect,
  warpPlacement,
  warpSection,
} from "./thread-warp.ts";

const WIDE_BOX: SectionBox = THREAD_BANDS.find((b) => b.id === "wide")!.box;
const UPRIGHT_BOX: SectionBox = THREAD_BANDS.find(
  (b) => b.id === "upright",
)!.box;

function parseNumbers(d: string): number[] {
  return (d.match(/-?\d*\.?\d+(?:[eE][-+]?\d+)?/g) ?? []).map(Number);
}

const WIDE_INVITE_AUTHORED: AuthoredCard = {
  cardWidth: 960,
  cardLeft: 288,
  sectionHeight: 695,
};

test("identity: warping to the authored box returns the same geometry within 0.01px", () => {
  const to: MeasuredSection = {
    top: 0,
    height: WIDE_INVITE_AUTHORED.sectionHeight,
    cardLeft: WIDE_INVITE_AUTHORED.cardLeft,
    cardWidth: WIDE_INVITE_AUTHORED.cardWidth,
  };
  const d =
    "M 300 10 C 320 20 340 30 360 40 C 380 50 400 60 420 70 C 260 90 240 100 220 110";

  const warped = warpSection(d, WIDE_INVITE_AUTHORED, to);

  const before = parseNumbers(d);
  const after = parseNumbers(warped);
  assert.equal(after.length, before.length);
  for (let i = 0; i < before.length; i++) {
    assert.ok(
      Math.abs(before[i] - after[i]) < 0.01,
      `point ${i}: authored ${before[i]}, warped ${after[i]}`,
    );
  }
});

/* Real figures from the wide band's own range (session.md / thread-and-motion review): the
   viewport runs ~1024-2560px while the card only grows ~768-1200px across it. A viewport-anchored
   warp and a card-anchored one disagree sharply off the card, which is exactly what this proves. */
test("card anchoring: a doubled viewport with a smaller-than-doubled card moves an authored point to the card-relative place, not the viewport-relative one", () => {
  const to: MeasuredSection = {
    top: 0,
    height: 695,
    cardLeft: 680,
    cardWidth: 1200,
  };

  // The card's own left and right edges must land exactly on the new card's edges.
  const leftEdge = warpSection("M 288 0", WIDE_INVITE_AUTHORED, to);
  assert.equal(parseNumbers(leftEdge)[0], 680);
  const rightEdge = warpSection("M 1248 0", WIDE_INVITE_AUTHORED, to);
  assert.equal(parseNumbers(rightEdge)[0], 1880);

  // A point at the viewport's own left edge (authored x = 0, well outside the card) is the
  // discriminator: card-anchored math carries it along with the card's own offset and scale
  // (680 + (0 - 288) * 1.25 = 320); a viewport-anchored warp would instead hold it at the
  // viewport's edge (0 * scale = 0) or scale it against the full viewport width, neither of
  // which is 320.
  const viewportEdge = warpSection("M 0 0", WIDE_INVITE_AUTHORED, to);
  const warpedX = parseNumbers(viewportEdge)[0];
  assert.ok(
    Math.abs(warpedX - 320) < 0.01,
    `expected the card-anchored 320, got ${warpedX}`,
  );
  assert.notEqual(warpedX, 0);
});

test("y warps by the section's own height ratio, independent of the card", () => {
  const to: MeasuredSection = {
    top: 40,
    height: 1390,
    cardLeft: 680,
    cardWidth: 1200,
  };
  const warped = warpSection("M 0 347.5", WIDE_INVITE_AUTHORED, to); // authored midpoint
  const [, y] = parseNumbers(warped);
  // scaleY = 1390 / 695 = 2, so y_page = 40 + 347.5 * 2 = 735
  assert.ok(Math.abs(y - 735) < 0.01);
});

test("a cubic's control points warp exactly, the same per-axis map as its anchors", () => {
  const to: MeasuredSection = {
    top: 100,
    height: 1390,
    cardLeft: 88,
    cardWidth: 480,
  };
  const d = "M 288 0 C 400 100 500 200 600 300";
  const warped = warpSection(d, WIDE_INVITE_AUTHORED, to);
  const scaleX = 480 / 960;
  const scaleY = 1390 / 695;
  const expected = [
    88, // (288-288)*scaleX + 88
    100, // 0*scaleY + 100
    88 + (400 - 288) * scaleX,
    100 + 100 * scaleY,
    88 + (500 - 288) * scaleX,
    100 + 200 * scaleY,
    88 + (600 - 288) * scaleX,
    100 + 300 * scaleY,
  ];
  const actual = parseNumbers(warped);
  assert.equal(actual.length, expected.length);
  for (let i = 0; i < expected.length; i++) {
    assert.ok(
      Math.abs(actual[i] - expected[i]) < 0.01,
      `coord ${i}: ${actual[i]} vs ${expected[i]}`,
    );
  }
});

test("throws rather than approximating a path command the warp cannot map exactly", () => {
  const to: MeasuredSection = {
    top: 0,
    height: 695,
    cardLeft: 288,
    cardWidth: 960,
  };
  assert.throws(() =>
    warpSection("M 0 0 Q 10 10 20 20", WIDE_INVITE_AUTHORED, to),
  );
});

const HEART: Placement = {
  motif: "heart",
  x: 400,
  y: 200,
  scale: 0.15,
  turn: 12,
};

test("without an anchor, warpPlacement maps position the same way warpSection maps a point", () => {
  const to: MeasuredSection = {
    top: 10,
    height: 800,
    cardLeft: 300,
    cardWidth: 1000,
  };

  const warped = warpPlacement(HEART, WIDE_INVITE_AUTHORED, to, WIDE_BOX);

  const scaleX = 1000 / 960;
  const scaleY = 800 / 695;
  const expectedX = 300 + (HEART.x - 288) * scaleX;
  const expectedY = 10 + HEART.y * scaleY;
  assert.ok(Math.abs(warped.x - expectedX) < 0.01);
  assert.ok(Math.abs(warped.y - expectedY) < 0.01);

  // Motif size resolves to ONE uniform factor, the ratio of `to.cardWidth` to `from.cardWidth` —
  // never two independent axis scales (the drawing would shear) and never a factor derived from
  // the card or section height (see thread-warp.ts's uniformScaleFactor comment).
  const expectedScale = HEART.scale * (1000 / 960);
  assert.ok(Math.abs(warped.scale - expectedScale) < 1e-9);

  // Everything not about position or size is carried through untouched.
  assert.equal(warped.motif, HEART.motif);
  assert.equal(warped.turn, HEART.turn);
});

test("anchoring: a placement with an anchor lands its centre on the anchor's measured centre", () => {
  const to: MeasuredSection = {
    top: 10,
    height: 800,
    cardLeft: 300,
    cardWidth: 1000,
  };
  const anchor: Rect = { left: 500, top: 240, width: 80, height: 80 };

  const warped = warpPlacement(
    {
      motif: "portraitLoop",
      x: 100,
      y: 50,
      scale: 0.2,
      turn: -29,
      mirror: true,
    },
    WIDE_INVITE_AUTHORED,
    to,
    WIDE_BOX,
    anchor,
  );

  assert.equal(warped.x, 540); // 500 + 80/2
  assert.equal(warped.y, 280); // 240 + 80/2
  // The anchor overrides position only — size, turn and mirror are unaffected by it.
  assert.equal(warped.turn, -29);
  assert.equal(warped.mirror, true);
});

/* Regression for the review finding that `uniformScaleFactor` had used
   `Math.min(from.cardWidth, from.sectionHeight)` — a per-SECTION quantity — as the authored unit
   instead of the BAND's nominal box. Every number here is read from source, not typed from a review
   comment: `UPRIGHT_BOX` from `thread-bands.ts` (via `THREAD_BANDS`), and the invite's upright
   `AuthoredCard` from `thread-authored-layout.ts` (via `authoredCard`). */
test("motif scale resolves against the BAND's nominal unit, not the card or the section height", () => {
  const from = authoredCard("invite", "upright");
  const nominalUnit = Math.min(UPRIGHT_BOX.width, UPRIGHT_BOX.height);

  // A `to` whose HEIGHT is smaller than its card width — the shape that discriminates the two
  // formulas. `from`'s own dimensions never do: every upright section's authored sectionHeight
  // (1180-2360) exceeds its cardWidth (564), so `Math.min(from.cardWidth, from.sectionHeight)`
  // always happens to equal `from.cardWidth` anyway, and a `to` shaped the same way would hide the
  // bug behind a coincidence rather than exercise it.
  const to: MeasuredSection = {
    top: 0,
    height: 400,
    cardLeft: 100,
    cardWidth: 700,
  };
  const placement: Placement = {
    motif: "rings",
    x: 0,
    y: 0,
    scale: 0.25,
    turn: 0,
  };

  const warped = warpPlacement(placement, from, to, UPRIGHT_BOX);

  // The formula this test pins, read from `thread-css.ts:497` and `:1190-1199`:
  //   pageSide = scale * min(band.box.width, band.box.height) * (to.cardWidth / from.cardWidth)
  const expectedSide =
    placement.scale * nominalUnit * (to.cardWidth / from.cardWidth);
  const actualSide = warped.scale * nominalUnit;
  assert.ok(
    Math.abs(actualSide - expectedSide) < 1e-9,
    `expected side ${expectedSide}, got ${actualSide}`,
  );

  // The old (wrong) basis this replaces, stated so a future regression is legible against it: it
  // would have resolved `warped.scale` to `scale * (min(to.cardWidth, to.height) /
  // min(from.cardWidth, from.sectionHeight))`, which for these figures is NOT `expectedSide` above.
  const oldUnitFrom = Math.min(from.cardWidth, from.sectionHeight);
  const oldUnitTo = Math.min(to.cardWidth, to.height);
  const oldSide = placement.scale * (oldUnitTo / oldUnitFrom) * nominalUnit;
  assert.notEqual(oldSide, expectedSide);
});

test("identity: warpPlacement to the authored box returns the same position and a scale ratio of 1", () => {
  const placement: Placement = {
    motif: "heart",
    x: 400,
    y: 200,
    scale: 0.15,
    turn: 12,
  };
  const to: MeasuredSection = {
    top: 0,
    height: WIDE_INVITE_AUTHORED.sectionHeight,
    cardLeft: WIDE_INVITE_AUTHORED.cardLeft,
    cardWidth: WIDE_INVITE_AUTHORED.cardWidth,
  };

  const warped = warpPlacement(placement, WIDE_INVITE_AUTHORED, to, WIDE_BOX);

  assert.ok(Math.abs(warped.x - placement.x) < 0.01);
  assert.ok(Math.abs(warped.y - placement.y) < 0.01);
  assert.ok(Math.abs(warped.scale / placement.scale - 1) < 1e-9);
});
