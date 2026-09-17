import assert from "node:assert/strict";
import { test } from "node:test";
import {
  type FitRegime,
  type MeasuredFit,
  pairsSideBySide,
  regimesFor,
  windowClasses,
} from "./mounted-sheet-frame.ts";
import { mountedSheetFrameCss } from "./mounted-sheet-frame-css.ts";

/* Coverage for the per-orientation split (DESIGN.md → Foundations → Layout → `mounted-sheet` →
   Measured per section): the new `MeasuredFit` shape, every named validation error `assertValidFit`
   still throws under it plus the one it gained, and the two behaviours the split exists for —
   `tierLine` reading only the landscape regimes, and a landscape chain refusing content the height
   cap can never actually give it. `assertValidFit` itself is private; every throw is exercised
   through `windowClasses` or `mountedSheetFrameCss`, the same way production code reaches it. */

const TINY: readonly FitRegime[] = [
  { minContentWidth: 120, contentHeight: 100 },
];

/* Comfortably framable at every tier: small enough that no ground tier's tier line or card-cap
   check ever binds, so a test can override one branch without the others throwing for unrelated
   reasons. */
function makeFit(
  overrides: Partial<
    Record<
      "mobile" | "tablet" | "desktop",
      Partial<Record<"portrait" | "landscape", readonly FitRegime[]>>
    >
  > = {},
  section = "test-section",
): MeasuredFit {
  const tier = (key: "mobile" | "tablet" | "desktop") => ({
    portrait: overrides[key]?.portrait ?? TINY,
    landscape: overrides[key]?.landscape ?? TINY,
  });
  return {
    section,
    regimes: {
      mobile: tier("mobile"),
      tablet: tier("tablet"),
      desktop: tier("desktop"),
    },
  };
}

/* Each top-level rule of a stylesheet, prelude and body together, found by matching braces — the
   padding chains nest `@media` and `@container` blocks, so a line split cannot tell them apart. */
function topLevelBlocks(css: string): string[] {
  const blocks: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < css.length; index++) {
    if (css[index] === "{") depth++;
    if (css[index] === "}" && --depth === 0) {
      blocks.push(css.slice(start, index + 1).trim());
      start = index + 1;
    }
  }
  return blocks;
}

test("regimesFor picks the orientation named", () => {
  const portrait: readonly FitRegime[] = [
    { minContentWidth: 1, contentHeight: 2 },
  ];
  const landscape: readonly FitRegime[] = [
    { minContentWidth: 3, contentHeight: 4 },
  ];
  const both = { portrait, landscape };
  assert.equal(regimesFor(both, "portrait"), portrait);
  assert.equal(regimesFor(both, "landscape"), landscape);
});

test("a valid two-orientation fit frames without throwing", () => {
  const classes = windowClasses(makeFit());
  assert.equal(classes.length, 7);
  for (const windowClass of classes) {
    assert.equal(windowClass.regimes.portrait, TINY);
    assert.equal(windowClass.regimes.landscape, TINY);
  }
  assert.doesNotThrow(() => mountedSheetFrameCss(makeFit(), false));
});

test("tierLine reads only the landscape regimes", () => {
  /* An enormous PORTRAIT regime at the laptop tier must not stop the section framing — a tier
     line only ever decides a landscape window. */
  const portraitOnly = makeFit({
    desktop: { portrait: [{ minContentWidth: 120, contentHeight: 100_000 }] },
  });
  assert.doesNotThrow(() => windowClasses(portraitOnly));

  /* The same figure on the LANDSCAPE side must fail — no window height can hold it under the
     laptop tier's cap-checked geometry, so there is no tier line for it. */
  const landscapeOnly = makeFit({
    desktop: { landscape: [{ minContentWidth: 120, contentHeight: 100_000 }] },
  });
  assert.throws(() => windowClasses(landscapeOnly), /cannot be framed/);
});

