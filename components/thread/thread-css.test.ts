import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { type Band, THREAD_BANDS } from "./thread-bands.ts";
import {
  JOIN_OVERLAP,
  MOTIF_SIDE,
  pathBounds,
  pathLength,
  segmentClass,
  THREAD_CLASS,
  threadCss,
  threadMaskRegions,
  threadMounts,
  threadScopeClass,
  threadSegments,
  threadStubs,
} from "./thread-css.ts";
import type { ThreadId } from "./thread-geometry.ts";
import {
  anchorKey,
  type SectionRoute,
  THREAD_IDS,
  THREAD_ROUTES,
} from "./thread-grid.ts";
import { MOTIFS } from "./thread-motifs.ts";

/* Every surface the component mounts, not only the six page sections: `not-found` draws the
   invite's route on a screen of its own and has to satisfy the same laws. */
const ALL_IDS: readonly ThreadId[] = [...THREAD_IDS, "not-found"];

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

/* A `@keyframes` frame is not a rule that applies to anything on its own — it is data the animation
   that names it reads, and its prelude is a percentage rather than a selector. Every sheet used to
   nest its frames under `@supports`, so `conditional` happened to exclude them; `not-found`'s timed
   draw needs no `@supports`, so the exclusion has to be stated. */
const inKeyframes = (rule: Rule) =>
  rule.at.some((at) => at.startsWith("@keyframes"));

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

/* ---- per band, and every connector draws ----------------------------------------------------- */

test("geometry is emitted per band, and each band's connector geometry differs", () => {
  const css = threadCss("wishes");
  for (const band of THREAD_BANDS) {
    assert.ok(css.includes(band.id), `wishes emits no ${band.id} block`);
  }
  assert.equal(
    css.includes("tier"),
    false,
    "a tier name survived the band rewrite",
  );
});

/* A wipe reveals along an axis; a route that doubles back is revealed out of order by one. Every
   segment now draws along its own path, so nothing constrains how the owner routes. */
test("no reveal is an axis wipe", () => {
  for (const id of THREAD_IDS) {
    for (const rule of readRules(threadCss(id))) {
      if (!rule.selector.includes("reveal")) continue;
      assert.equal(
        rule.decls.transform?.includes("scale") ?? false,
        false,
        `${id}: ${rule.selector} still wipes`,
      );
    }
  }
});

/* A motif is a square sized off the section's shorter side while its cell is a fraction of each
   axis, so the section's ASPECT enters the geometry: it decides how much of the thread's one arc
   budget the motif takes against its connectors, and therefore every keyframe stop. That is the
   whole reason geometry is emitted per band rather than once.

   Asserted as the rule, not as a magnitude: a band's emitted block must DIFFER wherever two bands'
   aspects differ. A threshold on how far some derived share swings would measure the seeded routes
   instead. */
function bandBlock(css: string, band: Band): string {
  const rules = readRules(css).filter((rule) =>
    rule.at.some((at) => at.includes(`${band.id}`)),
  );
  const keyed = readRules(css).filter((rule) =>
    Object.values(rule.decls).some((value) => value.includes(`-${band.id}`)),
  );
  const block = [...rules, ...keyed].map(
    (rule) =>
      `${rule.at.join("|")} ${rule.selector} ${JSON.stringify(rule.decls)}`,
  );
  assert.ok(block.length > 0, `${band.id} emits nothing`);
  return block.join("\n");
}

test("geometry tracks the band's aspect alone", () => {
  const css = threadCss("wishes");
  const aspect = (band: Band) => band.box.width / band.box.height;
  /* Read back what the SHEET declares, never what a second composition would return: the claim is
     that the generator composes against each band's box, and re-deriving the answer here would hold
     even if it never passed the box at all. */
  const composed = new Map(
    THREAD_BANDS.map((band) => [band.id, bandBlock(css, band)] as const),
  );
  for (const a of THREAD_BANDS) {
    for (const b of THREAD_BANDS) {
      if (a.id === b.id || Math.abs(aspect(a) - aspect(b)) < 1e-9) continue;
      assert.notEqual(
        composed.get(a.id),
        composed.get(b.id),
        `${a.id} and ${b.id} differ in aspect but composed identically, so the band box was never read`,
      );
    }
  }
  /* Hold the pixels and turn the aspect alone, and the geometry has to move. */
  const shape = (box: { width: number; height: number }) =>
    threadSegments("wishes", { ...THREAD_BANDS[0], box })
      .map((segment) => `${segment.length}`)
      .join("|");
  assert.notEqual(
    shape({ width: 1000, height: 1000 }),
    shape({ width: 1000, height: 2000 }),
    "the aspect alone does not move the composed geometry",
  );
});

/* Each band's query bounds the aspect at both ends, half-open, so no aspect can match two bands —
   the overlap `thread-grid.test.ts` forbids in the model, held here in the emitted sheet. */
