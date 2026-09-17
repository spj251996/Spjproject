import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CAPS,
  type FitRegime,
  type MeasuredFit,
  pairsSideBySide,
  regimesFor,
  windowClasses,
} from "./mounted-sheet-frame.ts";
import { mountedSheetFrameCss } from "./mounted-sheet-frame-css.ts";

/* `assertValidFit` is private; every throw is exercised through `windowClasses` or
   `mountedSheetFrameCss`, the way production code reaches it. */

const TINY: readonly FitRegime[] = [
  { minContentWidth: 120, contentHeight: 100 },
];

/* Comfortably framable at every tier: small enough that no ground tier's tier line or card-cap
   check ever binds, so a test can override one branch without the others throwing for unrelated
   reasons. */
function makeFit(
  overrides: Partial<
    Record<
      "mobile" | "tablet" | "desktop" | "wide",
      Partial<Record<"portrait" | "landscape", readonly FitRegime[]>>
    >
  > = {},
  section = "test-section",
): MeasuredFit {
  const tier = (key: "mobile" | "tablet" | "desktop" | "wide") => ({
    portrait: overrides[key]?.portrait ?? TINY,
    landscape: overrides[key]?.landscape ?? TINY,
  });
  return {
    section,
    regimes: {
      mobile: tier("mobile"),
      tablet: tier("tablet"),
      desktop: tier("desktop"),
      wide: tier("wide"),
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

test("a fit missing the wide regimes is rejected", () => {
  const fit = makeFit();
  const broken = { ...fit, regimes: { ...fit.regimes, wide: undefined } };
  assert.throws(
    () => windowClasses(broken as unknown as MeasuredFit, "single"),
    /wide/,
  );
});

test("a compact window takes the compact ground tier and its smallest padding", () => {
  const classes = windowClasses(makeFit(), "single");
  const compact = classes.find(
    (c) => c.widthTier === "desktop" && c.media.includes("64rem"),
  );
  assert.equal(compact?.groundTier.ground, 64);
  assert.deepEqual(compact?.groundTier.paddingSteps, [64, 48, 32, 24]);
});

test("a wide window keeps the laptop ground tier", () => {
  const classes = windowClasses(makeFit(), "single");
  const wide = classes.find((c) => c.widthTier === "wide");
  assert.equal(wide?.groundTier.ground, 96);
  assert.deepEqual(wide?.groundTier.paddingSteps, [96, 64, 48, 32]);
});

test("the caps differ by tier, and tablet keeps the full cap", () => {
  assert.equal(CAPS.desktop.height, 576);
  assert.equal(CAPS.desktop.width, 960);
  assert.equal(CAPS.wide.height, 720);
  assert.equal(CAPS.tablet.height, 720);
  assert.equal(CAPS.mobile.height, 720);
});

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
  /* Mobile 1 + tablet 2 + desktop (compact) pointer 2 + desktop touchscreen 2 + wide pointer 2 +
     wide touchscreen 2 = 11, now that the frame carries a fourth width tier. */
  assert.equal(classes.length, 11);
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
  /* 700 + 2 x 24 + 2 x 12 = 772px wide at the compact tier's smallest padding: wider than its
     576px height cap, so it counts only up to cap + 4 x ground, the height past which the
     centring gap could bind — 832px at full compact ground, 672px at halved touchscreen ground. */
  const wide = makeFit({
    desktop: { landscape: [{ minContentWidth: 700, contentHeight: 100 }] },
  });
  const css = mountedSheetFrameCss(wide, false);
  assert.ok(css.includes("(height <= 832px)"), "full compact ground band");
  assert.ok(
    css.includes("(height <= 672px)"),
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

test("a pair's compact tier lines are worked out at 1280px", () => {
  /* A pair's compact and touchscreen tier lines start at 80rem, at the compact ground tier's
     smallest padding (24) and reveal (12). Content 550 side by side is
     2 x (550 + 48) + 48 = 1244px, and 1244 + 4 x 32 (halved compact ground) = 1372 — over 1280, so
     it still cannot be framed even at the 1280px line. A single card keeps 1024: 550 + 48 + 24 =
     622, well inside 1024 - 128 = 896. */
  const tooWide = makeFit({
    desktop: { landscape: [{ minContentWidth: 550, contentHeight: 100 }] },
  });
  assert.doesNotThrow(() => windowClasses(tooWide));
  assert.throws(
    () => windowClasses(tooWide, "pair"),
    /cannot be framed[\s\S]*compact ground tier fit its desktop content[\s\S]*1280px/,
  );

  /* Content 320 frames regardless of which narrowest window the compact line is worked out at. */
  const framable = makeFit({
    desktop: { landscape: [{ minContentWidth: 320, contentHeight: 100 }] },
  });
  assert.doesNotThrow(() => windowClasses(framable, "pair"));

  /* Content 400 side by side is 2 x (400 + 48) + 48 = 944px: with 4 x 32 halved-ground clearance
     that is 1072 — over a hypothetical 1024px line, but inside the 1280px line's clearance
     (1072 <= 1280), so it frames only because the pair's line is worked out at 1280. */
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

test("a pair gives landscape compact-width windows under 80rem the phone ground tier", () => {
  /* Mobile 1 + tablet 2 + desktop (narrow band, mid band) x 2 pointers x 2 + wide x 2 pointers x
     2 = 1 + 2 + 8 + 4 = 15. */
  const pair = windowClasses(makeFit(), "pair");
  assert.equal(pair.length, 15);
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
  /* The compact tier's own band, bounded above by the wide tier's 100rem: (80rem <= width < 100rem). */
  const midBand = pair.filter((windowClass) =>
    windowClass.media.includes("(80rem <= width < 100rem)"),
  );
  assert.equal(midBand.length, 4);
  for (const windowClass of pair.filter((c) => c.widthTier === "desktop")) {
    /* The four narrow classes plus the four mid-band ones are every desktop class, and no narrow
       class leaves its orientation open. */
    assert.ok(
      narrow.includes(windowClass) || midBand.includes(windowClass),
      windowClass.media,
    );
  }
  assert.equal(windowClasses(makeFit()).length, 11);
  assert.ok(
    !windowClasses(makeFit()).some((windowClass) =>
      windowClass.media.includes("80rem"),
    ),
  );
});

test("a pair's portrait compact-width windows under 80rem take a single card's ground", () => {
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
  assert.equal(ground(false), "compact");
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

test("a pair's compact tier lines stay below 64rem", () => {
  /* A portrait narrow class takes compact or tablet ground with no height condition, which holds
     only while every pair tier line sits below 1024px. The height cap bounds a line at 576 plus the
     halved ground top and bottom — 640 at compact ground, 624 at tablet — so no fit reaches 1024;
     `windowClasses` still checks it, so a change to the caps or ground tiers fails the build.
     Content 320 at 400 tall, comfortably framable, makes a 472px card. */
  assert.doesNotThrow(() =>
    windowClasses(
      makeFit({
        desktop: { landscape: [{ minContentWidth: 320, contentHeight: 400 }] },
      }),
      "pair",
    ),
  );
});

test("side by side in every landscape compact-width or wide window", () => {
  const classes = windowClasses(makeFit(), "pair");
  const sideBySide = classes.filter((windowClass) =>
    pairsSideBySide("pair", windowClass, true),
  );
  /* The two narrow-band landscape classes, the four compact mid-band classes and the four wide
     classes — every desktop or wide class with a landscape window, now that the tier splits in
     two. */
  assert.equal(sideBySide.length, 10);
  for (const windowClass of sideBySide) {
    assert.ok(
      windowClass.widthTier === "desktop" || windowClass.widthTier === "wide",
      windowClass.media,
    );
  }
  /* Below each pointer's tier line (desktop and wide alike), plus the two narrow-band landscape
     classes, which always take phone ground. */
  const phoneGround = sideBySide.filter(
    (windowClass) => windowClass.groundTier.name === "phone",
  );
  assert.equal(phoneGround.length, 6);
  for (const windowClass of classes) {
    assert.equal(pairsSideBySide("pair", windowClass, false), false);
    assert.equal(pairsSideBySide("single", windowClass, true), false);
  }
});

test("a pair's landscape padding chain uses side-by-side widths", () => {
  /* Desktop content 200, desktop reveal 12, side by side = 2 x (200 + 2p) + 4 x 12.
     - Compact ground (>= 80rem, above the line), steps 64/48/32/24: 576 at 32, 640 at 48, 704 at 64.
     - Tablet ground (touchscreen, >= 80rem, above the line), steps 64/48/32: 640, 704 — the same
       numbers, since the two ground tiers share the 48 and 64 steps at this reveal.
     - Phone ground (64-80rem narrow band, and >= 80rem below a line), steps 32/24/16: 544 at 24,
       576 at 32.
     Stacked portrait carries no reveal, so 200 + 2p: 328 at the compact tier's largest step (64);
     248 and 264 in the narrow classes' portrait chains at 24 and 32 — which a single card also
     emits (its own reveal there is added on top), so they are not asserted as pair-only. A single
     card instead reads 200 + 2p + 24: 296 / 352. */
  const fit = makeFit({
    desktop: {
      portrait: [{ minContentWidth: 200, contentHeight: 100 }],
      landscape: [{ minContentWidth: 200, contentHeight: 100 }],
    },
  });
  const pair = mountedSheetFrameCss(fit, false, "pair");
  const single = mountedSheetFrameCss(fit, false);
  assert.ok(pair.includes("@container (width >= 576px)"));
  assert.ok(pair.includes("@container (width >= 640px)"));
  assert.ok(pair.includes("@container (width >= 704px)"));
  assert.ok(pair.includes("@container (width >= 328px)"));
  assert.ok(pair.includes("@container (width >= 544px)"));
  assert.ok(!single.includes("@container (width >= 576px)"));
  assert.ok(!single.includes("@container (width >= 544px)"));
  assert.ok(!single.includes("@container (width >= 328px)"));

  /* The narrow classes' own landscape chain is side by side at phone steps. */
  const narrowLandscape = topLevelBlocks(pair).filter(
    (block) =>
      block.startsWith("@media (64rem <= width < 80rem)") &&
      block.includes("(orientation: landscape) {") &&
      block.includes("@container"),
  );
  assert.ok(narrowLandscape.length >= 2, String(narrowLandscape.length));
  for (const block of narrowLandscape) {
    assert.ok(block.includes("@container (width >= 544px)"), block);
    assert.ok(block.includes("@container (width >= 576px)"), block);
  }
});

test("every pair window and orientation gets exactly one layout block", () => {
  const pair = mountedSheetFrameCss(makeFit(), false, "pair");
  /* 15 classes, ten of which are a landscape orientation side by side (desktop and wide alike,
     now that the tier splits in two): 21 blocks total, 10 row and 11 stacked. */
  assert.equal((pair.match(/flex-direction: row;/g) ?? []).length, 10);
  assert.equal(
    (pair.match(/gap: calc\(2 \* var\(--mounted-sheet-ground\)\);/g) ?? [])
      .length,
    11,
  );
  assert.ok(pair.includes(".mounted-sheet-frame__leaf"));
  assert.ok(!mountedSheetFrameCss(makeFit(), false).includes("__leaf"));
});

test("side-by-side sheets align to the top; stacked and single cards stay centred", () => {
  const pair = mountedSheetFrameCss(makeFit(), false, "pair");
  const sideBySideBlocks = (pair.match(/flex-direction: row;/g) ?? []).length;
  assert.equal(sideBySideBlocks, 10);
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
  assert.equal(leafRules.length, 11);
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
    /needs a portrait and a landscape set for mobile, tablet, desktop and wide/,
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