test("a landscape rectangle taller than the height cap is dropped, not thrown", () => {
  /* The card's landscape height is capped (frameRules), so a rule offering it more room than the
     cap can ever grant is unreachable and must be skipped — not generated, and not an error. */
  const tall = makeFit({
    mobile: {
      portrait: [{ minContentWidth: 120, contentHeight: 5000 }],
      landscape: [{ minContentWidth: 120, contentHeight: 5000 }],
    },
  });
  const short = makeFit();

  const cssTall = mountedSheetFrameCss(tall, false);
  const cssShort = mountedSheetFrameCss(short, false);

  const containerCount = (css: string) =>
    (css.match(/@container/g) ?? []).length;

  /* Both stylesheets carry the same number of window classes and the same padding-step count, so
     the only thing that can shrink the container-query count is the landscape chain(s) for the
     mobile class refusing to emit a rule for the now-tall rectangle. */
  assert.ok(
    containerCount(cssTall) < containerCount(cssShort),
    `expected fewer @container rules once mobile's landscape content exceeds the height cap (tall: ${containerCount(cssTall)}, short: ${containerCount(cssShort)})`,
  );
});

test("a landscape rectangle wider than the height cap is decided below the centring band", () => {
  /* 700 + 2 x 32 + 2 x 16 = 796px wide at the laptop tier's smallest padding: wider than the
     720px height cap, which used to fail the build. Now it counts only up to cap + 4 x ground,
     the height past which the centring gap could bind — 1104px at full laptop ground, 816px at
     halved tablet ground. */
  const wide = makeFit({
    desktop: { landscape: [{ minContentWidth: 700, contentHeight: 100 }] },
  });
  const css = mountedSheetFrameCss(wide, false);
  assert.ok(css.includes("(height <= 1104px)"), "full laptop ground band");
  assert.ok(
    css.includes("(height <= 816px)"),
    "halved touchscreen ground band",
  );
  assert.ok(
    !mountedSheetFrameCss(makeFit(), false).includes("height <="),
    "a fit with no wide rectangle carries no band",
  );
});

test("a pair is never the hero", () => {
  assert.throws(
    () => mountedSheetFrameCss(makeFit(), true, "pair"),
    /a pair is never the hero/,
  );
});

test("a pair's laptop tier lines are worked out at 1280px", () => {
  /* A pair's laptop and touchscreen tier lines start at 80rem, so the laptop line's rectangle may
     be 1280 - 4 x 48 = 1088px wide at halved laptop ground. Content 500 side by side at padding 32
     and reveal 16 is 2 x (500 + 64) + 64 = 1192 — does not fit. A single card keeps 1024: 500 + 64
     + 32 = 596, well inside 1024 - 192 = 832. */
  const tooWide = makeFit({
    desktop: { landscape: [{ minContentWidth: 500, contentHeight: 100 }] },
  });
  assert.doesNotThrow(() => windowClasses(tooWide));
  assert.throws(
    () => windowClasses(tooWide, "pair"),
    /cannot be framed[\s\S]*laptop ground tier fit its desktop content[\s\S]*1280px/,
  );

  /* Content 320 at 600 tall: 2 x (320 + 64) + 64 = 832 <= 1088, and 600 + 64 + 32 = 696 <= 720,
     so it frames. (It also clears the old 1024px limit, exactly: 832 <= 832.) */
  const framable = makeFit({
    desktop: { landscape: [{ minContentWidth: 320, contentHeight: 600 }] },
  });
  assert.doesNotThrow(() => windowClasses(framable, "pair"));

  /* Content 400 needs 2 x (400 + 64) + 64 = 992: over the old 1024px limit of 832, inside the
     1280px limit of 1088. This is the case the rule exists for. */
  const onlyFromWide = makeFit({
    desktop: { landscape: [{ minContentWidth: 400, contentHeight: 100 }] },
  });
  assert.doesNotThrow(() => windowClasses(onlyFromWide, "pair"));

  /* Tablet widths stack rather than sitting side by side, so a tablet-only regime does not throw
     for a pair. */
  const tabletFit = makeFit({
    tablet: { landscape: [{ minContentWidth: 300, contentHeight: 100 }] },
  });
  assert.doesNotThrow(() => windowClasses(tabletFit, "pair"));
});

