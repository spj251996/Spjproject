import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  drawnSubpaths,
  JOIN_OVERLAP,
  MOTIF_SIDE,
  pathBounds,
  pathLength,
  THREAD_TIERS,
  threadCss,
  threadMaskRegions,
  threadScopeClass,
  threadSegments,
} from "./thread-css.ts";
import {
  composeConnectors,
  composePath,
  type SectionThread,
} from "./thread-geometry.ts";
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
    /* A segment with no measured length draws nothing and is not scrubbed. The tie is deliberate
       rather than incidental: a section whose every segment measures zero must declare no
       animation at all, so an undrawn thread can never sit on a live timeline. */
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
      if (a.name === b.name || Math.abs(aspect(a) - aspect(b)) < 1e-9) continue;
      assert.notEqual(
        composed.get(a.name),
        composed.get(b.name),
        `${a.name} and ${b.name} differ in aspect but composed identically, so the tier box was never read`,
      );
    }
  }
  /* Two tiers of the same aspect no longer compose identically, because the join allowance is a
     PIXEL length and a tier's box states its pixels too. So the aspect claim is made directly:
     hold the pixels and turn the aspect alone, and the geometry has to move. */
  const square = { width: 1000, height: 1000 };
  const tall = { width: 1000, height: 2000 };
  const shape = (box: { width: number; height: number }) =>
    threadSegments(wishes, { ...THREAD_TIERS[0], box })
      .map((segment) => (segment.kind === "connector" ? segment.d : ""))
      .join("|");
  assert.notEqual(
    shape(square),
    shape(tall),
    "the aspect alone does not move the composed geometry",
  );
});

/* `composePath` lifts the pen across each motif's footprint, so its output is one `d` holding every
   connector as its own subpath. The component renders one path per connector, and this is the guard
   that its structural walk and `composePath`'s stay the same walk. */
