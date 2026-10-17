import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";
import {
  containerLowerBoundPx,
  lowerBoundPx,
  type MeasuredFit,
  upperBoundPx,
} from "./mounted-sheet-frame.ts";
import { mountedSheetFrameCss } from "./mounted-sheet-frame-css.ts";

const GRID = 64;
const px = (formatted: string) => Number.parseFloat(formatted);

/* Layout lands on a 1/64px grid, and the minifier keeps six
   significant digits, at most three decimals. A directed bound must give
   every grid value the verdict the exact boundary gives it, for each operator it is used with. */
test("a directed bound keeps every grid value's verdict for its operators", () => {
  for (let k = 0; k <= GRID * 3000; k++) {
    const t = k / GRID;
    const lower = px(lowerBoundPx(t));
    const upper = px(upperBoundPx(t));
    for (let offset = -2; offset <= 2; offset++) {
      const g = t + offset / GRID;
      assert.equal(g >= lower, g >= t, `>= at ${t}, grid ${g}`);
      assert.equal(g < lower, g < t, `< at ${t}, grid ${g}`);
      assert.equal(g <= upper, g <= t, `<= at ${t}, grid ${g}`);
      assert.equal(g > upper, g > t, `> at ${t}, grid ${g}`);
    }
  }
});

test("a boundary of 1000px or more moves by less than 0.01, which is under a grid step", () => {
  assert.ok(0.01 < 1 / GRID);
  for (let k = 1000 * GRID; k <= GRID * 3000; k += 3) {
    for (const delta of [0, 0.0004, 1 / 128]) {
      const t = k / GRID + delta;
      assert.ok(Math.abs(px(lowerBoundPx(t)) - t) < 0.01, `lower ${t}`);
      assert.ok(Math.abs(px(upperBoundPx(t)) - t) < 0.01, `upper ${t}`);
    }
  }
  assert.equal(lowerBoundPx(1050.093), "1050.09px");
  assert.equal(upperBoundPx(1050.093), "1050.1px");
});

test("an off-grid boundary under 1000px moves by less than a thousandth", () => {
  for (let k = 0; k <= GRID * 999; k += 7) {
    for (const delta of [0.0004, 1 / 128]) {
      const t = k / GRID + delta;
      assert.ok(Math.abs(px(lowerBoundPx(t)) - t) < 0.001, `lower ${t}`);
      assert.ok(Math.abs(px(upperBoundPx(t)) - t) < 0.001, `upper ${t}`);
    }
  }
});

test("a value already at three decimals is returned unchanged", () => {
  assert.equal(lowerBoundPx(237.016), "237.016px");
  assert.equal(upperBoundPx(237.016), "237.016px");
  assert.equal(lowerBoundPx(237.015625), "237.015px");
  assert.equal(upperBoundPx(237.015625), "237.016px");
});

const BOUNDARY = /(width|height)\s*(>=|<=|<|>)\s*([\d.]+)px/g;

test("every boundary in every committed frame sheet is stable under the minifier", () => {
  let count = 0;
  for (const name of readdirSync("app/frames").filter((n) =>
    n.endsWith(".css"),
  )) {
    for (const m of readFileSync(`app/frames/${name}`, "utf8").matchAll(
      BOUNDARY,
    )) {
      count++;
      assert.ok(
        !/\.\d{4,}/.test(m[3]),
        `${name}: ${m[0]} has more than three decimals`,
      );
      assert.ok(
        m[3].replace(/\D/g, "").replace(/^0+/, "").length <= 6,
        `${name}: ${m[0]} has more than six significant digits`,
      );
    }
  }
  assert.ok(count > 0, "no boundaries found");
});

test("the `<=` band is ceiled, never floored", () => {
  const sheet = readFileSync(
    "components/layout/mounted-sheet-frame-css.ts",
    "utf8",
  );
  assert.match(sheet, /\(height <= \$\{upperBoundPx\(/);
  assert.doesNotMatch(sheet, /\(height <= \$\{lowerBoundPx\(/);
});

/* A viewport on a fractional-dpr device need not sit on the layout grid, but a container's width does.
   Snapping a container bound to the grid first makes its verdict exact for every container width. */
test("a container bound gives every grid width the exact verdict, on or off the grid", () => {
  for (let k = 0; k <= GRID * 3000; k++) {
    for (const delta of [0, 1 / 1024, 1 / 256, 1 / 128, 3 / 256, 63 / 4096]) {
      const t = k / GRID + delta;
      const bound = px(containerLowerBoundPx(t));
      for (let offset = -3; offset <= 3; offset++) {
        const g = Math.round(t * GRID + offset) / GRID;
        assert.equal(g >= bound, g >= t, `>= at ${t}, grid ${g}`);
      }
    }
  }
});

test("the padding chain's container bound is the grid-snapped one", () => {
  const regime = [{ minContentWidth: 120.3, contentHeight: 100 }];
  const tier = { portrait: regime, landscape: regime };
  const fit: MeasuredFit = {
    section: "test-section",
    regimes: { phone: tier, tablet: tier, laptop: tier, desktop: tier },
  };
  /* Every card width is the regime's 120.3 plus whole-pixel padding and reveal steps, so each bound
     sits at .3 of a pixel -- off the 1/64 grid -- whichever padding the chain emits. */
  const bounds = [
    ...mountedSheetFrameCss(fit, false, "single").matchAll(
      /@container \(width >= ([\d.]+px)\)/g,
    ),
  ].map((match) => match[1]);
  assert.ok(bounds.length > 0, "no container bound emitted");
  for (const bound of bounds) {
    const unsnapped = 120.3 + Math.round(px(bound) - 120.3);
    assert.notEqual(lowerBoundPx(unsnapped), containerLowerBoundPx(unsnapped));
    assert.equal(bound, containerLowerBoundPx(unsnapped));
  }
});