test("a pair gives landscape laptop-width windows under 80rem the phone ground tier", () => {
  /* Mobile 1 + tablet 2 + per pointer (narrow landscape, narrow portrait, above the line, below
     it) 4 x 2 = 11. */
  const pair = windowClasses(makeFit(), "pair");
  assert.equal(pair.length, 11);
  const narrow = pair.filter((windowClass) =>
    windowClass.media.includes("(64rem <= width < 80rem)"),
  );
  assert.equal(narrow.length, 4);
  for (const windowClass of narrow) {
    assert.equal(windowClass.widthTier, "desktop");
  }
  const narrowLandscape = narrow.filter((windowClass) =>
    windowClass.media.includes("(orientation: landscape)"),
  );
  assert.equal(narrowLandscape.length, 2);
  for (const windowClass of narrowLandscape) {
    assert.equal(windowClass.groundTier.name, "phone");
    assert.equal(windowClass.portraitPossible, false);
    assert.equal(windowClass.landscapePossible, true);
  }
  const wide = pair.filter((windowClass) =>
    windowClass.media.includes("(width >= 80rem)"),
  );
  assert.equal(wide.length, 4);
  for (const windowClass of pair.filter((c) => c.widthTier === "desktop")) {
    /* The four narrow classes plus the four wide ones are every desktop class, and no narrow
       class leaves its orientation open. */
    assert.ok(
      narrow.includes(windowClass) || wide.includes(windowClass),
      windowClass.media,
    );
  }
  assert.equal(windowClasses(makeFit()).length, 7);
  assert.ok(
    !windowClasses(makeFit()).some((windowClass) =>
      windowClass.media.includes("80rem"),
    ),
  );
});

test("a pair's portrait laptop-width windows under 80rem take a single card's ground", () => {
  const narrowPortrait = windowClasses(makeFit(), "pair").filter(
    (windowClass) =>
      windowClass.media.includes("(64rem <= width < 80rem)") &&
      windowClass.media.includes("(orientation: portrait)"),
  );
  assert.equal(narrowPortrait.length, 2);
  const ground = (coarse: boolean) =>
    narrowPortrait.find(
      (windowClass) =>
        windowClass.media.includes("(not (pointer: coarse))") !== coarse,
    )?.groundTier.name;
  assert.equal(ground(false), "laptop");
  assert.equal(ground(true), "tablet");
  for (const windowClass of narrowPortrait) {
    assert.equal(windowClass.portraitPossible, true);
    assert.equal(windowClass.landscapePossible, false);
    assert.equal(pairsSideBySide("pair", windowClass, true), false);
  }

  /* Each carries only a portrait ground block, halving block and padding chain, never a landscape
     one. */
  const css = mountedSheetFrameCss(makeFit(), false, "pair");
  const blocks = topLevelBlocks(css).filter((block) =>
    block.startsWith(
      "@media (64rem <= width < 80rem) and (orientation: portrait)",
    ),
  );
  assert.ok(blocks.length > 0);
  for (const block of blocks) {
    assert.ok(!block.includes("(orientation: landscape)"), block);
  }
});

test("a pair's laptop tier lines stay below 64rem", () => {
  /* A portrait narrow class takes laptop or tablet ground with no height condition, which holds
     only while every pair tier line sits below 1024px. The height cap bounds a line at 720 plus the
     halved ground top and bottom — 816 at laptop ground, 768 at tablet — so no fit reaches 1024
     today; `windowClasses` still checks it, so a change to the caps or ground tiers fails the build.
     The tallest framable content here, 616 at padding 32 and reveal 16, makes a 712px card. */
  assert.doesNotThrow(() =>
    windowClasses(
      makeFit({
        desktop: { landscape: [{ minContentWidth: 320, contentHeight: 616 }] },
      }),
      "pair",
    ),
  );
});

