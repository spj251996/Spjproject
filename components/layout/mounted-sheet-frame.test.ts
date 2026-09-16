import assert from "node:assert/strict";
import { test } from "node:test";
import {
  type FitRegime,
  type MeasuredFit,
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

test("a landscape rectangle wider than the height cap fails the build", () => {
  /* Wide enough to clear the height cap horizontally at the smallest phone padding, short enough
     to clear it vertically — the one combination `windowFits` cannot state as a media query. */
  const tooWide = makeFit({
    mobile: { landscape: [{ minContentWidth: 800, contentHeight: 50 }] },
  });
  assert.throws(
    () => mountedSheetFrameCss(tooWide, false),
    /cannot be framed[\s\S]*wider than the[\s\S]*height cap/,
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