test("every band emits a bounded aspect query and no two can both match", () => {
  const css = threadCss("family");
  const queries = [
    ...css.matchAll(
      /@media \((?:([\d.]+) <= )?aspect-ratio(?: < ([\d.]+))?\) \{/g,
    ),
  ].map(([, from, to]) => ({
    from: from === undefined ? 0 : Number(from),
    to: to === undefined ? Number.POSITIVE_INFINITY : Number(to),
  }));
  assert.equal(queries.length, THREAD_BANDS.length);
  /* Each band's edge is EMITTED once and read by both neighbours, so the rounding that writes it
     cannot open a gap or an overlap between them — which comparing the emitted numbers to each
     other, rather than each to its own unrounded constant, is what checks. */
  for (const [at, query] of queries.entries()) {
    assert.ok(
      Math.abs(query.from - THREAD_BANDS[at].min) < 1e-4,
      `band ${at} starts at ${query.from}, not ${THREAD_BANDS[at].min}`,
    );
    if (at > 0) assert.equal(query.from, queries[at - 1].to);
  }
  for (const a of queries) {
    for (const b of queries) {
      if (a === b) continue;
      assert.equal(
        a.from < b.to && b.from < a.to,
        false,
        `[${a.from}, ${a.to}) and [${b.from}, ${b.to}) both match some aspect`,
      );
    }
  }
});

/* ---- the base state and the scrub ------------------------------------------------------------ */

/* DESIGN.md -> Components -> Shell -> `thread-overlay`: "The complete thread is the base state, and
   the reveal subtracts from it." The test is the RULE — with every conditional layer stripped, what
   remains must already be a complete thread and must ask for no animation. */
test("at rest the thread is complete and no animation is required to make it so", () => {
  for (const id of ALL_IDS) {
    const rest = readRules(threadCss(id)).filter(
      (r) => !conditional(r) && !inKeyframes(r),
    );
    const scope = `.${threadScopeClass(id)}`;

    for (const rule of rest) {
      for (const property of Object.keys(rule.decls)) {
        /* `not-found` is the one TIMED surface. Nothing scrolls there, so its draw cannot be gated
           on `animation-timeline: view()` and is declared outright — but the law is unchanged, and
           this is what holds it: the only unconditional animation it may declare is the re-trace's
           gate, which drives the LIGHT. Ignore every animation on that sheet and the ink below is
           still the complete thread the assertions further down check. */
        if (id === "not-found" && /^animation/.test(property)) {
          assert.ok(
            rule.selector.includes(THREAD_CLASS.retrace),
            `${id}: ${rule.selector} animates unconditionally outside the re-trace gate`,
          );
          continue;
        }
        assert.doesNotMatch(
          property,
          /^animation/,
          `${id}: ${rule.selector} declares ${property} unconditionally`,
        );
      }
      assert.ok(
        rule.selector.startsWith(scope),
        `${id}: ${rule.selector} escapes its section scope`,
      );
    }

    /* The Wishes weave is the one at-rest exception: its two copies are COMPLEMENTARY halves of
       one complete loop, so neither is fully inked on its own. */
    for (const rule of rest.filter((r) => !r.selector.includes("weave"))) {
      const dash = rule.decls["stroke-dasharray"];
      if (dash !== undefined && rule.selector.includes("ink-reveal")) {
        const [gap, tail, ink] = dash.split(/\s+/).map(Number);
        assert.equal(gap, 0, `${id}: ${rule.selector}`);
        assert.equal(tail, 0, `${id}: ${rule.selector} starts inked`);
        assert.equal(ink, 1, `${id}: ${rule.selector} is fully inked`);
      }
    }
  }
});

/* The spike measured that `animation-timeline: view()` on a segment times it against that segment's
   own box, which differs per segment; one NAMED timeline on the section, read by every segment, is
   the corrected mechanism. */
test("the scrub is scroll-driven off one named section timeline, never timed", () => {
  for (const id of ALL_IDS) {
    const rules = readRules(threadCss(id));
    const named = rules.flatMap((r) =>
      r.decls["view-timeline-name"] === undefined
        ? []
        : [r.decls["view-timeline-name"]],
    );

    /* `not-found` reads no timeline at all, and declaring one would be the tell that it still
       thinks it can: a single screen a wrong turn lands on never travels through the viewport, so
       a view timeline there reports no progress and the thread would never draw. */
    if (id === "not-found") {
      assert.equal(named.length, 0, "not-found must name no timeline");
      assert.equal(
        rules.filter((r) => r.decls["animation-timeline"] !== undefined).length,
        0,
        "not-found must read no timeline",
      );
      continue;
    }

    assert.equal(named.length, 1, `${id} must name exactly one timeline`);

    const timelines = rules.flatMap((r) =>
      r.decls["animation-timeline"] === undefined
        ? []
        : [r.decls["animation-timeline"]],
    );
    /* A segment with no measured length draws nothing and is not scrubbed. The tie is deliberate:
       a section whose every segment measures zero must declare no animation at all, so an undrawn
       thread can never sit on a live timeline. */
    const drawable = THREAD_BANDS.some((band) =>
      threadSegments(id, band).some((segment) => segment.length > 0),
    );
    assert.equal(
      timelines.length > 0,
      drawable,
      `${id}: ${timelines.length} animations against ${drawable ? "a" : "no"} drawable segment`,
    );
    for (const timeline of timelines) {
      assert.equal(
        timeline,
        named[0],
        `${id}: a segment reads ${timeline}, not the section's own timeline`,
      );
    }

    /* The re-trace is the ONE clock in the sheet, and it has to be one: a resting re-trace moves
       while the reader does not, so nothing about the scroll can drive it. DESIGN.md -> Foundations
       -> Motion makes its pass duration and the delay between passes "a deliberate exception to the
       duration and easing scales". What the scroll still owns is WHEN it runs — a gate on the hold
       band, read off the section's own timeline like everything else. */
    for (const rule of rules) {
      if (rule.selector.includes("retrace")) continue;
      for (const [property, value] of Object.entries(rule.decls)) {
        if (property === "animation-duration" || property === "animation") {
          assert.doesNotMatch(
            value,
            /[0-9](ms|s)\b/,
            `${id}: ${property} is clock-timed`,
          );
        }
      }
    }
  }
});

/* The one timed draw on the site, and the shape it has to have: it runs once, ends with the thread
   complete, and holds it there. A draw that looped, or that ran the retract half of the law, would
   take the heart away again on a screen the guest is still reading. */
test("not-found draws on the clock, once, and ends complete", () => {
  const css = threadCss("not-found");
  const rules = readRules(css).filter(
    (rule) => rule.decls["animation-name"] !== undefined,
  );
  assert.ok(rules.length > 0, "not-found declares no animation at all");

  for (const rule of rules) {
    assert.match(
      rule.decls["animation-duration"] ?? "",
      /^[\d.]+s$/,
      `${rule.selector} is not driven by a clock`,
    );
    assert.equal(
      rule.decls["animation-timeline"],
      undefined,
      `${rule.selector} still reads a timeline`,
    );
    /* The re-trace alone repeats; the draw runs once and its fill holds the last frame. */
    const repeats = rule.decls["animation-iteration-count"];
    assert.equal(
      repeats,
      rule.selector.includes(THREAD_CLASS.retraceReveal)
        ? "infinite"
        : undefined,
      `${rule.selector} repeats ${repeats}`,
    );
    assert.equal(rule.decls["animation-fill-mode"], "both", rule.selector);
  }

  /* The draw and the gate that opens the resting re-trace behind it run on ONE clock — a gate on a
     different duration or delay would uncover the re-trace over a thread still being drawn. */
  const timings = new Set(
    rules
      .filter((rule) => !rule.selector.includes(THREAD_CLASS.retraceReveal))
      .map(
        (rule) =>
          `${rule.decls["animation-duration"]}/${rule.decls["animation-delay"]}`,
      ),
  );
  assert.equal(timings.size, 1, `the draw runs on ${timings.size} clocks`);

  for (const [, name, body] of css.matchAll(
    /@keyframes\s+([\w-]+)\s*\{([^}]*(?:\}[^@]*?)*?)\n\}/g,
  )) {
    const last = [...body.matchAll(/\n\s*([\d.]+)%\s*\{([^}]*)\}/g)].at(-1);
    assert.ok(last, `${name} declares no frames`);
    assert.equal(Number(last[1]), 100, `${name} stops short of its own end`);
    if (name.endsWith("-retrace-gate")) {
      assert.match(last[2], /opacity:\s*1/, "the re-trace never comes to rest");
      continue;
    }
    if (!name.includes("-ink-")) continue;
    const dash = /stroke-dasharray:\s*([^;]*)/.exec(last[2]);
    assert.ok(dash, `${name} declares no dash at its end`);
    assert.deepEqual(
      dash[1].trim().split(/\s+/).map(Number),
      [0, 0, 1, 1],
      `${name} does not end with the thread complete`,
    );
  }
});