test("side by side in every landscape laptop-width window", () => {
  const classes = windowClasses(makeFit(), "pair");
  const sideBySide = classes.filter((windowClass) =>
    pairsSideBySide("pair", windowClass, true),
  );
  assert.equal(sideBySide.length, 6);
  for (const windowClass of sideBySide) {
    assert.equal(windowClass.widthTier, "desktop");
  }
  /* The two narrow classes and the two below their tier line. */
  const phoneGround = sideBySide.filter(
    (windowClass) => windowClass.groundTier.name === "phone",
  );
  assert.equal(phoneGround.length, 4);
  for (const windowClass of classes) {
    assert.equal(pairsSideBySide("pair", windowClass, false), false);
    assert.equal(pairsSideBySide("single", windowClass, true), false);
  }
});

test("a pair's landscape padding chain uses side-by-side widths", () => {
  /* Desktop content 200, desktop reveal 16, side by side = 2 x (200 + 2p) + 4 x 16.
     - Laptop ground (>= 80rem, above the line), steps 96/64/48/32: 656 at 48, 720 at 64, 848 at 96.
     - Tablet ground (touchscreen, >= 80rem, above the line), steps 64/48/32: 656, 720.
     - Phone ground (64-80rem, and >= 80rem below a line), steps 32/24/16: 560 at 24, 592 at 32.
     Stacked portrait carries no reveal, so 200 + 2p: 392 at laptop 96; 248 and 264 in the narrow
     classes' portrait chains at 24 and 32 — which a single card also emits (its phone-ground
     reveal is 0), so they are not asserted as pair-only. A single card instead reads
     200 + 2p + 32: 328 / 360 / 424. */
  const fit = makeFit({
    desktop: {
      portrait: [{ minContentWidth: 200, contentHeight: 100 }],
      landscape: [{ minContentWidth: 200, contentHeight: 100 }],
    },
  });
  const pair = mountedSheetFrameCss(fit, false, "pair");
  const single = mountedSheetFrameCss(fit, false);
  assert.ok(pair.includes("@container (width >= 656px)"));
  assert.ok(pair.includes("@container (width >= 720px)"));
  assert.ok(pair.includes("@container (width >= 848px)"));
  assert.ok(pair.includes("@container (width >= 392px)"));
  assert.ok(pair.includes("@container (width >= 560px)"));
  assert.ok(pair.includes("@container (width >= 592px)"));
  assert.ok(!single.includes("@container (width >= 656px)"));
  assert.ok(!single.includes("@container (width >= 560px)"));
  assert.ok(!single.includes("@container (width >= 392px)"));

  /* The narrow classes' own landscape chain is side by side at phone steps. */
  const narrowLandscape = topLevelBlocks(pair).filter(
    (block) =>
      block.startsWith("@media (64rem <= width < 80rem)") &&
      block.includes("(orientation: landscape) {") &&
      block.includes("@container"),
  );
  assert.ok(narrowLandscape.length >= 2, String(narrowLandscape.length));
  for (const block of narrowLandscape) {
    assert.ok(block.includes("@container (width >= 560px)"), block);
    assert.ok(block.includes("@container (width >= 592px)"), block);
  }
});

test("every pair window and orientation gets exactly one layout block", () => {
  const pair = mountedSheetFrameCss(makeFit(), false, "pair");
  /* Nine classes, six of which can be portrait: 6 x 2 + 3 x 1 = 15 blocks. Every landscape
     orientation at the desktop width tier is side by side, six of them; the other nine stack —
     mobile x 2, tablet above its line x 2, tablet below x 1, and the four desktop portraits. */
  assert.equal((pair.match(/flex-direction: row;/g) ?? []).length, 6);
  assert.equal(
    (pair.match(/gap: calc\(2 \* var\(--mounted-sheet-ground\)\);/g) ?? [])
      .length,
    9,
  );
  assert.ok(pair.includes(".mounted-sheet-frame__leaf"));
  assert.ok(!mountedSheetFrameCss(makeFit(), false).includes("__leaf"));
});

