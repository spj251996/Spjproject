import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
/* Relative, with explicit `.ts`, as `mounted-sheet-frame.test.ts` imports its own subject: the test
   runner is bare `node --test` and does not read tsconfig's `paths`, so the `@/` alias the app uses
   resolves to nothing here and the file fails to load rather than failing an assertion. */
import { eventInfoFit } from "../../app/event-info-fit.ts";
import { familyFit } from "../../app/family-fit.ts";
import { wishesFit } from "../../app/wishes-fit.ts";
import {
  mountedSheetFrameCss,
  plateSelectors,
  SPACING_TOKEN,
  tallFrameCss,
} from "./mounted-sheet-frame-css.ts";

/* The inverse of the generator's own scale, built FROM it rather than written out, so a scale edit
   cannot leave this file asserting against a stale mapping. */
const PX_FOR: Record<string, number> = Object.fromEntries(
  Object.entries(SPACING_TOKEN).map(([px, token]) => [
    `var(${token})`,
    Number(px),
  ]),
);

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

/* THE OWNER'S STOCK PAIR, specified in chat over two messages (2026-10-08): the stock fill takes the
   top, bottom and OUTER reveal; the centre crease and the mount's gutter-fill both disappear; the space
   between the two stocks stays the same; the content area does not reduce. The second message corrected
   the first's reading — **the pair keeps its gap** — so what disappears is the mount SHOWING inside the
   gutter, not the gutter itself.

   Arithmetic, with the card `W` wide, the reveal `r` and the step `s`. Today side by side:
   `mount { gap: 2r; padding: r }`, `sheet { padding: s }`, left content at `[r + s, W/2 - r - s]`.
   Under stock: `mount { gap: 2r; padding: 0 }` and the sheet takes `s + r` on its three outer sides and
   `s` at the gutter, so the left plate grows to `[0, W/2 - r]` and its content stays at
   `[s + r, W/2 - r - s]` — identical, on BOTH edges. What changes is only where the content sits inside
   its own plate: `r/2` toward the card's centre, which is the owner's "at max only moves more centred
   in each stock". */
