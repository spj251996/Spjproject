import assert from "node:assert/strict";
import { test } from "node:test";
import {
  drawnSubpaths,
  pathLength,
  THREAD_TIERS,
  threadCss,
  threadScopeClass,
  threadSegments,
} from "./thread-css.ts";
import { composePath, type SectionThread } from "./thread-geometry.ts";
import { MOTIFS } from "./thread-motifs.ts";
import { ALL_THREADS, SECTION_THREADS } from "./thread-placement.ts";

const wishes = SECTION_THREADS.find((s) => s.id === "wishes") as SectionThread;

/* The emitted sheet is nested at-rules over plain declaration blocks, so a test that wants to make
   a claim about a RULE rather than about a substring needs the blocks back. This reader keeps every
   rule with the at-rule conditions it sits under, which is what lets a test say "with the animation
   layer removed, every mask still declares the complete state" instead of grepping for a spelling.

   It is itself a measurement, so `the rule reader finds every block the sheet declares` below
   falsifies it against a sheet whose shape is known. */
type Rule = {
  at: readonly string[];
  selector: string;
  decls: Record<string, string>;
};

function readRules(css: string): Rule[] {
  const rules: Rule[] = [];
  let index = 0;

  function block(at: readonly string[]): void {
    while (index < css.length) {
      const brace = css.indexOf("{", index);
      const close = css.indexOf("}", index);
      if (brace === -1 || (close !== -1 && close < brace)) {
        index = close === -1 ? css.length : close + 1;
        return;
      }
      const prelude = css.slice(index, brace).trim();
      index = brace + 1;
      if (prelude.startsWith("@")) {
        block([...at, prelude]);
        continue;
      }
      const end = css.indexOf("}", index);
      const body = css.slice(index, end === -1 ? css.length : end);
      index = end === -1 ? css.length : end + 1;
      const decls: Record<string, string> = {};
      for (const declaration of body.split(";")) {
        const colon = declaration.indexOf(":");
        if (colon === -1) continue;
        decls[declaration.slice(0, colon).trim()] = declaration
          .slice(colon + 1)
          .trim();
      }
      for (const selector of prelude.split(",")) {
        rules.push({ at, selector: selector.trim(), decls });
      }
    }
  }

  block([]);
  return rules;
}

const conditional = (rule: Rule) =>
  rule.at.some((at) => at.startsWith("@media") || at.startsWith("@supports"));

test("the rule reader finds every block the sheet declares", () => {
  const rules = readRules(
    "a { color: red } @media (width > 1px) { b { color: blue; --x: 2 } @keyframes k { from { opacity: 0 } } }",
  );
  assert.deepEqual(
    rules.map((r) => [r.at.length, r.selector, r.decls]),
    [
      [0, "a", { color: "red" }],
      [1, "b", { color: "blue", "--x": "2" }],
      [2, "from", { opacity: "0" }],
    ],
  );
});

/* DESIGN.md -> Components -> Shell -> `thread-overlay`: "The complete thread is the base state, and
   the reveal subtracts from it." The test is the RULE — with every conditional layer stripped, what
   remains must already be a complete thread and must ask for no animation — not the spelling any
   one reveal mechanism happens to use. */
test("at rest the thread is complete and no animation is required to make it so", () => {
  for (const section of ALL_THREADS) {
    const rest = readRules(threadCss(section)).filter((r) => !conditional(r));
    const scope = `.${threadScopeClass(section.id)}`;

    for (const rule of rest) {
      for (const property of Object.keys(rule.decls)) {
        assert.doesNotMatch(
          property,
          /^animation/,
          `${section.id}: ${rule.selector} declares ${property} unconditionally`,
        );
      }
      assert.ok(
        rule.selector.startsWith(scope),
        `${section.id}: ${rule.selector} escapes its section scope`,
      );
    }

    /* The Wishes weave is the one at-rest exception: its two copies are COMPLEMENTARY halves of
       one complete loop, so neither is fully inked on its own. `the weave's two copies cover the
       whole loop exactly once` below is what holds them to the same rule. */
    for (const rule of rest.filter((r) => !r.selector.includes("weave"))) {
      const dash = rule.decls["stroke-dasharray"];
      if (dash !== undefined && rule.selector.includes("ink-reveal")) {
        const [gap, tail, ink] = dash.split(/\s+/).map(Number);
        assert.equal(gap, 0, `${section.id}: ${rule.selector}`);
        assert.equal(tail, 0, `${section.id}: ${rule.selector} starts inked`);
        assert.equal(ink, 1, `${section.id}: ${rule.selector} is fully inked`);
      }
      const transform = rule.decls.transform;
      if (transform !== undefined && rule.selector.includes("ink-reveal")) {
        assert.match(
          transform,
          /^translate\(0px, 0px\) scale\(1, 1\)$/,
          `${section.id}: ${rule.selector} is not a full wipe at rest`,
        );
      }
    }
  }
});