test("reduced motion removes the animation and nothing else", () => {
  for (const id of ALL_IDS) {
    const reduced = readRules(threadCss(id)).filter((r) =>
      r.at.some((at) => /prefers-reduced-motion:\s*reduce/.test(at)),
    );
    assert.ok(reduced.length > 0, `${id} has no reduced-motion block`);
    for (const rule of reduced) {
      assert.deepEqual(
        Object.keys(rule.decls),
        ["animation"],
        `${id}: ${rule.selector} changes more than the animation`,
      );
      assert.equal(rule.decls.animation, "none");
    }
  }
});

/* The handoff law, held in the emitted sheet rather than in the model: the thread leaves a section
   at its bottom edge and the next one picks it up at its top, so every section but the page's own
   two ends composes a connector that reaches the edge. */
test("only the page's first and last sections keep a wisp at rest", () => {
  const stubbed = THREAD_IDS.filter((id) =>
    threadCss(id).includes(`${"thread__stub"}--`),
  );
  assert.deepEqual(stubbed, ["invite", "wishes"]);
  assert.ok(
    threadCss("not-found").includes("thread__stub--entry"),
    "not-found is closed at both ends and keeps both wisps",
  );
  assert.ok(threadCss("not-found").includes("thread__stub--exit"));
});

/* ---- the weave -------------------------------------------------------------------------------- */

test("wishes renders two complementary weave segments", () => {
  const css = threadCss("wishes");
  assert.match(css, /--thread-weave-under/);
  assert.match(css, /--thread-weave-over/);
});

/* An under-copy beneath the illustration and an over-copy above it are complementary segments of
   ONE curve: together they draw the loop once, and neither draws any of it twice. */