test("side-by-side sheets align to the top; stacked and single cards stay centred", () => {
  const pair = mountedSheetFrameCss(makeFit(), false, "pair");
  const sideBySideBlocks = (pair.match(/flex-direction: row;/g) ?? []).length;
  assert.equal(sideBySideBlocks, 6);
  assert.equal(
    (pair.match(/justify-content: flex-start;/g) ?? []).length,
    sideBySideBlocks,
  );
  assert.ok(
    pair.includes(
      ".mounted-sheet-frame__leaf > .mounted-sheet-frame__sheet { justify-content: flex-start; }",
    ),
  );
  assert.ok(!mountedSheetFrameCss(makeFit(), false).includes("flex-start"));
});

test("a stacked pair's leaf carries no mount at any width but keeps its lift", () => {
  const pair = mountedSheetFrameCss(makeFit(), false, "pair");
  const leafRules =
    pair.match(/mounted-sheet-frame__leaf \{ min-height:[^}]*\}/g) ?? [];
  assert.equal(leafRules.length, 9);
  for (const rule of leafRules) {
    assert.ok(rule.includes("padding: var(--spacing-0)"), rule);
    assert.ok(rule.includes("background-image: none"), rule);
    assert.ok(!rule.includes("box-shadow"), rule);
  }
});

test("stacked sheets take the padding fit's steps", () => {
  /* The tablet-above-line class is never side by side (only desktop width is), so its portrait
     chain always takes the stacked branch. At the hero reveal (12 for tablet) and padding 64:
     150 + 2 x 64 + 2 x 12 = 302. */
  const own = makeFit();
  const padding = makeFit({
    tablet: { portrait: [{ minContentWidth: 150, contentHeight: 100 }] },
  });
  const withPadding = mountedSheetFrameCss(own, false, "pair", padding);
  const withoutPadding = mountedSheetFrameCss(own, false, "pair");
  assert.ok(withPadding.includes("@container (width >= 302px)"));
  assert.ok(!withoutPadding.includes("@container (width >= 302px)"));
});

test("a single card refuses a stacked padding fit", () => {
  assert.throws(
    () => mountedSheetFrameCss(makeFit(), false, "single", makeFit()),
    /stacked padding fit is only for a pair/,
  );
});

test("a malformed stacked padding fit fails validation", () => {
  assert.throws(
    // biome-ignore lint/suspicious/noExplicitAny: deliberately malformed input
    () => mountedSheetFrameCss(makeFit(), false, "pair", null as any),
    /must be an object carrying section and regimes/,
  );
});

test("a malformed fit fails validation before the hero-pair guard", () => {
  assert.throws(
    // biome-ignore lint/suspicious/noExplicitAny: deliberately malformed input
    () => mountedSheetFrameCss(null as any, true, "pair"),
    /must be an object carrying section and regimes/,
  );
});

test("rejects a fit that is not an object", () => {
  assert.throws(
    // biome-ignore lint/suspicious/noExplicitAny: deliberately malformed input
    () => windowClasses(null as any),
    /must be an object carrying section and regimes/,
  );
});

test("rejects an unknown top-level key", () => {
  const fit = { ...makeFit(), extra: true };
  // biome-ignore lint/suspicious/noExplicitAny: deliberately malformed input
  assert.throws(() => windowClasses(fit as any), /unknown key "extra"/);
});

test("rejects a malformed section name", () => {
  const fit = makeFit({}, "Not Valid!");
  assert.throws(
    () => windowClasses(fit),
    /must be lowercase letters, digits and hyphens/,
  );
});

test("rejects missing regimes", () => {
  const fit = { section: "test-section" };
  assert.throws(
    // biome-ignore lint/suspicious/noExplicitAny: deliberately malformed input
    () => windowClasses(fit as any),
    /needs a portrait and a landscape set for mobile, tablet and desktop/,
  );
});