/* The spike measured that `animation-timeline: view()` on a segment times it against that segment's
   own box, which differs per segment; one NAMED timeline on the section, read by every segment, is
   the corrected mechanism. */
test("the scrub is scroll-driven off one named section timeline, never timed", () => {
  for (const section of ALL_THREADS) {
    const rules = readRules(threadCss(section));
    const named = rules.flatMap((r) =>
      r.decls["view-timeline-name"] === undefined
        ? []
        : [r.decls["view-timeline-name"]],
    );
    assert.equal(
      named.length,
      1,
      `${section.id} must name exactly one timeline`,
    );

    const timelines = rules.flatMap((r) =>
      r.decls["animation-timeline"] === undefined
        ? []
        : [r.decls["animation-timeline"]],
    );
    /* A segment with no measured length draws nothing and is not scrubbed — every motif measures
       zero until Task 6 supplies its `d`, so `not-found`, whose only segment is a motif, animates
       nothing today and will animate the moment that drawing lands. */
    const drawable = THREAD_TIERS.some((tier) =>
      threadSegments(section, tier).some((segment) => segment.length > 0),
    );
    assert.equal(
      timelines.length > 0,
      drawable,
      `${section.id}: ${timelines.length} animations against ${drawable ? "a" : "no"} drawable segment`,
    );
    for (const timeline of timelines) {
      assert.equal(
        timeline,
        named[0],
        `${section.id}: a segment reads ${timeline}, not the section's own timeline`,
      );
    }

    for (const rule of rules) {
      for (const [property, value] of Object.entries(rule.decls)) {
        if (property === "animation-duration" || property === "animation") {
          assert.doesNotMatch(
            value,
            /[0-9](ms|s)\b/,
            `${section.id}: ${property} is clock-timed`,
          );
        }
      }
    }
  }
});

test("reduced motion removes the animation and nothing else", () => {
  for (const section of ALL_THREADS) {
    const reduced = readRules(threadCss(section)).filter((r) =>
      r.at.some((at) => /prefers-reduced-motion:\s*reduce/.test(at)),
    );
    assert.ok(reduced.length > 0, `${section.id} has no reduced-motion block`);
    for (const rule of reduced) {
      assert.deepEqual(
        Object.keys(rule.decls),
        ["animation"],
        `${section.id}: ${rule.selector} changes more than the animation`,
      );
      assert.equal(rule.decls.animation, "none");
    }
  }
});

/* A motif is a square sized off the section's shorter side while its placement is a fraction of each
   axis, so the section's ASPECT enters the geometry and a connector's endpoints move with it. That
   is the whole reason geometry is composed per tier rather than once.

   Asserted as the rule, not as a magnitude: the composed connector must DIFFER wherever two tiers'
   aspects differ, and must be IDENTICAL where they agree. A threshold on how far some derived share
   swings measures the seeded placements instead — it passed while the motifs were empty and broke
   the moment they were drawn, without anything being wrong. */
