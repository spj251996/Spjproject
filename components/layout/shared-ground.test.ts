import assert from "node:assert/strict";
import test from "node:test";
import type { MeasuredFit } from "./mounted-sheet-frame";
import { type GroundKey, sharedGrounds } from "./shared-ground.ts";

/* Two sections that disagree in one cell and agree in another, so the test can tell "took the
   minimum" apart from "took the first" or "took whatever was largest". */
function fit(section: string, tabletPortraitWidth: number): MeasuredFit {
  return {
    section,
    regimes: {
      phone: {
        portrait: [{ minContentWidth: 120, contentHeight: 600 }],
        landscape: [{ minContentWidth: 120, contentHeight: 400 }],
      },
      tablet: {
        portrait: [
          { minContentWidth: tabletPortraitWidth, contentHeight: 600 },
        ],
        landscape: [{ minContentWidth: 300, contentHeight: 400 }],
      },
      laptop: {
        portrait: [{ minContentWidth: 300, contentHeight: 600 }],
        landscape: [{ minContentWidth: 300, contentHeight: 400 }],
      },
      desktop: {
        portrait: [{ minContentWidth: 300, contentHeight: 600 }],
        landscape: [{ minContentWidth: 300, contentHeight: 400 }],
      },
    },
  } as MeasuredFit;
}

test("a cell takes the widest content requirement, which is the smallest ground", () => {
  const grounds = sharedGrounds([fit("a", 200), fit("b", 500)]);
  assert.equal(grounds.get("tablet:portrait" as GroundKey), 500);
});

test("order does not decide it", () => {
  const forward = sharedGrounds([fit("a", 200), fit("b", 500)]);
  const reverse = sharedGrounds([fit("b", 500), fit("a", 200)]);
  assert.deepEqual(
    [...forward.entries()].sort(),
    [...reverse.entries()].sort(),
  );
});

test("cells are keyed by tier AND orientation, never merged", () => {
  const grounds = sharedGrounds([fit("a", 200), fit("b", 500)]);
  assert.equal(grounds.get("tablet:portrait" as GroundKey), 500);
  assert.equal(grounds.get("tablet:landscape" as GroundKey), 300);
});

test("every tier and orientation is present", () => {
  const grounds = sharedGrounds([fit("a", 200)]);
  assert.equal(grounds.size, 8);
});

test("one fit is enough — the rule degenerates to that fit's own values", () => {
  const grounds = sharedGrounds([fit("solo", 420)]);
  assert.equal(grounds.get("tablet:portrait" as GroundKey), 420);
});
