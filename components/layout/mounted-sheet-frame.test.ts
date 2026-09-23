import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  CAPS,
  type FitRegime,
  fitRectangles,
  type MeasuredFit,
  type Orientation,
  pairsSideBySide,
  regimesFor,
  revealFor,
  tallWindowClasses,
  type WidthTier,
  windowClasses,
} from "./mounted-sheet-frame.ts";
import {
  mountedSheetFrameCss,
  SPACING_TOKEN,
  spacingTokenFor,
  tallFrameCss,
  tallScopeClass,
} from "./mounted-sheet-frame-css.ts";

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

/* One tall window class's own top-level block, found by its exact media prelude rather than a
   substring search — the block that carries its ground, mount and sheet rules together. `media` is
   unique per class (`tallWindowClasses`' six strings never collide), so the prelude match is exact. */
function tallBlockFor(css: string, media: string): string | undefined {
  return topLevelBlocks(css).find((block) =>
    block.startsWith(`@media ${media} {`),
  );
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

/* Every rule body written directly against a scope selector (never one of its descendants — the
   ` > .` that follows a descendant selector breaks the match), wherever it appears: bare or nested
   inside an `@media` block. These bodies are flat declaration lists with no further nesting, so a
   brace-balanced parse is unnecessary. */
function scopeSelectorBodies(css: string, scope: string): string[] {
  const escaped = scope.replace(/[.]/g, "\\.");
  const pattern = new RegExp(`${escaped} \\{([^}]*)\\}`, "g");
  return [...css.matchAll(pattern)].map((match) => match[1]);
}

/* The botanical background layer is an absolutely-positioned child of the frame scope div, isolated
   from the card by `mix-blend-mode: multiply` reading the box's stacking context, not the scope
   div's. Any of these properties on the scope div creates a stacking context there instead and
   silently breaks the blend — a spike proved the failure composites as opaque white with no error.
   `z-index` therefore belongs on `.mounted-sheet-frame__box`, never on the scope div. */
test("the frame scope div creates no stacking context; z-index sits on the box instead", () => {
  const forbidden = [
    /isolation\s*:/,
    /contain\s*:/,
    /transform\s*:/,
    /opacity\s*:/,
    /filter\s*:/,
    /content-visibility\s*:/,
    /z-index\s*:/,
  ];

  const fit = makeFit();
  const scope = ".mounted-sheet-frame--test-section";
  const cases: { css: string; scope: string }[] = [
    { css: mountedSheetFrameCss(fit, false), scope },
    { css: mountedSheetFrameCss(fit, false, "pair"), scope },
    { css: tallFrameCss(false), scope: `.${tallScopeClass(false)}` },
    { css: tallFrameCss(true), scope: `.${tallScopeClass(true)}` },
  ];

  for (const { css, scope } of cases) {
    const bodies = scopeSelectorBodies(css, scope);
    assert.ok(bodies.length > 0, `no rule bodies found for ${scope}`);
    for (const body of bodies) {
      for (const property of forbidden) {
        assert.ok(
          !property.test(body),
          `${scope} carries a stacking-context property (${property}): ${body}`,
        );
      }
    }
  }

  /* The box is the one place z-index is expected — confirms the assertion above is discriminating,
     not vacuously true because z-index never appears anywhere. */
  const boxCss = mountedSheetFrameCss(fit, false);
  assert.ok(
    boxCss.includes(
      `${scope} > .mounted-sheet-frame__box {\n  container-type: inline-size;\n  position: relative;\n  z-index: var(--z-content);`,
    ),
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
     smallest padding (24) and reveal (16). Content 550 side by side is
     2 x (550 + 48) + 64 = 1260px, and 1260 + 4 x 32 (halved compact ground) = 1388 — over 1280, so
     it still cannot be framed even at the 1280px line. A single card keeps 1024: 550 + 48 + 32 =
     630, well inside 1024 - 128 = 896. */
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
  /* Desktop content 200, desktop reveal 16, side by side = 2 x (200 + 2p) + 4 x 16.
     - Compact ground (>= 80rem, above the line), steps 64/48/32/24: 592 at 32, 656 at 48, 720 at 64.
     - Tablet ground (touchscreen, >= 80rem, above the line), steps 64/48/32: 656, 720 — the same
       numbers, since the two ground tiers share the 48 and 64 steps at this reveal.
     - Phone ground (64-80rem narrow band, and >= 80rem below a line), steps 32/24/16: 560 at 24,
       592 at 32.
     Stacked portrait carries no reveal, so 200 + 2p: 328 at the compact tier's largest step (64);
     248 and 264 in the narrow classes' portrait chains at 24 and 32. None of the stacked numbers is
     pair-only, because a single card reads 200 + 2p + 32 and its 48 step lands on 328 as well — so
     the side-by-side widths carry the whole of this test's evidence, and the stacked ones are
     asserted present rather than absent from the single card. */
  const fit = makeFit({
    desktop: {
      portrait: [{ minContentWidth: 200, contentHeight: 100 }],
      landscape: [{ minContentWidth: 200, contentHeight: 100 }],
    },
  });
  const pair = mountedSheetFrameCss(fit, false, "pair");
  const single = mountedSheetFrameCss(fit, false);
  assert.ok(pair.includes("@container (width >= 592px)"));
  assert.ok(pair.includes("@container (width >= 656px)"));
  assert.ok(pair.includes("@container (width >= 720px)"));
  assert.ok(pair.includes("@container (width >= 328px)"));
  assert.ok(pair.includes("@container (width >= 560px)"));
  assert.ok(!single.includes("@container (width >= 592px)"));
  assert.ok(!single.includes("@container (width >= 560px)"));

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
  /* 15 classes, ten of which are a landscape orientation side by side (desktop and wide alike,
     now that the tier splits in two): 21 blocks total, 10 row and 11 stacked. */
  assert.equal((pair.match(/flex-direction: row;/g) ?? []).length, 10);
  assert.equal(
    (pair.match(/gap: calc\(2 \* var\(--ground-block\)\);/g) ?? []).length,
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

/* Tall mode exists because the fitted frame refuses a section taller than its tier's height cap:
   `tierLine` keeps only rectangles clearing `CAPS[tier].height`, and a tall section has none. The
   compact tier's 576px cap binds first. If this ever stops throwing, tall mode's premise is gone. */
test("a section taller than the compact height cap cannot be framed", () => {
  const tall = makeFit({
    mobile: {
      portrait: [{ minContentWidth: 120, contentHeight: 600 }],
      landscape: [{ minContentWidth: 120, contentHeight: 600 }],
    },
    tablet: {
      portrait: [{ minContentWidth: 120, contentHeight: 600 }],
      landscape: [{ minContentWidth: 120, contentHeight: 600 }],
    },
    desktop: {
      portrait: [{ minContentWidth: 120, contentHeight: 600 }],
      landscape: [{ minContentWidth: 120, contentHeight: 600 }],
    },
    wide: {
      portrait: [{ minContentWidth: 120, contentHeight: 600 }],
      landscape: [{ minContentWidth: 120, contentHeight: 600 }],
    },
  });
  assert.throws(() => mountedSheetFrameCss(tall, false), /cannot be framed/);
});

/* Tall mode's whole promise is that the card looks like its fitted neighbours, but padded one step
   past them: full ground, one padding step above the fitted ladder's largest, the tier's own width
   cap. A tall card never has to give way, so it can afford the extra step, and at the fitted value a
   scrolling card reads as too tight (owner, 2026-09-18). These assert the four tiers' values
   directly, because a regression here is invisible on screen until someone compares two sections
   side by side. */
test("tall mode gives each tier its full ground and one padding step above its fitted largest", () => {
  const byTier = new Map(tallWindowClasses(false).map((c) => [c.media, c]));
  const phone = [...byTier.values()].find((c) => c.widthTier === "mobile");
  assert.equal(phone?.ground, 16);
  assert.equal(phone?.padding, 48);
  assert.equal(phone?.mountShows, false);

  const tablet = [...byTier.values()].find((c) => c.widthTier === "tablet");
  assert.equal(tablet?.ground, 48);
  assert.equal(tablet?.padding, 96);
  assert.equal(tablet?.mountShows, true);

  const compact = [...byTier.values()].find(
    (c) =>
      c.widthTier === "desktop" && c.media.includes("not (pointer: coarse)"),
  );
  assert.equal(compact?.ground, 64);
  assert.equal(compact?.padding, 96);

  const wide = [...byTier.values()].find(
    (c) => c.widthTier === "wide" && c.media.includes("not (pointer: coarse)"),
  );
  assert.equal(wide?.ground, 96);
  assert.equal(wide?.padding, 128);
});

test("a touchscreen from the compact tier up takes the tablet ground", () => {
  const coarse = tallWindowClasses(false).filter(
    (c) =>
      c.media.includes("(pointer: coarse)") &&
      !c.media.includes("not (pointer: coarse)"),
  );
  assert.equal(coarse.length, 2);
  for (const windowClass of coarse) assert.equal(windowClass.ground, 48);
});

test("a hero tall card keeps its mount at the phone ground tier", () => {
  const phone = tallWindowClasses(true).find((c) => c.widthTier === "mobile");
  assert.equal(phone?.mountShows, true);
  assert.equal(phone?.reveal, 16);
});

test("tall mode states no height threshold and no container query", () => {
  const css = tallFrameCss(false);
  assert.ok(css.includes(tallScopeClass(false)));
  assert.equal(/\(height/.test(css), false);
  assert.equal(/@container/.test(css), false);
  assert.equal(/min-height:\s*min\(/.test(css), false);
});

/* Ground and padding pixel values tall mode actually emits (phone 16/48, tablet 48/96, compact
   64/96, laptop 96/128), mapped to their spacing tokens the way `mounted-sheet-frame-css.ts`'s own
   (private) `SPACING_TOKEN` does. Kept separate from that map, as every other CSS-content assertion
   in this file states its expected literal by hand rather than importing the generator's internals. */
const GROUND_TOKEN: Readonly<Record<number, string>> = {
  16: "--spacing-space-sm",
  48: "--spacing-space-xl",
  64: "--spacing-space-2xl",
  96: "--spacing-space-3xl",
};
const PADDING_TOKEN: Readonly<Record<number, string>> = {
  48: "--spacing-space-xl",
  96: "--spacing-space-3xl",
  128: "--spacing-space-4xl",
};

test("each tall window class's own block binds its ground and sheet padding, never another class's", () => {
  const css = tallFrameCss(false);
  for (const windowClass of tallWindowClasses(false)) {
    const block = tallBlockFor(css, windowClass.media);
    assert.ok(block, `no block for "${windowClass.media}"`);
    assert.ok(
      block?.includes(
        `{ --mounted-sheet-ground: var(${GROUND_TOKEN[windowClass.ground]}); --ground-block: var(${GROUND_TOKEN[windowClass.ground]}); --ground-inline: var(${GROUND_TOKEN[windowClass.ground]}); }`,
      ),
      `${windowClass.media}: ground ${windowClass.ground}`,
    );
    assert.ok(
      block?.includes(
        `mounted-sheet-frame__sheet { padding: var(${PADDING_TOKEN[windowClass.padding]}); }`,
      ),
      `${windowClass.media}: padding ${windowClass.padding}`,
    );
  }
});

test("only the phone-tier block strips the mount's fill and reveal", () => {
  const strip = "background-color: transparent; background-image: none;";
  for (const hero of [false, true]) {
    const css = tallFrameCss(hero);
    for (const windowClass of tallWindowClasses(hero)) {
      const block = tallBlockFor(css, windowClass.media);
      const mountLine = block
        ?.split("\n")
        .find((line) => line.includes("mounted-sheet-frame__mount"));
      assert.ok(mountLine, `${windowClass.media}: no mount rule`);
      assert.equal(
        mountLine?.includes(strip),
        !windowClass.mountShows,
        `hero=${hero} ${windowClass.media}: mountShows ${windowClass.mountShows}`,
      );
    }
  }
});

test("the width cap binds only in landscape, and only the compact band takes the compact-cap token", () => {
  const css = tallFrameCss(false);
  const blocks = topLevelBlocks(css);

  const baseCap = blocks.find(
    (block) =>
      block.startsWith("@media (orientation: landscape) {") &&
      block.includes("width: min(var(--container-content), 100%)"),
  );
  assert.ok(baseCap, "a plain landscape rule sets the base width cap");
  assert.ok(
    !baseCap?.includes("--container-content-compact"),
    "the base cap rule never carries the compact token",
  );

  const compactCap = blocks.find(
    (block) =>
      block.startsWith(
        "@media (orientation: landscape) and (64rem <= width < 100rem) {",
      ) && block.includes("width: min(var(--container-content-compact), 100%)"),
  );
  assert.ok(
    compactCap,
    "the compact-width band overrides with the compact-cap token",
  );

  /* No rule anywhere sets either width-cap token outside a landscape-gated prelude — catches the
     cap binding in portrait as well. */
  for (const block of blocks.filter((b) =>
    b.includes("width: min(var(--container-content"),
  )) {
    assert.ok(
      block.startsWith("@media (orientation: landscape)"),
      `width-cap rule not gated by landscape: ${block}`,
    );
  }
});

test("SPACING_TOKEN agrees with app/styles/tokens.css's --spacing-* scale, in both directions, across the whole scale", () => {
  /* Parses the real stylesheet rather than trusting SPACING_TOKEN's own claim about it — the two
     maps are hand-synced (mounted-sheet-frame-css.ts's own comment on SPACING_TOKEN says so), and a
     step present in one and not the other generates CSS that resolves to nothing with every other
     gate green. */
  const tokensCssPath = fileURLToPath(
    new URL("../../app/styles/tokens.css", import.meta.url),
  );
  const tokensCss = readFileSync(tokensCssPath, "utf8");

  const cssSpacing = new Map<string, number>();
  for (const match of tokensCss.matchAll(
    /^\s*(--spacing[\w-]*):\s*(\d+)px;/gm,
  )) {
    cssSpacing.set(match[1], Number(match[2]));
  }
  assert.ok(
    cssSpacing.size >= Object.keys(SPACING_TOKEN).length,
    "the stylesheet parsed at least as many --spacing-* declarations as SPACING_TOKEN has entries",
  );

  for (const [px, token] of Object.entries(SPACING_TOKEN)) {
    assert.equal(
      cssSpacing.get(token),
      Number(px),
      `SPACING_TOKEN[${px}] = "${token}" has no matching declaration in tokens.css`,
    );
  }

  for (const [token, px] of cssSpacing) {
    assert.equal(
      SPACING_TOKEN[px],
      token,
      `tokens.css declares ${token}: ${px}px with no matching SPACING_TOKEN entry`,
    );
  }

  /* The reachable-through-the-generator path, kept as a sanity check on `spacing()`'s own throw
     behavior rather than as scale coverage — the loops above are what proves the scale. */
  assert.doesNotThrow(() => spacingTokenFor(172));
});

/* Every `--ground-block` / `--ground-inline` pair one window class declares for one orientation.
   `pressed` marks the give-way rule — the one whose prelude carries a condition beyond the
   orientation query. Matched on the exact prelude rather than a substring, since one class's media
   string is a prefix of no other's. */
function groundBands(
  css: string,
  media: string,
  orientation: Orientation,
): { pressed: boolean; block?: string; inline?: string }[] {
  const prelude = `@media ${media} and (orientation: ${orientation})`;
  return topLevelBlocks(css)
    .filter(
      (rule) =>
        rule.startsWith(`${prelude} `) || rule.startsWith(`${prelude}{`),
    )
    .filter((rule) => rule.includes("--ground-block"))
    .map((rule) => ({
      pressed: rule.slice(0, rule.indexOf("{")).trim() !== prelude,
      block: rule.match(/--ground-block: var\((--[a-z0-9-]+)\)/)?.[1],
      inline: rule.match(/--ground-inline: var\((--[a-z0-9-]+)\)/)?.[1],
    }));
}

function bandFor(
  css: string,
  media: string,
  orientation: Orientation,
  pressed: boolean,
): { block?: string; inline?: string } {
  const bands = groundBands(css, media, orientation).filter(
    (band) => band.pressed === pressed,
  );
  assert.equal(
    bands.length,
    1,
    `${media} ${orientation} pressed=${pressed}: expected one band rule, got ${bands.length}`,
  );
  return bands[0];
}

test("a portrait window sets its block and side ground independently", () => {
  const css = mountedSheetFrameCss(makeFit(), false, "single");
  const classes = windowClasses(makeFit(), "single");
  const phone = classes[0];
  const tablet = classes[1];

  const phoneBand = bandFor(css, phone.media, "portrait", false);
  assert.equal(phoneBand.block, "--spacing-space-3xl", "phone block is 96px");
  assert.equal(phoneBand.inline, "--spacing-space-md", "phone inline is 24px");
  assert.notEqual(
    phoneBand.block,
    phoneBand.inline,
    "the phone band's two axes are different numbers",
  );

  const tabletBand = bandFor(css, tablet.media, "portrait", false);
  assert.equal(
    tabletBand.block,
    "--spacing-space-5xl",
    "tablet block is 172px",
  );
  assert.equal(
    tabletBand.inline,
    "--spacing-space-4xl",
    "tablet inline is 128px",
  );
  assert.notEqual(tabletBand.block, tabletBand.inline);
});

test("a portrait window's given-way band is declared per tier, never halved", () => {
  const css = mountedSheetFrameCss(makeFit(), false, "single");
  const classes = windowClasses(makeFit(), "single");

  const phone = bandFor(css, classes[0].media, "portrait", true);
  assert.equal(
    phone.block,
    "--spacing-space-xl",
    "phone pressed block is 48px",
  );
  assert.equal(
    phone.inline,
    "--spacing-space-sm",
    "phone pressed inline is 16px, never below today's shipped side ground",
  );

  /* 172 / 2 is 86, which is off the spacing scale — a computed half would have thrown before it
     could be asserted, so reaching this line at all is half the proof. */
  const tablet = bandFor(css, classes[1].media, "portrait", true);
  assert.equal(
    tablet.block,
    "--spacing-space-3xl",
    "tablet pressed block is 96px, not 86px",
  );
  assert.equal(
    tablet.inline,
    "--spacing-space-2xl",
    "tablet pressed inline is 64px",
  );
});

test("landscape keeps one ground on both axes", () => {
  const css = mountedSheetFrameCss(makeFit(), false, "single");
  const classes = windowClasses(makeFit(), "single");

  /* A class's base rule is its landscape band: only the portrait rules narrow it, so landscape
     needs no orientation rule of its own. */
  for (const windowClass of [classes[0], classes[1]]) {
    assert.equal(
      groundBands(css, windowClass.media, "landscape").filter(
        (band) => !band.pressed,
      ).length,
      0,
      `${windowClass.media}: landscape declares no band of its own`,
    );
  }
  assert.ok(
    css.includes(
      `@media ${classes[0].media} {\n.mounted-sheet-frame--test-section { --mounted-sheet-ground: var(--spacing-space-sm); --ground-block: var(--spacing-space-sm); --ground-inline: var(--spacing-space-sm); }`,
    ),
    "the phone tier's landscape ground is unchanged at 16px on all three properties",
  );
  assert.ok(
    css.includes(
      "--ring-side: max(calc(2 * var(--mounted-sheet-ground)), calc((100svh - var(--ring-cap)) / 2))",
    ),
    "the landscape side ground still carries the centring term",
  );
});

test("the ring and the card height read the two bands, not the one ground", () => {
  const css = mountedSheetFrameCss(makeFit(), false, "single");
  assert.ok(css.includes("--ring-block: var(--ground-block);"));
  assert.ok(css.includes("--ring-side: var(--ground-inline);"));
  assert.ok(
    css.includes("min-height: calc(100svh - 2 * var(--ground-block));"),
  );
  assert.ok(
    !/min-height: calc\(100svh - 2 \* var\(--mounted-sheet-ground\)\)/.test(
      css,
    ),
    "no card height is still measured from the single ground",
  );
});

test("every emitted ground is on the spacing scale, pressed values included", () => {
  /* `groundRules` builds its give-way body as a template-literal argument, so `spacing()` runs even
     where `mediaRule` discards it for a false condition. This fails loudly if a future edit goes
     back to computing the pressed band instead of declaring it. */
  assert.doesNotThrow(() => mountedSheetFrameCss(makeFit(), false, "single"));
  assert.doesNotThrow(() => mountedSheetFrameCss(makeFit(), true, "single"));
  assert.doesNotThrow(() => mountedSheetFrameCss(makeFit(), false, "pair"));
  assert.doesNotThrow(() => tallFrameCss(false));
  assert.doesNotThrow(() => tallFrameCss(true));
});

test("a tall portrait window takes its tier's two bands", () => {
  const css = tallFrameCss(false);
  const phone = tallWindowClasses(false)[0];
  const band = bandFor(css, phone.media, "portrait", false);
  assert.equal(band.block, "--spacing-space-3xl");
  assert.equal(band.inline, "--spacing-space-md");
});

test("the padding chain's height threshold is measured from the block band, not the landscape ground", () => {
  const css = mountedSheetFrameCss(makeFit(), false, "single");
  const phone = windowClasses(makeFit(), "single")[0];
  const prelude = `@media ${phone.media} and (orientation: portrait)`;
  const chain = topLevelBlocks(css).find(
    (rule) => rule.startsWith(`${prelude} {`) && rule.includes("padding:"),
  );
  assert.ok(chain, "no portrait padding chain for the phone class");

  /* The chain asks whether the card clears a rectangle, and a portrait card is the window less its
     BLOCK band — 96px, not the 16px landscape ground. A non-hero phone card shows no mount, so its
     reveal is 0 and the chain climbs 16 → 24 → 32. */
  for (const padding of [24, 32]) {
    const [rectangle] = fitRectangles(TINY, 0, padding);
    assert.ok(
      chain?.includes(
        `@media (height >= ${rectangle.minCardHeight + 2 * 96}px)`,
      ),
      `padding ${padding}: threshold measured from the 96px block band\n${chain}`,
    );
    /* The same threshold measured from the landscape ground instead: 160px lower — exactly
       2 × (96 − 16) — which would hand the sheet a padding the card has no room for. */
    assert.ok(
      !chain?.includes(
        `@media (height >= ${rectangle.minCardHeight + 2 * 16}px)`,
      ),
      `padding ${padding}: no threshold is still measured from the landscape ground\n${chain}`,
    );
  }
});

test("a compact or laptop portrait window takes a square band derived from its landscape ground", () => {
  const css = mountedSheetFrameCss(makeFit(), false, "single");
  const covered = new Set<string>();
  for (const windowClass of windowClasses(makeFit(), "single")) {
    const tier = windowClass.groundTier;
    if (tier.name !== "compact" && tier.name !== "laptop") continue;
    if (!windowClass.portraitPossible) continue;
    covered.add(tier.name);

    /* Derived, not copied: DESIGN.md gives these two bands as "Its `Ground, landscape`", following
       that ground wherever it moves. */
    assert.equal(tier.portrait.block, tier.ground, tier.name);
    assert.equal(tier.portrait.inline, tier.ground, tier.name);
    assert.equal(tier.portrait.blockPressed, tier.ground / 2, tier.name);
    assert.equal(tier.portrait.inlinePressed, tier.ground / 2, tier.name);

    const band = bandFor(css, windowClass.media, "portrait", false);
    assert.equal(band.block, GROUND_TOKEN[tier.ground], windowClass.media);
    assert.equal(band.inline, GROUND_TOKEN[tier.ground], windowClass.media);
  }
  assert.deepEqual(
    [...covered].sort(),
    ["compact", "laptop"],
    "both square tiers have a portrait window to assert against",
  );
});

/* The mat is the one frame value the owner set by eye at each tier, and `revealFor` is the single
   place the fit arithmetic and the generated stylesheet both read it from — so the ladder is
   asserted through it rather than against `REVEAL`, which is private. The tablet rung is the
   narrowest deliberately (DESIGN.md → Foundations → Layout → `mounted-sheet`). */
test("the mat is 16 / 12 / 16 / 24 across the width tiers", () => {
  const classes = windowClasses(makeFit(), "single");
  const matFor = (widthTier: WidthTier) => {
    const windowClass = classes.find((c) => c.widthTier === widthTier);
    assert.ok(windowClass, widthTier);
    return revealFor(windowClass, true);
  };
  assert.deepEqual(
    (["mobile", "tablet", "desktop", "wide"] as const).map(matFor),
    [16, 12, 16, 24],
  );
});