test("connector geometry is composed per tier, and tracks the aspect alone", () => {
  const css = threadCss(wishes);
  for (const tier of THREAD_TIERS) {
    assert.ok(
      css.includes(`-${tier.name}`),
      `wishes emits no ${tier.name} keyframes`,
    );
  }
  const aspect = (tier: (typeof THREAD_TIERS)[number]) =>
    tier.box.width / tier.box.height;
  /* Read back the geometry the SHEET declares, never what a second call to `composePath` would
     return: the claim is that the generator composes against each tier's box, and re-deriving the
     answer here would hold even if it never passed the box at all. */
  const composed = new Map(
    THREAD_TIERS.map((tier) => {
      const start = css.indexOf(tier.media);
      assert.notEqual(start, -1, `${tier.name} has no media block`);
      const next = THREAD_TIERS.map((other) => css.indexOf(other.media))
        .filter((at) => at > start)
        .reduce((lowest, at) => Math.min(lowest, at), css.length);
      const paths = [
        ...css.slice(start, next).matchAll(/d:\s*path\(\\?"([^"\\]*)/g),
      ].map((match) => match[1]);
      assert.ok(
        paths.length > 0,
        `${tier.name} declares no connector geometry`,
      );
      return [tier.name, paths.join("|")];
    }),
  );
  for (const a of THREAD_TIERS) {
    for (const b of THREAD_TIERS) {
      if (a.name === b.name) continue;
      const sameAspect = Math.abs(aspect(a) - aspect(b)) < 1e-9;
      const samePath = composed.get(a.name) === composed.get(b.name);
      assert.equal(
        samePath,
        sameAspect,
        sameAspect
          ? `${a.name} and ${b.name} share an aspect but composed differently`
          : `${a.name} and ${b.name} differ in aspect but composed identically, so the tier box was never read`,
      );
    }
  }
});

/* `composePath` lifts the pen across each motif's footprint, so its output is one `d` holding every
   connector as its own subpath. The component renders one path per connector, and this is the guard
   that its structural walk and `composePath`'s stay the same walk. */
test("every connector the component renders is a subpath composePath drew", () => {
  for (const section of ALL_THREADS) {
    for (const tier of THREAD_TIERS) {
      const drawn = drawnSubpaths(composePath(section, MOTIFS, tier.box));
      const connectors = threadSegments(section, tier).filter(
        (s) => s.kind === "connector",
      );
      assert.equal(
        connectors.length,
        drawn.length,
        `${section.id} at ${tier.name}: ${connectors.length} connectors against ${drawn.length} drawn subpaths`,
      );
      assert.deepEqual(
        connectors.map((s) => s.d),
        drawn,
      );
    }
  }
});

/* A rect wipe is equivalent to drawing along a connector only where the connector advances
   monotonically along the axis being wiped. */
test("every connector advances monotonically along the axis its wipe sweeps", () => {
  for (const section of ALL_THREADS) {
    for (const tier of THREAD_TIERS) {
      for (const segment of threadSegments(section, tier)) {
        if (segment.kind !== "connector") continue;
        assert.ok(
          segment.monotone,
          `${section.id} at ${tier.name}: a connector reverses along its ${segment.axis} wipe`,
        );
      }
    }
  }
});

test("only family declares a stacked variant", () => {
  const stacked = ALL_THREADS.filter((t) => t.stacked !== undefined).map(
    (t) => t.id,
  );
  assert.deepEqual(stacked, ["family"]);
});

/* The stacked set is keyed to the arrangement -- below `{breakpoints.md}`, where `MountedPair` is
   `flex-col` -- never to a device tier. */
test("the stacked regime is keyed to the arrangement, not to a tier", () => {
  const css = threadCss(
    ALL_THREADS.find((t) => t.id === "family") as SectionThread,
  );
  assert.ok(css.includes("(width < 48rem)"), "family emits no stacked regime");
});

test("wishes renders two complementary weave segments", () => {
  const css = threadCss(wishes);
  assert.match(css, /--thread-weave-under/);
  assert.match(css, /--thread-weave-over/);
});

/* An under-copy beneath the illustration and an over-copy above it are complementary segments of
   ONE curve: together they draw the loop once, and neither draws any of it twice. */