test("every connector the component renders is a subpath composePath drew", () => {
  for (const section of ALL_THREADS) {
    for (const tier of THREAD_TIERS) {
      const drawn = drawnSubpaths(
        composePath(section, MOTIFS, tier.box, JOIN_OVERLAP),
      );
      const connectors = threadSegments(section, tier).filter(
        (s) => s.kind === "connector",
      );
      assert.equal(
        connectors.length,
        drawn.length,
        `${section.id} at ${tier.name}: ${connectors.length} connectors against ${drawn.length} drawn subpaths`,
      );
      assert.deepEqual(
        connectors.map((s) => s.absolute),
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

/* A motif's `d` is authored in its own square and a connector's in section fractions, and the two
   conventions meet in two places: the svg the motif is drawn in, and the box its arc length is
   measured in. Both read `MOTIF_SIDE`, so both are asserted here against the drawings themselves
   rather than against a viewBox spelling. The first shipped render had the svg declaring a 0-1 box
   around a 0-100 drawing: the heart measured 13259x4989 CSS px inside a 133px field, and every gate
   was green. */
test("every motif is drawn inside its own field", () => {
  for (const motif of Object.values(MOTIFS)) {
    /* An unscaled box keeps the authored coordinates, which is the whole claim: the field the
       component renders is `MOTIF_SIDE` across, and the drawing has to be in those units. */
    const { minX, minY, maxX, maxY } = pathBounds(motif.d, {
      width: 1,
      height: 1,
    });
    assert.ok(
      minX >= 0 && minY >= 0 && maxX <= MOTIF_SIDE && maxY <= MOTIF_SIDE,
      `${motif.id} is drawn outside its field: [${minX}, ${minY}]..[${maxX}, ${maxY}] against 0..${MOTIF_SIDE}`,
    );
    /* Containment alone passes a drawing shrunk into a corner, which is the same defect seen from
       the other side — the field has to be the drawing's own square, not merely larger than it. */
    assert.ok(
      maxX - minX >= MOTIF_SIDE / 2 || maxY - minY >= MOTIF_SIDE / 2,
      `${motif.id} spans ${maxX - minX}x${maxY - minY} of a ${MOTIF_SIDE} field`,
    );
  }
});

/* The scrub divides ONE arc budget between the connectors and the motifs, so a motif measured in
   the wrong units takes the whole of it and the connectors are drawn in a few frames. */
test("a motif's measured length is commensurate with the field it is drawn in", () => {
  for (const section of ALL_THREADS) {
    for (const tier of THREAD_TIERS) {
      for (const segment of threadSegments(section, tier)) {
        if (segment.kind !== "motif") continue;
        const side =
          segment.placement.scale * Math.min(tier.box.width, tier.box.height);
        assert.ok(
          segment.length > side && segment.length < side * 10,
          `${section.id} at ${tier.name}: ${segment.motif.id} measures ${segment.length}px in a ${side}px field`,
        );
      }
    }
  }
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

/* ---- the joins ------------------------------------------------------------------------------ */

/* A window, and a section that is at least as tall as it. `svmin` is the WINDOW's shorter side
   while the section's own box is what a percentage resolves against, and the two part company as
   soon as a section is taller than one screen — which every section on the page is. */
const WINDOWS = [
  { width: 360, height: 780, section: 780 },
  { width: 390, height: 844, section: 844 },
  { width: 390, height: 844, section: 2400 },
  { width: 768, height: 1024, section: 1024 },
  { width: 834, height: 1112, section: 2000 },
  { width: 900, height: 900, section: 900 },
  { width: 1024, height: 768, section: 1600 },
  { width: 1280, height: 720, section: 720 },
  { width: 1440, height: 900, section: 900 },
  { width: 1440, height: 900, section: 3000 },
  { width: 1920, height: 900, section: 900 },
  { width: 2560, height: 900, section: 1400 },
];

type Window = (typeof WINDOWS)[number];

/* The emitted grammar and no more: `min(a, b)`, `max(a, b, c)`, `calc(<terms>)`, and terms in `%`,
   `svmin` or `px`. `size` is the section side the percentage resolves against — its width for a
   horizontal value, its height for a vertical one. */
function resolveLength(value: string, size: number, svmin: number): number {
  const trimmed = value.trim();
  for (const fn of ["min", "max"] as const) {
    if (!trimmed.startsWith(`${fn}(`)) continue;
    const parts = trimmed.slice(fn.length + 1, -1).split(",");
    const resolved = parts.map((part) => resolveLength(part, size, svmin));
    return fn === "min" ? Math.min(...resolved) : Math.max(...resolved);
  }
  const body = (
    trimmed.startsWith("calc(") ? trimmed.slice(5, -1) : trimmed
  ).replaceAll(" - ", " + -");
  let total = 0;
  for (const term of body.split(" + ")) {
    const match = /^(-?[\d.]+)(%|svmin|px)$/.exec(term.trim());
    assert.ok(match, `unreadable length term "${term}" in "${value}"`);
    const amount = Number(match[1]);
    total +=
      match[2] === "px"
        ? amount
        : (amount / 100) * (match[2] === "%" ? size : svmin);
  }
  return total;
}

test("the length resolver reads the grammar the generator emits", () => {
  const at = (value: string) => resolveLength(value, 1000, 400);
  assert.equal(at("50%"), 500);
  assert.equal(at("calc(50% - 25svmin + 2px)"), 500 - 100 + 2);
  assert.equal(at("min(calc(50% - 25svmin), 50%)"), 400);
  assert.equal(at("max(1px, calc(0% - 25svmin), calc(0% + 25svmin))"), 100);
});

/* Only the conditions the generator writes. A `@supports` block is taken as supported, since the
   claim under test is geometry, not the fallback. */
function conditionHolds(at: string, window: Window): boolean {
  if (at.startsWith("@supports")) return true;
  if (/prefers-reduced-motion/.test(at)) return false;
  const rem = window.width / 16;
  for (const [, from, , to] of at.matchAll(
    /\(\s*([\d.]+)rem\s*<=\s*width(\s*<\s*([\d.]+)rem)?\s*\)/g,
  )) {
    if (rem < Number(from)) return false;
    if (to !== undefined && rem >= Number(to)) return false;
  }
  for (const [, to] of at.matchAll(/\(\s*width\s*<\s*([\d.]+)rem\s*\)/g)) {
    if (rem >= Number(to)) return false;
  }
  for (const [, operator, ratio] of at.matchAll(
    /\(\s*aspect-ratio\s*(<|>=)\s*([\d.]+)\s*\)/g,
  )) {
    const aspect = window.width / window.height;
    if (operator === "<" ? aspect >= Number(ratio) : aspect < Number(ratio)) {
      return false;
    }
  }
  return true;
}

test("the condition reader answers the queries the generator writes", () => {
  const window = { width: 1920, height: 900, section: 900 };
  assert.equal(conditionHolds("@media (width < 48rem)", window), false);
  assert.equal(conditionHolds("@media (100rem <= width)", window), true);
  assert.equal(
    conditionHolds("@media (64rem <= width < 100rem)", window),
    false,
  );
  assert.equal(conditionHolds("@media (aspect-ratio >= 2.1)", window), true);
  assert.equal(conditionHolds("@media (aspect-ratio < 2.1)", window), false);
  assert.equal(
    conditionHolds("@supports (animation-timeline: view())", window),
    true,
  );
});

/* Every declaration that applies at one window, in cascade order — later wins, which is how the
   sheet's own tier and aspect blocks are meant to resolve. */
function declarationsAt(
  css: string,
  window: Window,
): Map<string, Record<string, string>> {
  const winning = new Map<string, Record<string, string>>();
  for (const rule of readRules(css)) {
    if (rule.at.some((at) => at.startsWith("@keyframes"))) continue;
    if (!rule.at.every((at) => conditionHolds(at, window))) continue;
    winning.set(rule.selector, {
      ...(winning.get(rule.selector) ?? {}),
      ...rule.decls,
    });
  }
  return winning;
}

/* THE defect this file exists to keep out: a connector composed against a nominal tier box, and a
   motif field sized from the real window, disagreeing about where the join is. Measured on a real
   render before the fix — 3.4px at 900x900, 12px at 1280x720, 67px at 2560x900 — and none of the
   137 tests that passed alongside it could see it.

   The claim is made against the EMITTED sheet, resolved at a window, on both sides: a connector's
   end is read out of the box the sheet pins it into and the corner its own `d` puts it at, and the
   motif's end out of the placement the same sheet declares. Neither is re-derived from the model
   they were both generated from, so a generator that composed against the wrong box would fail
   here rather than agree with itself. */
test("every join lands on the motif it meets, at every window", () => {
  for (const section of ALL_THREADS) {
    const css = threadCss(section);
    const ids = section.placements.map((placement) => placement.motif);

    for (const window of WINDOWS) {
      const applied = declarationsAt(css, window);
      const scope = `.${threadScopeClass(section.id)}`;
      const segment = (index: number) =>
        applied.get(`${scope} .thread__seg-${index}`) ?? {};
      const across = (value: string) =>
        resolveLength(
          value,
          window.width,
          Math.min(window.width, window.height),
        );
      const down = (value: string) =>
        resolveLength(
          value,
          window.section,
          Math.min(window.width, window.height),
        );

      /* Where each motif's own square puts the two points a connector has to meet. */
      const motifs = new Map<number, { x: number; y: number; side: number }>();
      let placed = 0;
      for (let index = 0; ; index += 1) {
        const decls = segment(index);
        if (Object.keys(decls).length === 0) break;
        const side = decls["--thread-motif-side"];
        if (side === undefined) continue;
        const scale = /calc\(([\d.]+) \* 100svmin\)/.exec(side);
        assert.ok(scale, `${section.id}: unreadable motif side "${side}"`);
        motifs.set(index, {
          x: Number(decls["--thread-motif-x"]) * window.width,
          y: Number(decls["--thread-motif-y"]) * window.section,
          side: Number(scale[1]) * Math.min(window.width, window.height),
        });
        placed += 1;
      }
      assert.equal(
        placed,
        section.placements.length,
        `${section.id} at ${window.width}x${window.height}: ${placed} motifs placed of ${section.placements.length}`,
      );

      for (let index = 0; ; index += 1) {
        const decls = segment(index);
        if (Object.keys(decls).length === 0) break;
        if (decls.left === undefined) continue;

        const curve = applied.get(
          `${scope} .thread__seg-${index} .thread__connector`,
        );
        assert.ok(
          curve?.d,
          `${section.id}: segment ${index} declares no curve`,
        );
        const numbers = [...curve.d.matchAll(/-?[\d.]+/g)].map((m) =>
          Number(m[0]),
        );
        const left = across(decls.left);
        const top = down(decls.top);
        const width = across(decls.width);
        const height = down(decls.height);
        const corner = (u: number, v: number) => ({
          x: left + u * width,
          y: top + v * height,
        });
        const ends = {
          from: corner(numbers[0], numbers[1]),
          to: corner(numbers[6], numbers[7]),
        };

        for (const [which, sign] of [
          ["from", -1],
          ["to", 1],
        ] as const) {
          const neighbour = motifs.get(
            which === "from" ? index - 1 : index + 1,
          );
          let expected: { x: number; y: number };
          let tangent: { x: number; y: number; angle: number };
          if (neighbour === undefined) {
            /* A terminal: the thread's own entry or exit on the section's edge. */
            const terminal = which === "from" ? section.entryX : section.exitX;
            assert.ok(
              terminal !== null,
              `${section.id}: segment ${index} has neither motif nor terminal at its ${which} end`,
            );
            tangent = { x: 0, y: 0, angle: 90 };
            expected = {
              x: terminal * window.width,
              y: which === "from" ? 0 : window.section,
            };
          } else {
            const at =
              (index +
                (which === "from" ? -1 : 1) -
                (section.entryX === null ? 0 : 1)) /
              2;
            const motif = MOTIFS[ids[at]];
            tangent = which === "from" ? motif.exit : motif.entry;
            expected = {
              x: neighbour.x + (tangent.x - 0.5) * neighbour.side,
              y: neighbour.y + (tangent.y - 0.5) * neighbour.side,
            };
          }
          const radians = (tangent.angle * Math.PI) / 180;
          const off = Math.hypot(
            ends[which].x -
              (expected.x + sign * JOIN_OVERLAP * Math.cos(radians)),
            ends[which].y -
              (expected.y + sign * JOIN_OVERLAP * Math.sin(radians)),
          );
          /* The 1px floor under a box that collapses on one axis is the only slack allowed. */
          assert.ok(
            off <= 1.001,
            `${section.id} at ${window.width}x${window.height} (section ${window.section}): segment ${index}'s ${which} end misses its join by ${off.toFixed(2)}px`,
          );
        }
      }
    }
  }
});

/* The overlap has to be stated against the thing it covers, not against itself: half of the visible
   stroke is exactly what a butt-capped mask cuts off at a join. Reading the token rather than
   restating it means a change to the stroke's width is a change to this bound. */
test("a connector overlaps its join by at least the cap the mask cuts off", () => {
  const tokens = readFileSync(
    new URL("../../app/styles/tokens.css", import.meta.url),
    "utf8",
  );
  const declared = /--stroke-thread:\s*([\d.]+)px/.exec(tokens);
  assert.ok(declared, "tokens.css declares no --stroke-thread");
  const cap = Number(declared[1]) / 2;
  assert.ok(
    JOIN_OVERLAP >= cap,
    `a join overlaps by ${JOIN_OVERLAP}px against a ${cap}px round cap`,
  );
});

/* The mask's own region is the last thing that can cut a curve, and it did: a fixed "one box-width
   past each edge" held while a connector's box was the whole section and clipped the curve the
   moment the box became the connector's own span — a control point sits many box-widths out when
   the two ends are close on one axis. Both the wipe's reach and the region have to contain the
   curve, at every tier, or the thread is cut somewhere no unit test was looking. */
test("every mask reaches past the curve it reveals, at every tier", () => {
  for (const section of ALL_THREADS) {
    const regions = threadMaskRegions(section);
    const arrangements =
      section.stacked === undefined
        ? [section.placements]
        : [section.placements, section.stacked];

    for (const placements of arrangements) {
      for (const tier of THREAD_TIERS) {
        for (const segment of threadSegments(section, tier, placements)) {
          if (segment.kind !== "connector") continue;
          const hull = [...segment.d.matchAll(/-?[\d.]+/g)].map((m) =>
            Number(m[0]),
          );
          const low = Math.min(...hull);
          const high = Math.max(...hull);
          const region = regions.get(segment.index);
          assert.ok(
            region,
            `${section.id}: segment ${segment.index} has no mask region`,
          );
          assert.ok(
            region.min <= low && region.max >= high,
            `${section.id} at ${tier.name}: the mask region [${region.min}, ${region.max}] does not hold a curve reaching [${low}, ${high}]`,
          );

          /* The wipe's own frame: `translate(a, b) scale(sx, sy)` maps the unit rect, and the axis
             it does NOT sweep has to cover the curve on that axis. */
          const frame = [...segment.frame.matchAll(/-?[\d.]+/g)].map((m) =>
            Number(m[0]),
          );
          const [tx, ty, sx, sy] = frame;
          const cross =
            segment.axis === "y" ? { at: tx, span: sx } : { at: ty, span: sy };
          const crossHull = hull.filter(
            (_, at) => at % 2 === (segment.axis === "y" ? 0 : 1),
          );
          assert.ok(
            cross.at <= Math.min(...crossHull) &&
              cross.at + cross.span >= Math.max(...crossHull),
            `${section.id} at ${tier.name}: the wipe covers [${cross.at}, ${cross.at + cross.span}] across a curve spanning [${Math.min(...crossHull)}, ${Math.max(...crossHull)}]`,
          );
        }
      }
    }
  }
});

/* At both ends of the scrub the thread is fully undrawn, and a reveal that is asked for nothing has
   to paint nothing. A zero-length dash is a dot under any cap but `butt`, and a wipe rect covers by
   its fill alone — SVG's default `stroke-width: 1` is a whole user unit, which in the wipe frame's
   space is the connector's whole span. Both are properties of the module, so both are read from
   it rather than assumed. */
test("the retracted state is asked for nothing, and paints nothing", () => {
  const module = readFileSync(
    new URL("./thread.module.css", import.meta.url),
    "utf8",
  );
  const reveal = /\.reveal\s*\{([^}]*)\}/.exec(module);
  assert.ok(reveal, "thread.module.css declares no .reveal");
  assert.match(
    reveal[1],
    /stroke-linecap:\s*butt/,
    "a zero-length dash paints a dot under any cap but butt",
  );
  assert.doesNotMatch(
    reveal[1],
    /(^|[^-])stroke:/,
    "a stroked wipe rect reveals a whole user unit past the band it was asked for",
  );

  for (const section of ALL_THREADS) {
    const css = threadCss(section);
    for (const [, name, body] of css.matchAll(
      /@keyframes\s+([\w-]+)\s*\{([^}]*(?:\}[^@]*?)*?)\n\}/g,
    )) {
      if (!name.includes("-ink-")) continue;
      for (const edge of ["0%", "100%"]) {
        const frame = new RegExp(`\\n\\s*${edge}\\s*\\{([^}]*)\\}`).exec(body);
        assert.ok(frame, `${section.id}: ${name} declares no ${edge} frame`);
        const dash = /stroke-dasharray:\s*([^;]*)/.exec(frame[1]);
        if (dash !== null) {
          const inked = dash[1]
            .trim()
            .split(/\s+/)
            .map(Number)
            .filter((_, at) => at % 2 === 0);
          assert.deepEqual(
            inked.filter((length) => length > 0),
            [],
            `${section.id}: ${name} still inks ${inked} at ${edge}`,
          );
        }
        const transform = /scale\(([^)]*)\)/.exec(frame[1]);
        if (transform !== null) {
          const [x, y] = transform[1].split(",").map(Number);
          assert.equal(
            Math.min(Math.abs(x), Math.abs(y)),
            0,
            `${section.id}: ${name} still wipes ${transform[1]} at ${edge}`,
          );
        }
      }
    }
  }
});

/* The generator picks which end of a connector is the near corner of its box. Across the window it
   can emit both and let an aspect-ratio query choose; DOWN the page it cannot, because the quantity
   that decides is the section's own height and no media query can see it. A section whose two ends
   could swap order down the page would need a thread that runs back up it. */
test("no connector's ends can swap order down the page", () => {
  for (const section of ALL_THREADS) {
    const arrangements =
      section.stacked === undefined
        ? [section.placements]
        : [section.placements, section.stacked];
    for (const placements of arrangements) {
      for (const connector of composeConnectors(section, MOTIFS, placements)) {
        const constant = connector.from.fraction.y - connector.to.fraction.y;
        const perSvmin = connector.from.svmin.y - connector.to.svmin.y;
        /* `r` is the window's shorter side over the section's height: 1 where a section is exactly
           as tall as a portrait window, and towards 0 as it grows. */
        const at = (r: number) => constant + perSvmin * r;
        assert.equal(
          Math.sign(at(1e-9)),
          Math.sign(at(1)),
          `${section.id}: a connector's ends swap order down the page between a section one screen tall and a very tall one`,
        );
      }
    }
  }
});