for (const [name, fit] of [
  ["event-info", eventInfoFit],
  ["family", familyFit],
] as const) {
  const plates = plateSelectors(`.mounted-sheet-frame--${fit.section}`);
  const rowRules = (css: string) =>
    [
      ...css.matchAll(/flex-direction: row; gap: ([^;]+); padding: ([^;]+);/g),
    ].map((m) => ({ gap: m[1], padding: m[2] }));

  test(`the stock pair keeps its gap and gives up its mount padding, at ${name}`, () => {
    const stock = rowRules(mountedSheetFrameCss(fit, false, "pair", "stock"));
    const painted = rowRules(mountedSheetFrameCss(fit, false, "pair", "mount"));

    assert.ok(
      stock.length > 0,
      "no side-by-side pair rule found -- re-anchor this test",
    );
    assert.strictEqual(
      stock.length,
      painted.length,
      "the stock pair emits a different number of side-by-side rules, so the two are not comparable",
    );
    for (const [i, row] of stock.entries()) {
      assert.strictEqual(
        row.padding,
        "var(--spacing-0)",
        `side-by-side stock mount ${i} still pads (${row.padding}), so its plates do not reach the card's edge`,
      );
      /* THE OWNER'S CORRECTION. An earlier draft of this work closed the gap; the gap must stay, and it
         is compared against the painted stylesheet rather than a remembered token so a reveal change
         moves both together and cannot pass this silently. */
      assert.strictEqual(
        row.gap,
        painted[i].gap,
        `gap ${i} changed (${row.gap} against ${painted[i].gap}) -- the space between the two stocks must stay the same`,
      );
      assert.notStrictEqual(
        painted[i].padding,
        "var(--spacing-0)",
        "the PAINTED pair no longer pads either -- this test's subject has moved, re-anchor it",
      );
    }
  });

  /* THE PRECONDITION, which nothing else would catch. The outer sides take `step + reveal` and the
     gutter side keeps `step`; that lands the INNER content edge where the painted pair puts it only
     because half the painted gutter equals the painted reveal. It does today — `gap: 2 * reveal`,
     `padding: reveal` — and this test exists to notice if it stops, because the failure would be a
     silent shift of the inner edge alone. It passes on its first run by design. */
  test(`the painted pair's gutter is exactly twice its reveal, at ${name}`, () => {
    const painted = rowRules(mountedSheetFrameCss(fit, false, "pair", "mount"));
    assert.ok(
      painted.length > 0,
      "no side-by-side painted rule -- re-anchor this test",
    );
    for (const [i, row] of painted.entries()) {
      const reveal = PX_FOR[row.padding];
      const gutter = PX_FOR[row.gap];
      assert.ok(
        reveal !== undefined && gutter !== undefined,
        `rule ${i} uses a spacing token this test does not know: ${row.padding} / ${row.gap}`,
      );
      assert.strictEqual(
        gutter,
        2 * reveal,
        `rule ${i}'s gutter is not twice its reveal (${gutter} against ${reveal}), so the stock plates' inner content edge no longer lands where the painted pair's does`,
      );
    }
  });

  test(`the stock plates pad asymmetrically and mirror each other, at ${name}`, () => {
    const stock = mountedSheetFrameCss(fit, false, "pair", "stock");
    const painted = mountedSheetFrameCss(fit, false, "pair", "mount");

    const padsFor = (selector: string) =>
      [
        ...stock.matchAll(
          new RegExp(
            `${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\{ padding: ([^;]+); \\}`,
            "g",
          ),
        ),
      ].map((m) => m[1]);
    const first = padsFor(plates.first);
    const second = padsFor(plates.second);
    assert.ok(
      first.length > 0,
      "no first-plate padding rule -- re-anchor this test",
    );
    assert.strictEqual(
      first.length,
      second.length,
      "the two plates have different numbers of padding rules, so they cannot be mirrors",
    );

    /* Four values split on TOP-LEVEL whitespace only: a `calc(var(--a) + var(--b))` term contains both
       spaces and parentheses, so neither a plain split nor a lookahead gets this right. */
    const sides = (value: string) => {
      const out: string[] = [];
      let depth = 0;
      let token = "";
      for (const char of value) {
        if (char === "(") depth += 1;
        if (char === ")") depth -= 1;
        if (char === " " && depth === 0) {
          if (token !== "") out.push(token);
          token = "";
          continue;
        }
        token += char;
      }
      if (token !== "") out.push(token);
      assert.strictEqual(out.length, 4, `${value} is not a four-value padding`);
      return out;
    };

    /* The added term is a painted-mount reveal where the pair stands side by side, and
       `var(--spacing-0)` where it stacks -- `revealFor` returns 0 when the mount does not show, which
       is what collapses the mirrored form back to the plain step on one code path. BOTH must occur: a
       set of only zeros would mean the side-by-side path never emits the reveal at all, which is the
       thing this test exists to check, and it would otherwise pass. */
    const reveals = new Set(rowRules(painted).map((row) => row.padding));
    const added = new Set<string>();
    for (const [i, value] of first.entries()) {
      const [top, right, bottom, left] = sides(value);
      assert.strictEqual(
        second[i],
        [top, left, bottom, right].join(" "),
        `plate ${i} is not mirrored: ${value} against ${second[i]}`,
      );
      assert.strictEqual(
        top,
        bottom,
        `plate ${i} is asymmetric vertically, which it must not be`,
      );
      assert.strictEqual(
        left,
        top,
        `plate ${i}'s three outer sides disagree, so the expansion is uneven`,
      );
      /* The gutter side keeps the plain step; the outer sides are that same step plus a painted reveal.
         Read out of the two stylesheets rather than written down: the reveal is 16 / 12 / 16 / 24 by
         tier and the step varies per rectangle, so no single number could stand here. */
      assert.ok(
        painted.includes(`padding: ${right};`),
        `plate ${i}'s gutter side (${right}) is not a step the painted pair's sheet uses`,
      );
      const parts = top.slice("calc(".length, -1).split(" + ");
      assert.strictEqual(
        parts.length,
        2,
        `plate ${i}'s outer side (${top}) is not a two-term sum`,
      );
      assert.strictEqual(
        parts[0],
        right,
        `plate ${i}'s outer side sums a different step than its gutter side uses`,
      );
      assert.ok(
        reveals.has(parts[1]) || parts[1] === "var(--spacing-0)",
        `plate ${i} adds ${parts[1]}, which is neither a reveal the painted pair's mount uses nor the stacked zero`,
      );
      added.add(parts[1]);
    }
    assert.ok(
      [...added].some((term) => term !== "var(--spacing-0)"),
      `every plate rule adds zero, so the side-by-side reveal is never emitted: ${[...added]}`,
    );
  });

  test(`the stock pair shows neither its mat nor its crease, at ${name}`, () => {
    const stock = mountedSheetFrameCss(fit, false, "pair", "stock");
    const painted = mountedSheetFrameCss(fit, false, "pair", "mount");

    assert.ok(
      !/__crease \{ display: block; \}/.test(stock),
      "the stock pair still reveals its crease, and the owner's form removes it with the mat",
    );
    assert.ok(
      /__crease \{ display: block; \}/.test(painted),
      "the painted pair no longer reveals its crease -- this test's subject has moved, re-anchor it",
    );

    /* The mat is what the band between the plates must stop showing. Side by side the MOUNT is the
       element that paints it, so under `"stock"` the mount is what must be stripped -- the inverse of
       the painted rule, where the LEAF is stripped. */
    const rowMountRules =
      stock.match(/__mount \{ flex-direction: row;[^}]*\}/g) ?? [];
    assert.ok(
      rowMountRules.length > 0,
      "no side-by-side mount rule -- re-anchor this test",
    );
    for (const [i, rule] of rowMountRules.entries()) {
      assert.match(
        rule,
        /background-color: transparent; background-image: none;/,
        `side-by-side stock mount ${i} still paints the mat, so a gutter shows between the plates`,
      );
      assert.match(
        rule,
        /box-shadow: none;/,
        `side-by-side stock mount ${i} still casts, and the plates carry the cast now`,
      );
    }
  });
}

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