test("the weave's two copies cover the whole loop exactly once", () => {
  const dashes = readRules(threadCss(wishes))
    .filter(
      (r) =>
        r.selector.includes("weave") &&
        r.decls["stroke-dasharray"] !== undefined &&
        !conditional(r),
    )
    .map((r) =>
      (r.decls["stroke-dasharray"] as string).split(/\s+/).map(Number),
    );
  assert.equal(
    dashes.length,
    2,
    "wishes must declare both weave copies at rest",
  );

  /* `0 {tail} {head - tail} 1` alternates DASH then gap, starting with a zero-length dash — which
     is why the mask copy is butt-capped, since a round cap would paint that zero as a dot. */
  const covered: [number, number][] = [];
  for (const dash of dashes) {
    let at = 0;
    for (let index = 0; index < dash.length; index += 2) {
      covered.push([at, at + dash[index]]);
      at += dash[index] + (dash[index + 1] ?? 0);
    }
  }
  covered.sort((a, b) => a[0] - b[0]);
  const inked = covered.filter(([start, end]) => end > start);
  assert.equal(inked[0][0], 0, "the loop is not inked from its start");
  assert.equal(
    inked[inked.length - 1][1],
    1,
    "the loop is not inked to its end",
  );
  for (let index = 1; index < inked.length; index += 1) {
    assert.equal(
      inked[index][0],
      inked[index - 1][1],
      "the two copies overlap or leave a gap",
    );
  }
});

/* DESIGN.md -> Foundations: every visual value is a token. The sheet computes geometry; it may
   never compute a colour or a stroke width. */
test("no emitted colour or stroke width is a literal", () => {
  for (const section of ALL_THREADS) {
    const css = threadCss(section);
    assert.doesNotMatch(css, /#[0-9a-fA-F]{3,8}\b/);
    for (const rule of readRules(css)) {
      for (const property of ["stroke", "stroke-width", "color", "z-index"]) {
        const value = rule.decls[property];
        if (value === undefined || value === "none") continue;
        assert.match(
          value,
          /var\(--/,
          `${section.id}: ${rule.selector} sets ${property} to ${value}`,
        );
      }
    }
  }
});

test("pathLength measures a scaled path in the box it is drawn in", () => {
  assert.equal(pathLength("M 0 0 L 1 0", { width: 100, height: 10 }), 100);
  assert.equal(pathLength("M 0 0 L 0 1", { width: 100, height: 10 }), 10);
  assert.equal(pathLength("M 0 0", { width: 100, height: 100 }), 0);
  assert.throws(
    () => pathLength("M 0 0 A 1 1 0 0 1 1 1", { width: 1, height: 1 }),
    /unsupported/,
  );
});

/* The scrub law: the head grows, both hold, then the TAIL eats forward. A retract that shortens the
   band from the far end instead would read as the thread pulling back the way it came. */
test("the inked band's start never moves backwards across a segment's keyframes", () => {
  for (const section of ALL_THREADS) {
    const css = threadCss(section);
    const byName = new Map<string, number[]>();
    for (const rule of readRules(css)) {
      const frames = rule.at.filter((at) => at.startsWith("@keyframes"));
      if (frames.length === 0 || !frames[0].includes("-ink-")) continue;
      const transform = rule.decls.transform;
      const dash = rule.decls["stroke-dasharray"];
      const start =
        transform !== undefined
          ? Number(
              (transform.match(/translate\(([-\d.]+)px, ([-\d.]+)px\)/) ??
                [])[2] ?? Number.NaN,
            ) ||
            Number(
              (transform.match(/translate\(([-\d.]+)px, ([-\d.]+)px\)/) ??
                [])[1] ?? 0,
            )
          : Number(dash?.split(/\s+/)[1]);
      if (Number.isNaN(start)) continue;
      byName.set(frames[0], [...(byName.get(frames[0]) ?? []), start]);
    }
    assert.ok(byName.size > 0 || section.id === "not-found");
    for (const [name, starts] of byName) {
      for (let index = 1; index < starts.length; index += 1) {
        assert.ok(
          starts[index] >= starts[index - 1] - 1e-9,
          `${section.id}: ${name} moves its band start from ${starts[index - 1]} back to ${starts[index]}`,
        );
      }
    }
  }
});

/* Two `@keyframes` blocks with one name do not collide loudly: the later definition wins wherever
   both match, so an arrangement variant that reuses a tier's name is right only by accident of
   emission order — the same trap as two overlapping media bands. */
test("no two keyframes in a section's sheet share a name", () => {
  for (const section of ALL_THREADS) {
    const names = [
      ...threadCss(section).matchAll(/@keyframes\s+([\w-]+)/g),
    ].map((match) => match[1]);
    assert.deepEqual(
      names.filter((name, at) => names.indexOf(name) !== at),
      [],
      `${section.id} defines a keyframes name twice`,
    );
  }
});
