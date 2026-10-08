import assert from "node:assert/strict";
import test from "node:test";
/* Relative, with explicit `.ts`, as `mounted-sheet-frame.test.ts` imports its own subject: the test
   runner is bare `node --test` and does not read tsconfig's `paths`, so the `@/` alias the app uses
   resolves to nothing here and the file fails to load rather than failing an assertion. */
import { eventInfoFit } from "../../app/event-info-fit.ts";
import { wishesFit } from "../../app/wishes-fit.ts";
import {
  mountedSheetFrameCss,
  tallFrameCss,
} from "./mounted-sheet-frame-css.ts";

/* The paint enum's own gates. Every paint is generated from ONE fit, so any difference between two
   paints' stylesheets is a difference this work introduced on purpose — and the invariant that
   licenses one set of fit files across every route is that the OUTER BOX and the CONTENT BOX are
   identical across paints (DESIGN.md → Technical Conventions → Variant Routes).

   So these tests compare the GEOMETRY declarations and ignore the paint ones. Stripping the paint is
   what makes the comparison meaningful: a whole-string equality would be trivially false, and a
   whole-string inequality says nothing about where the content lands. */
const PAINT_DECLARATIONS =
  /\s*(background-color|background-image|box-shadow|border-radius):[^;]*;/g;

function geometryOnly(css: string): string {
  return css.replace(PAINT_DECLARATIONS, "");
}

test("the stock paint changes no geometry for a single sheet", () => {
  assert.strictEqual(
    geometryOnly(mountedSheetFrameCss(wishesFit, false, "single", "stock")),
    geometryOnly(mountedSheetFrameCss(wishesFit, false, "single", "mount")),
    "the stock paint moved a geometry declaration, so the fit files no longer describe both routes",
  );
});

/* Below `{breakpoints.md}` a non-hero mount does not show, so the generator STRIPS its fill — and
   under `"stock"` the mount IS the card's painted surface, so that strip would leave the card painting
   nothing at all, the stock element having given up its own fill. The painted arm of each assertion is
   checked too: if the painted stylesheet ever stops being stripped, this test's subject has moved and
   it would otherwise pass while measuring nothing. */
test("the stock mount keeps its fill in every window class", () => {
  const stock = mountedSheetFrameCss(wishesFit, false, "single", "stock");
  assert.ok(
    !stock.includes("background-color: transparent"),
    "a stock mount is stripped somewhere, so the card paints nothing in that window",
  );
  const painted = mountedSheetFrameCss(wishesFit, false, "single", "mount");
  assert.ok(
    painted.includes("background-color: transparent"),
    "the painted mount is no longer stripped anywhere -- this test's subject has moved, re-anchor it",
  );
});

/* Celebrations is the page's one `tall` section, so a route that paints every card stock must be able
   to paint a tall one. `tallFrameCss` carries its own copy of the same fill-strip ternary, which is
   why this needs its own test rather than riding on the fitted one. */
test("a tall section accepts the stock paint", () => {
  const stock = tallFrameCss(false, "stock");
  assert.ok(
    !stock.includes("background-color: transparent"),
    "a tall stock mount is stripped, so the tall card paints nothing in that window",
  );
  assert.strictEqual(
    geometryOnly(stock),
    geometryOnly(tallFrameCss(false, "mount")),
    "the tall stock paint moved a geometry declaration",
  );
});

/* The pair is the one layout whose geometry the stock paint changes, and that change is Task 3. Until
   then the no-expansion fallback is in force and the pair's geometry must match the painted pair's
   exactly. Written now so the fallback is ASSERTED rather than assumed — Task 3 replaces this test
   rather than relaxing it. */
test("the stock pair is geometrically unchanged under the fallback", () => {
  assert.strictEqual(
    geometryOnly(mountedSheetFrameCss(eventInfoFit, false, "pair", "stock")),
    geometryOnly(mountedSheetFrameCss(eventInfoFit, false, "pair", "mount")),
    "the pair's expansion has landed, which is Task 3 -- replace this test rather than relaxing it",
  );
});

/* Under `"stock"` the LEAF is the painted plate, so the strip that clears a mount which does not show
   must not clear it. The stacked branch's own mount strip stays: there the shared mount genuinely
   shows nothing, spanning both cards plus the ground between them. */
test("the stock pair's leaf keeps its fill", () => {
  const stock = mountedSheetFrameCss(eventInfoFit, false, "pair", "stock");
  const leafRules = stock.match(/__leaf \{[^}]*\}/g) ?? [];
  assert.ok(leafRules.length > 0, "no leaf rule found -- re-anchor this test");
  for (const [index, rule] of leafRules.entries()) {
    assert.ok(
      !rule.includes("background-color: transparent"),
      `stock leaf rule ${index} is stripped, so the plate paints nothing: ${rule}`,
    );
  }
  const painted = mountedSheetFrameCss(eventInfoFit, false, "pair", "mount");
  assert.ok(
    (painted.match(/__leaf \{[^}]*background-color: transparent/g) ?? [])
      .length > 0,
    "the painted pair no longer strips any leaf -- this test's subject has moved, re-anchor it",
  );
});