/* THE GAP EVERY TEST ABOVE HAS, and it shipped a defect before this test existed. Each one calls
   `mountedSheetFrameCss(fit, hero, layout, "stock")` DIRECTLY, so they prove the generator does the
   right thing with a paint it is handed — and say nothing about whether the components hand it one.
   `mounted-pair.tsx` did not: it called `mountedSheetFrameCss(fit, false, "pair")`, so the pair's
   stylesheet was generated at the default `"mount"` however the page was configured. Every generator
   test passed, the enum threaded cleanly through six sections, `tsc` was clean because the argument is
   optional, and the lab route simply rendered a painted pair.
   It was caught by measuring the rendered page — the plates did not grow and the crease stayed
   `block` — which is why the plan asks for a render and not only a generator comparison. This test is
   the cheap version of that catch. */
test("every frame stylesheet is generated with its caller's paint", () => {
  const callers = [
    "components/layout/mounted-sheet.tsx",
    "components/layout/mounted-pair.tsx",
  ];
  let calls = 0;
  for (const file of callers) {
    const source = readFileSync(file, "utf8");
    for (const generator of ["mountedSheetFrameCss", "tallFrameCss"]) {
      for (const match of source.matchAll(
        new RegExp(`${generator}\\(([^)]*)\\)`, "g"),
      )) {
        calls += 1;
        assert.match(
          match[1],
          /\bpaint\b/,
          `${file} calls ${generator}(${match[1]}) without its paint, so that stylesheet is generated at the default whatever the caller asked for`,
        );
      }
    }
  }
  /* A zero-match scan looks exactly like a passing one. Three calls today: the fitted and tall
     branches of `mounted-sheet.tsx`, and the fitted branch of `mounted-pair.tsx`. */
  assert.ok(
    calls >= 3,
    `expected at least three generator calls, found ${calls}`,
  );
});