test("the weave's two copies cover the whole loop exactly once", () => {
  const dashes = readRules(threadCss("wishes"))
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

/* ---- tokens and measurement ------------------------------------------------------------------ */

/* DESIGN.md -> Foundations: every visual value is a token. The sheet computes geometry; it may
   never compute a colour or a stroke width. */
test("no emitted colour or stroke width is a literal", () => {
  for (const id of ALL_IDS) {
    const css = threadCss(id);
    assert.doesNotMatch(css, /#[0-9a-fA-F]{3,8}\b/);
    for (const rule of readRules(css)) {
      for (const property of ["stroke", "stroke-width", "color", "z-index"]) {
        const value = rule.decls[property];
        if (value === undefined || value === "none") continue;
        assert.match(
          value,
          /var\(--/,
          `${id}: ${rule.selector} sets ${property} to ${value}`,
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

/* A motif's `d` is authored in its own square and a connector's in its own box, and the two
   conventions meet in two places: the svg the motif is drawn in, and the box its arc length is
   measured in. Both read `MOTIF_SIDE`. The first shipped render had the svg declaring a 0-1 box
   around a 0-100 drawing: the heart measured 13259x4989 CSS px inside a 133px field, and every gate
   was green. */
test("every motif is drawn inside its own field", () => {
  for (const motif of Object.values(MOTIFS)) {
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
  for (const id of ALL_IDS) {
    for (const band of THREAD_BANDS) {
      for (const segment of threadSegments(id, band)) {
        if (segment.kind !== "motif") continue;
        const side =
          segment.place.scale * Math.min(band.box.width, band.box.height);
        assert.ok(
          segment.length > side && segment.length < side * 10,
          `${id} at ${band.id}: ${segment.place.motif.id} measures ${segment.length}px in a ${side}px field`,
        );
      }
    }
  }
});

/* The scrub law: the head grows, both hold, then the TAIL eats forward. A retract that shortens the
   band from the far end instead would read as the thread pulling back the way it came. */
test("the inked band's start never moves backwards across a segment's keyframes", () => {
  for (const id of ALL_IDS) {
    const byName = new Map<string, number[]>();
    for (const rule of readRules(threadCss(id))) {
      const frames = rule.at.filter((at) => at.startsWith("@keyframes"));
      if (frames.length === 0 || !frames[0].includes("-ink-")) continue;
      const start = Number(rule.decls["stroke-dasharray"]?.split(/\s+/)[1]);
      if (Number.isNaN(start)) continue;
      byName.set(frames[0], [...(byName.get(frames[0]) ?? []), start]);
    }
    assert.ok(byName.size > 0, `${id} scrubs nothing`);
    for (const [name, starts] of byName) {
      for (let index = 1; index < starts.length; index += 1) {
        assert.ok(
          starts[index] >= starts[index - 1] - 1e-9,
          `${id}: ${name} moves its band start from ${starts[index - 1]} back to ${starts[index]}`,
        );
      }
    }
  }
});

/* Two `@keyframes` blocks with one name do not collide loudly: the later definition wins wherever
   both match, so a band variant that reuses another band's name is right only by accident of
   emission order — the same trap as two overlapping media bands. */
test("no two keyframes in a section's sheet share a name", () => {
  for (const id of ALL_IDS) {
    const names = [...threadCss(id).matchAll(/@keyframes\s+([\w-]+)/g)].map(
      (match) => match[1],
    );
    assert.deepEqual(
      names.filter((name, at) => names.indexOf(name) !== at),
      [],
      `${id} defines a keyframes name twice`,
    );
  }
});

/* ---- the joins ------------------------------------------------------------------------------ */

/* A window, and a section that is at least as tall as it. `svmin` is the WINDOW's shorter side
   while the section's own box is what a percentage resolves against, and the two part company as
   soon as a section is taller than one screen — which every section on the page is.

   Each band's own NOMINAL box is in the list, so the pixel-exact case is covered as well as the
   drifted ones. */
const WINDOWS = [
  ...THREAD_BANDS.map((band) => ({
    width: band.box.width,
    height: band.box.height,
    section: band.box.height,
  })),
  { width: 360, height: 780, section: 780 },
  { width: 390, height: 844, section: 2400 },
  { width: 768, height: 1024, section: 1024 },
  { width: 834, height: 1112, section: 2000 },
  { width: 900, height: 900, section: 900 },
  { width: 1024, height: 768, section: 1600 },
  { width: 1280, height: 720, section: 720 },
  { width: 1440, height: 900, section: 3000 },
  { width: 1920, height: 900, section: 900 },
  { width: 2560, height: 900, section: 1400 },
];

type Window = (typeof WINDOWS)[number];

/* Split at paren depth zero. The generator nests `min()` and `max()` inside `calc()`, so a naive
   split on "," or " - " reads the inner function's own arguments as the outer one's terms. */
function splitTop(
  body: string,
  separators: readonly string[],
): { parts: string[]; ops: string[] } {
  const parts: string[] = [];
  const ops: string[] = [];
  let depth = 0;
  let start = 0;
  for (let at = 0; at < body.length; at += 1) {
    if (body[at] === "(") depth += 1;
    else if (body[at] === ")") depth -= 1;
    else if (depth === 0) {
      const sep = separators.find((candidate) =>
        body.startsWith(candidate, at),
      );
      if (sep !== undefined) {
        parts.push(body.slice(start, at));
        ops.push(sep.trim());
        start = at + sep.length;
        at += sep.length - 1;
      }
    }
  }
  parts.push(body.slice(start));
  return { parts, ops };
}

/* True when `value` is one call to `name(...)` rather than an expression that merely starts with
   one — `min(a, b) - min(c, d)` starts with "min(" and ends with ")" and is neither. */
function wraps(value: string, name: string): boolean {
  if (!value.startsWith(`${name}(`) || !value.endsWith(")")) return false;
  let depth = 0;
  for (let at = name.length; at < value.length; at += 1) {
    if (value[at] === "(") depth += 1;
    else if (value[at] === ")") {
      depth -= 1;
      if (depth === 0) return at === value.length - 1;
    }
  }
  return false;
}

/* The emitted grammar and no more: `min(...)`, `max(...)`, `calc(<terms>)` with those nested inside
   it, and terms in `%`, `svmin` or `px`. `size` is the section side the percentage resolves against
   — its width for a horizontal value, its height for a vertical one. */
function resolveLength(value: string, size: number, svmin: number): number {
  let trimmed = value.trim();
  if (wraps(trimmed, "calc")) trimmed = trimmed.slice(5, -1).trim();

  const term = /^(-?[\d.]+)(%|svmin|px)$/.exec(trimmed);
  if (term !== null) {
    const amount = Number(term[1]);
    return term[2] === "px"
      ? amount
      : (amount / 100) * (term[2] === "%" ? size : svmin);
  }

  for (const fn of ["min", "max"] as const) {
    if (!wraps(trimmed, fn)) continue;
    const { parts } = splitTop(trimmed.slice(fn.length + 1, -1), [","]);
    const resolved = parts.map((part) => resolveLength(part, size, svmin));
    return fn === "min" ? Math.min(...resolved) : Math.max(...resolved);
  }

  const { parts, ops } = splitTop(trimmed, [" + ", " - "]);
  assert.ok(parts.length > 1, `unreadable length "${value}"`);
  let total = resolveLength(parts[0], size, svmin);
  for (const [at, op] of ops.entries()) {
    total += (op === "-" ? -1 : 1) * resolveLength(parts[at + 1], size, svmin);
  }
  return total;
}

test("the length resolver reads the grammar the generator emits", () => {
  const at = (value: string) => resolveLength(value, 1000, 400);
  assert.equal(at("50%"), 500);
  assert.equal(at("calc(50% - 25svmin + 2px)"), 500 - 100 + 2);
  assert.equal(at("min(calc(50% - 25svmin), 50%)"), 400);
  assert.equal(at("max(1px, calc(max(10%, 40%) - min(10%, 40%)))"), 300);
  assert.equal(at("max(1px, calc(max(10%) - min(10%)))"), 1);
});

/* Only the conditions the generator writes. A `@supports` block is taken as supported, since the
   claim under test is geometry, not the fallback. */
function conditionHolds(at: string, window: Window): boolean {
  if (at.startsWith("@supports")) return true;
  if (/prefers-reduced-motion/.test(at)) return false;
  const aspect = window.width / window.height;
  for (const [, from, operator, bound] of at.matchAll(
    /\(\s*(?:([\d.]+)\s*<=\s*)?aspect-ratio(?:\s*(<|>=)\s*([\d.]+))?\s*\)/g,
  )) {
    if (from !== undefined && aspect < Number(from)) return false;
    if (operator === "<" && aspect >= Number(bound)) return false;
    if (operator === ">=" && aspect < Number(bound)) return false;
  }
  return true;
}

test("the condition reader answers the queries the generator writes", () => {
  const window = { width: 1920, height: 900, section: 900 };
  assert.equal(
    conditionHolds("@media (1.33333 <= aspect-ratio)", window),
    true,
  );
  assert.equal(
    conditionHolds("@media (aspect-ratio < 0.62462)", window),
    false,
  );
  assert.equal(
    conditionHolds("@media (0.62462 <= aspect-ratio < 1.33333)", window),
    false,
  );
  assert.equal(
    conditionHolds("@supports (animation-timeline: view())", window),
    true,
  );
});

/* Every declaration that applies at one window, in cascade order — later wins, which is how the
   sheet's own band blocks are meant to resolve. */
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

function bandFor(window: Window): Band {
  const aspect = window.width / window.height;
  const band = THREAD_BANDS.find(
    (candidate) => aspect >= candidate.min && aspect < candidate.max,
  );
  assert.ok(band, `no band holds aspect ${aspect}`);
  return band;
}

/* An anchored motif's position is emitted as `var(--thread-anchor-<key>-<axis>, <cell>)` — the
   measured position with its authored cell as the fallback. Every claim in this file is made
   against the CELL, because the cell is the only position a connector is composed against. A
   resolved anchor moves the motif off that connector by however far the content sits from its cell;
   that is an open item for the tuning pass, not something this reader is hiding. */
function motifFraction(value: string): number {
  const fallback = /^var\(--[\w-]+,\s*([-\d.]+)\)$/.exec(value.trim());
  return Number(fallback === null ? value : fallback[1]);
}

/* The fallback is the whole contract: a motif whose anchor never resolves — no script, a blocked
   script, a selector that matches nothing — has to land on its authored cell rather than at 0,0 or
   nowhere. Asserted as a RULE over every emitted motif rather than on three known selectors, so a
   stop that gains an anchor later cannot quietly ship without one. */
test("an anchored motif reads through its anchor and falls back to its own cell", () => {
  let anchored = 0;
  for (const id of ALL_IDS) {
    const css = threadCss(id);
    for (const window of WINDOWS) {
      const applied = declarationsAt(css, window);
      const band = bandFor(window);
      const route = THREAD_ROUTES.find(
        (candidate) =>
          candidate.id === (id === "not-found" ? "invite" : id) &&
          candidate.band === band.id,
      );
      assert.ok(route, `${id}: no route in band ${band.id}`);

      const stops = route.stops.filter((stop) => stop.motif !== undefined);
      const segments = threadSegments(id, band).filter(
        (segment) => segment.kind === "motif",
      );
      assert.equal(segments.length, stops.length);

      for (const [at, segment] of segments.entries()) {
        const decls =
          applied.get(`.${threadScopeClass(id)} .${segmentClass(segment)}`) ??
          {};
        for (const axis of ["x", "y"] as const) {
          const emitted = decls[`--thread-motif-${axis}`];
          assert.ok(emitted, `${id}: segment ${segment.index} has no ${axis}`);
          const cell = segment.place[axis];
          assert.ok(
            Math.abs(motifFraction(emitted) - cell) < 1e-4,
            `${id}: segment ${segment.index} falls back to ${emitted}, not its cell ${cell}`,
          );
          const anchor = stops[at].anchor;
          if (anchor === undefined) {
            assert.equal(emitted.includes("var("), false);
            continue;
          }
          assert.equal(
            emitted.startsWith(
              `var(--thread-anchor-${anchorKey(anchor)}-${axis},`,
            ),
            true,
            `${id}: segment ${segment.index} does not read its anchor: ${emitted}`,
          );
          anchored += 1;
        }
      }
    }
  }
  assert.ok(anchored > 0, "no motif anchors, so nothing was proved");
});

/* THE defect this file exists to keep out: a connector composed against a nominal box, and a motif
   field sized from the real window, disagreeing about where the join is. Measured on a real render
   before the fix — 3.4px at 900x900, 12px at 1280x720, 67px at 2560x900 — and none of the 137 tests
   that passed alongside it could see it.

   The claim is made against the EMITTED sheet, resolved at a window, on both sides: a connector's
   end is read out of the box the sheet pins it into and the corner its own `d` puts it at, and the
   motif's end out of the placement and the rotation the same sheet declares. Neither is re-derived
   from the model they were both generated from, so a generator that composed against the wrong box
   would fail here rather than agree with itself. */
test("every join lands on the motif it meets, at every window", () => {
  for (const id of ALL_IDS) {
    const css = threadCss(id);

    for (const window of WINDOWS) {
      const applied = declarationsAt(css, window);
      const scope = `.${threadScopeClass(id)}`;
      const segments = threadSegments(id, bandFor(window));
      const at = (segment: (typeof segments)[number]) =>
        applied.get(`${scope} .${segmentClass(segment)}`) ?? {};
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

      /* Where each motif's own square puts the two points a connector has to meet — read out of
         the sheet, turned by the rotation the sheet declares. */
      const motifs = new Map<number, { x: number; y: number; side: number }>();
      for (const segment of segments) {
        if (segment.kind !== "motif") continue;
        const decls = at(segment);
        const side = decls["--thread-motif-side"];
        assert.ok(
          side,
          `${id}: segment ${segment.index} declares no motif side`,
        );
        const scale = /calc\(([\d.]+) \* 100svmin\)/.exec(side);
        assert.ok(scale, `${id}: unreadable motif side "${side}"`);
        motifs.set(segment.index, {
          x: motifFraction(decls["--thread-motif-x"]) * window.width,
          y: motifFraction(decls["--thread-motif-y"]) * window.section,
          side: Number(scale[1]) * Math.min(window.width, window.height),
        });
      }

      for (const segment of segments) {
        if (segment.kind !== "connector") continue;
        const decls = at(segment);
        assert.ok(decls.left, `${id}: segment ${segment.index} has no box`);

        const curve = applied.get(
          `${scope} .${segmentClass(segment)} .thread__connector`,
        );
        assert.ok(
          curve?.d,
          `${id}: segment ${segment.index} declares no curve`,
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
          to: corner(numbers[numbers.length - 2], numbers[numbers.length - 1]),
        };

        for (const [which, sign] of [
          ["from", -1],
          ["to", 1],
        ] as const) {
          const neighbour = motifs.get(
            which === "from" ? segment.index - 1 : segment.index + 1,
          );
          if (neighbour === undefined) continue;
          const sibling =
            segments[which === "from" ? segment.index - 1 : segment.index + 1];
          assert.ok(sibling.kind === "motif");
          const declared =
            which === "from"
              ? sibling.place.motif.exit
              : sibling.place.motif.entry;
          const tangent = (declared.angle * Math.PI) / 180;
          const expected = {
            x:
              neighbour.x +
              (declared.x - 0.5) * neighbour.side +
              sign * JOIN_OVERLAP * Math.cos(tangent),
            y:
              neighbour.y +
              (declared.y - 0.5) * neighbour.side +
              sign * JOIN_OVERLAP * Math.sin(tangent),
          };
          const off = Math.hypot(
            ends[which].x - expected.x,
            ends[which].y - expected.y,
          );
          /* The 1px floor under a box that collapses on one axis is the only slack allowed. */
          assert.ok(
            off <= 1.001,
            `${id} at ${window.width}x${window.height} (section ${window.section}): segment ${segment.index}'s ${which} end misses its join by ${off.toFixed(2)}px`,
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
   the two ends are close on one axis. */
test("every mask reaches past the curve it reveals, at every band", () => {
  /* Under the DIVERGENT route as well as the seeded ones: a `<mask>`'s region is markup and so is
     one value for all three bands, and while the bands agree a region narrowed to the first band
     is indistinguishable from the widest. */
  check();
  withDivergentWideRoute(check);

  function check() {
    for (const id of ALL_IDS) {
      const regions = threadMaskRegions(id);
      for (const band of THREAD_BANDS) {
        for (const segment of threadSegments(id, band)) {
          if (segment.kind !== "connector") continue;
          const hull = [...segment.d.matchAll(/-?[\d.]+/g)].map((m) =>
            Number(m[0]),
          );
          const region = regions.get(segmentClass(segment));
          assert.ok(
            region,
            `${id}: segment ${segment.index} has no mask region`,
          );
          assert.ok(
            region.min <= Math.min(...hull) - segment.maskWidth / 2 &&
              region.max >= Math.max(...hull) + segment.maskWidth / 2,
            `${id} at ${band.id}: the mask region [${region.min}, ${region.max}] does not hold a curve reaching [${Math.min(...hull)}, ${Math.max(...hull)}] stroked ${segment.maskWidth} wide`,
          );
        }
      }
    }
  }
});

/* At both ends of the scrub the thread is fully undrawn, and a reveal that is asked for nothing has
   to paint nothing. A zero-length dash is a dot under any cap but `butt`, and a FILLED copy of an
   open curve floods the mask with everything its two ends enclose. Both are properties of the
   module, so both are read from it rather than assumed. */
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
  assert.match(
    reveal[1],
    /fill:\s*none/,
    "a filled copy of an open curve reveals everything its ends enclose",
  );
  assert.match(reveal[1], /stroke:\s*white/, "a reveal covers by its stroke");

  for (const id of ALL_IDS) {
    for (const [, name, body] of threadCss(id).matchAll(
      /@keyframes\s+([\w-]+)\s*\{([^}]*(?:\}[^@]*?)*?)\n\}/g,
    )) {
      if (!name.includes("-ink-")) continue;
      /* A timed draw has ONE retracted end. It runs the draw-in half of the law and stops where
         the ink is complete, and `animation-fill-mode: both` leaves it there — a screen that never
         leaves the viewport has nothing to retract for. */
      for (const edge of id === "not-found" ? ["0%"] : ["0%", "100%"]) {
        const frame = new RegExp(`\\n\\s*${edge}\\s*\\{([^}]*)\\}`).exec(body);
        assert.ok(frame, `${id}: ${name} declares no ${edge} frame`);
        const dash = /stroke-dasharray:\s*([^;]*)/.exec(frame[1]);
        assert.ok(dash, `${id}: ${name} declares no dash at ${edge}`);
        const inked = dash[1]
          .trim()
          .split(/\s+/)
          .map(Number)
          .filter((_, at) => at % 2 === 0);
        assert.deepEqual(
          inked.filter((length) => length > 0),
          [],
          `${id}: ${name} still inks ${inked} at ${edge}`,
        );
      }
    }
  }
});

/* A connector's box is pinned with `min()` and `max()` over every point it passes through, and its
   `d` is normalised against whichever of them is the nearest corner at the band's own nominal
   window. Which point that IS must not turn over: an end that carries an `svmin` term and one that
   does not separate at a rate the section's own height sets, and no media query can see a section's
   height. A box whose nearest corner changed would render the curve shifted. */
test("no connector's box changes which point pins it, at any section height", () => {
  for (const id of ALL_IDS) {
    const css = threadCss(id);
    for (const rule of readRules(css)) {
      for (const property of ["top"] as const) {
        const value = rule.decls[property];
        if (value === undefined || !wraps(value, "min")) continue;
        const { parts } = splitTop(value.slice(4, -1), [","]);
        const order = (ratio: number) => {
          const resolved = parts.map((part) =>
            resolveLength(part, 1000, 1000 * ratio),
          );
          return [
            resolved.indexOf(Math.min(...resolved)),
            resolved.indexOf(Math.max(...resolved)),
          ].join("/");
        };
        assert.equal(
          order(1),
          order(0.01),
          `${id}: ${rule.selector}'s ${property} changes which point pins it between a section one screen tall and a very tall one`,
        );
      }
    }
  }
});

/* ---- the light ------------------------------------------------------------------------------ */

test("the bleed is static and present at rest", () => {
  for (const id of ALL_IDS) {
    const rest = readRules(threadCss(id)).filter((r) => !conditional(r));
    const bleed = rest.filter((r) => r.decls.filter !== undefined);
    assert.ok(bleed.length > 0, `${id} has no bleed at rest`);
    for (const rule of bleed) {
      assert.equal(
        Object.keys(rule.decls).some((p) => p.startsWith("animation")),
        false,
        `${id}: the bleed animates, so a blurred buffer re-renders`,
      );
      /* It covers the INK layer and nothing wider: a bleed over the head would put the moving
         light inside the blurred buffer, which is the one cost the static filter exists to avoid. */
      assert.match(
        rule.selector,
        new RegExp(`\\.${THREAD_CLASS.inkLayer}$`),
        `${id}: the bleed is on ${rule.selector}`,
      );
    }
  }
});

test("the head and the re-trace are the only looping layers", () => {
  for (const id of ALL_IDS) {
    const infinite = readRules(threadCss(id)).filter((r) =>
      Object.values(r.decls).some((v) => v.includes("infinite")),
    );
    assert.ok(infinite.length > 0, `${id} loops nothing`);
    for (const rule of infinite) {
      assert.match(
        rule.selector,
        /head|retrace/,
        `${rule.selector} loops but is neither the head nor the re-trace`,
      );
    }
  }
});

/* The defect this replaces was invisible to every gate and to the eye: the reduced-motion rule was
   two classes against the per-segment rule's three, so it LOST the cascade and the whole scrub kept
   running. A parked section looks the same either way, which is why nothing caught it — including
   the joins gate, whose `rest` state is this rule.

   The claim is therefore not "a block exists" but "every animated selector is cancelled, at a
   specificity that can win". */
test("reduced motion cancels every animated selector, at a weight that wins", () => {
  const classes = (selector: string) => selector.split(".").length - 1;

  for (const id of ALL_IDS) {
    const css = threadCss(id);
    const rules = readRules(css);
    const animated = rules.filter(
      (r) => r.decls["animation-name"] !== undefined,
    );
    assert.ok(animated.length > 0, `${id} animates nothing`);

    const reduced = rules.filter((r) =>
      r.at.some((at) => /prefers-reduced-motion:\s*reduce/.test(at)),
    );
    const cancelled = new Map(
      reduced.map((r) => [r.selector, r.decls.animation]),
    );
    for (const rule of animated) {
      assert.equal(
        cancelled.get(rule.selector),
        "none",
        `${id}: ${rule.selector} animates and is never cancelled`,
      );
    }
    /* Equal specificity only wins on order, so the block has to be last in the sheet. */
    for (const selector of cancelled.keys()) {
      assert.ok(
        css.indexOf("prefers-reduced-motion") <
          css.indexOf(`${selector} { animation: none;`),
        `${id}: ${selector} is cancelled outside the reduced-motion block`,
      );
    }
    for (const rule of animated) {
      assert.ok(
        classes(rule.selector) >= 1,
        `${id}: ${rule.selector} carries no class to match`,
      );
    }
    assert.equal(
      css.lastIndexOf("@media (prefers-reduced-motion: reduce)") >
        css.lastIndexOf("@supports"),
      true,
      `${id}: an animation is declared after the block that cancels it`,
    );
  }
});

/* A round cap reaches half the mask's stroke past the dash, which is what covers the laid ink's own
   cap so no dark pip shows ahead of the light (measured 168 against 252 on the darkest channel).
   On a ZERO-length dash the same cap paints a dot — a bug this project has already shipped once. */
test("the head's brightest layer caps round only where its dash has length", () => {
  for (const id of ALL_IDS) {
    let checked = 0;
    for (const rule of readRules(threadCss(id))) {
      const cap = rule.decls["stroke-linecap"];
      if (cap === undefined) continue;
      const dash = rule.decls["stroke-dasharray"];
      assert.ok(dash, `${id}: ${rule.selector} caps without a dash`);
      const inked = (dash as string)
        .split(/\s+/)
        .map(Number)
        .filter((_, at) => at % 2 === 0);
      const paints = inked.some((length) => length > 1e-9);
      assert.equal(
        cap,
        paints ? "round" : "butt",
        `${id}: ${rule.at.at(-1)} caps ${cap} on ${dash}`,
      );
      checked += 1;
    }
    assert.ok(checked > 0, `${id}: no frame animates a cap`);
  }
});

/* ---- the markup covers every band ------------------------------------------------------------ */

/* THE defect this pair exists to keep out. Geometry is emitted once per ASPECT BAND, and a band's
   route may differ from its neighbour's in how many stops it has and which motifs they carry — that
   is the whole point of bands. The markup was built from `THREAD_BANDS[0]` alone, so every other
   band's rules addressed elements that were never mounted and that band rendered wrong.

   NOTHING ELSE CAN SEE IT. The sheet is valid CSS either way; the rules that do match still match;
   `tsc`, lint, the whole suite, the build and the join gate were all green over it, because the
   seeded routes are the same straight run in all three bands and the element sets coincide. It
   becomes real the first time the owner authors one band differently — which is the first thing
   they will do — so the test AUTHORS that divergence rather than waiting for it. */

/* Every element class the sheet names, taken out of its selectors rather than re-derived from the
   model both sides were generated from. */
const MOUNT_CLASS = /thread__(?:seg-\d+(?:-[A-Za-z]+)?|stub--(?:entry|exit))/g;

function addressedClasses(css: string): Set<string> {
  const found = new Set<string>();
  for (const rule of readRules(css)) {
    if (rule.at.some((at) => at.startsWith("@keyframes"))) continue;
    for (const match of rule.selector.matchAll(MOUNT_CLASS))
      found.add(match[0]);
  }
  return found;
}

function mountedClasses(id: ThreadId): Set<string> {
  return new Set(threadMounts(id).map((mount) => mount.className));
}

/* A `wide` route that diverges from `tall`'s on both axes the markup depends on: SIX stops against
   four, and `bow` then `phone` against a single `heart`. The entry and exit columns are left on the
   band's centre column, so the handoff law is untouched and this tests one thing. */
const DIVERGENT: SectionRoute = {
  id: "invite",
  band: "wide",
  cols: 7,
  rows: 6,
  stops: [
    { col: 3, row: 0 },
    { col: 2, row: 1, motif: "bow", scale: 0.12 },
    { col: 2, row: 2 },
    { col: 4, row: 3 },
    { col: 4, row: 4, motif: "phone", scale: 0.28 },
    { col: 3, row: 5 },
  ],
};

/* Swapped into the ONE routing source for the length of one assertion, because the defect is a
   property of the routes disagreeing and the seeds agree. Restored in `finally`, or every later
   test in this file would run against a route nobody authored. */
function withDivergentWideRoute(body: () => void): void {
  const routes = THREAD_ROUTES as SectionRoute[];
  const at = routes.findIndex(
    (route) => route.id === DIVERGENT.id && route.band === DIVERGENT.band,
  );
  assert.ok(at >= 0, "no wide route for the invite to diverge from");
  const held = routes[at];
  routes[at] = DIVERGENT;
  try {
    body();
  } finally {
    routes[at] = held;
  }
}

test("every element the sheet addresses is mounted, in every band", () => {
  for (const id of ALL_IDS) {
    const mounted = mountedClasses(id);
    for (const addressed of addressedClasses(threadCss(id))) {
      assert.ok(
        mounted.has(addressed),
        `${id}: the sheet addresses .${addressed}, which the markup never mounts`,
      );
    }
  }

  withDivergentWideRoute(() => {
    /* The divergence is asserted, not assumed: a seed edit that made the bands agree again would
       otherwise leave this test passing while testing nothing. */
    const tall = threadSegments("invite", THREAD_BANDS[0]);
    const wide = threadSegments(
      "invite",
      THREAD_BANDS.find((band) => band.id === "wide") as Band,
    );
    const motifs = (
      segments: readonly ReturnType<typeof threadSegments>[number][],
    ) =>
      segments
        .filter((segment) => segment.kind === "motif")
        .map((segment) =>
          segment.kind === "motif" ? segment.place.motif.id : "",
        )
        .join(",");
    assert.notEqual(
      tall.length,
      wide.length,
      "the two bands have equal stop counts",
    );
    assert.notEqual(
      motifs(tall),
      motifs(wide),
      "the two bands carry equal motifs",
    );

    /* `not-found` resolves to the invite's own route, so it diverges with it and is checked here
       rather than being left to the seeded pass above. */
    for (const id of ["invite", "not-found"] as const) {
      const mounted = mountedClasses(id);
      for (const addressed of addressedClasses(threadCss(id))) {
        assert.ok(
          mounted.has(addressed),
          `${id}, wide route diverging: the sheet addresses .${addressed}, which the markup never mounts`,
        );
      }
    }
  });
});

/* The other half of the contract: the markup is the union, so a band has to PUT AWAY what its own
   route does not use — otherwise a spare element paints its fallback `d` in a box no rule pins.
   Asserted at a real window per band, through the same cascade reader the join test uses. */
test("each band hides exactly the elements its own route does not use", () => {
  const check = () => {
    for (const id of ALL_IDS) {
      const css = threadCss(id);
      const scope = `.${threadScopeClass(id)}`;
      for (const window of WINDOWS) {
        const applied = declarationsAt(css, window);
        const band = bandFor(window);
        const used = new Set<string>([
          ...threadSegments(id, band).map(segmentClass),
          ...threadStubs(id, band).map(
            (stub) => `${THREAD_CLASS.stub}--${stub.which}`,
          ),
        ]);

        for (const mount of threadMounts(id)) {
          const decls = applied.get(`${scope} .${mount.className}`) ?? {};
          assert.equal(
            decls.display === "none",
            !used.has(mount.className),
            `${id} at ${window.width}x${window.height} (${band.id}): .${mount.className} is ${
              decls.display === "none" ? "hidden" : "shown"
            } where its band ${used.has(mount.className) ? "uses" : "does not use"} it`,
          );
        }
      }
    }
  };

  check();
  withDivergentWideRoute(check);
});

/* A motif's OWN drawing is markup, not CSS — the sheet moves, sizes and turns the square but never
   swaps the `d` inside it. So a mount is not interchangeable by position: two bands placing
   different motifs on the same segment index need two elements, or one band paints the other's
   drawing at its own coordinates and every geometric claim in this file still passes. */
test("every band's motif is mounted with its own drawing", () => {
  const check = () => {
    for (const id of ALL_IDS) {
      const drawn = new Map(
        threadMounts(id)
          .filter((mount) => mount.kind === "motif")
          .map((mount) => [mount.className, mount.d]),
      );
      for (const band of THREAD_BANDS) {
        for (const segment of threadSegments(id, band)) {
          if (segment.kind !== "motif") continue;
          assert.equal(
            drawn.get(segmentClass(segment)),
            segment.place.motif.d,
            `${id} at ${band.id}: .${segmentClass(segment)} does not carry ${segment.place.motif.id}'s drawing`,
          );
        }
      }
    }
  };

  check();
  withDivergentWideRoute(check);
});

/* The tests above are made against the mount list; this one pins the markup to it. The component
   is a `.tsx` and cannot be imported here — node strips types but does not compile JSX, and it
   imports a CSS module besides — so the claim is made against its source. Narrow on purpose: the
   defect was the component reaching for ONE band's segments, and these are the three names that
   reach for one. `check:thread-joins` renders the result. */
test("the thread's markup is built from the mount union, not from one band", () => {
  const source = readFileSync(
    new URL("./section-thread.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /\bthreadMounts\b/);
  for (const banned of ["threadSegments", "threadStubs", "THREAD_BANDS"]) {
    assert.equal(
      new RegExp(`\\b${banned}\\b`).test(source),
      false,
      `section-thread.tsx reads ${banned}, which resolves against one band`,
    );
  }
});