test("rejects an unknown width tier", () => {
  const fit = makeFit();
  const malformed = {
    ...fit,
    regimes: { ...fit.regimes, phablet: { portrait: TINY, landscape: TINY } },
  };
  assert.throws(
    // biome-ignore lint/suspicious/noExplicitAny: deliberately malformed input
    () => windowClasses(malformed as any),
    /unknown width tier "phablet"/,
  );
});

test("rejects a width tier with no portrait/landscape split", () => {
  const fit = makeFit();
  const malformed = { ...fit, regimes: { ...fit.regimes, mobile: TINY } };
  assert.throws(
    // biome-ignore lint/suspicious/noExplicitAny: deliberately malformed input
    () => windowClasses(malformed as any),
    /has no mobile regimes\. Every width tier needs a portrait and a landscape set/,
  );
});

test("rejects an unknown orientation key", () => {
  const fit = makeFit();
  const malformed = {
    ...fit,
    regimes: {
      ...fit.regimes,
      mobile: { portrait: TINY, landscape: TINY, square: TINY },
    },
  };
  assert.throws(
    // biome-ignore lint/suspicious/noExplicitAny: deliberately malformed input
    () => windowClasses(malformed as any),
    /unknown orientation "square" under mobile/,
  );
});

test("rejects an orientation missing its regimes", () => {
  const fit = makeFit();
  const malformed = {
    ...fit,
    regimes: { ...fit.regimes, mobile: { portrait: TINY } },
  };
  assert.throws(
    // biome-ignore lint/suspicious/noExplicitAny: deliberately malformed input
    () => windowClasses(malformed as any),
    /mobile landscape has no regimes\. Every width tier needs its measured fit for both orientations/,
  );
});

test("rejects an empty regime list", () => {
  const fit = makeFit({ mobile: { landscape: [] } });
  assert.throws(
    () => windowClasses(fit),
    /mobile landscape has no measured regimes/,
  );
});

test("rejects a regime that is not an object", () => {
  const fit = makeFit({
    // biome-ignore lint/suspicious/noExplicitAny: deliberately malformed input
    mobile: { portrait: ["not a regime"] as any },
  });
  assert.throws(
    () => windowClasses(fit),
    /must be an object carrying minContentWidth and contentHeight/,
  );
});

test("rejects an unknown regime key", () => {
  const fit = makeFit({
    mobile: {
      // biome-ignore lint/suspicious/noExplicitAny: deliberately malformed input
      portrait: [{ minContentWidth: 120, contentHeight: 100, extra: 1 }] as any,
    },
  });
  assert.throws(() => windowClasses(fit), /unknown key "extra"/);
});

test("rejects a non-positive or non-finite regime field", () => {
  const bad = [0, -5, Number.NaN, Number.POSITIVE_INFINITY];
  for (const value of bad) {
    const fit = makeFit({
      mobile: { portrait: [{ minContentWidth: value, contentHeight: 100 }] },
    });
    assert.throws(
      () => windowClasses(fit),
      /must be a positive, finite number of pixels/,
      `minContentWidth ${value} should be rejected`,
    );
  }
});

test("rejects non-ascending regime widths", () => {
  const fit = makeFit({
    mobile: {
      portrait: [
        { minContentWidth: 200, contentHeight: 100 },
        { minContentWidth: 150, contentHeight: 90 },
      ],
    },
  });
  assert.throws(() => windowClasses(fit), /must strictly ascend/);
});

test("rejects a rising regime height", () => {
  const fit = makeFit({
    mobile: {
      portrait: [
        { minContentWidth: 120, contentHeight: 100 },
        { minContentWidth: 200, contentHeight: 150 },
      ],
    },
  });
  assert.throws(
    () => windowClasses(fit),
    /height must never rise as its width grows/,
  );
});

test("allows equal consecutive heights", () => {
  const fit = makeFit({
    mobile: {
      portrait: [
        { minContentWidth: 120, contentHeight: 100 },
        { minContentWidth: 200, contentHeight: 100 },
      ],
    },
  });
  assert.doesNotThrow(() => windowClasses(fit));
});
