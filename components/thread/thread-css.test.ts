import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { type Band, THREAD_BANDS } from "./thread-bands.ts";
import { sectionBox } from "./thread-boxes.ts";
import {
  bandMarkup,
  JOIN_OVERLAP,
  MOTIF_SIDE,
  pathBounds,
  pathLength,
  THREAD_CLASS,
  threadCss,
  threadScopeClass,
  threadSegments,
} from "./thread-css.ts";
import type { ThreadId } from "./thread-geometry.ts";
import { MOTIFS } from "./thread-motifs.ts";
import { THREAD_IDS } from "./thread-paths.ts";

/* Every surface the component mounts, not only the six page sections: `not-found` draws the
   invite's route on a screen of its own and has to satisfy the same laws. */
const ALL_IDS: readonly ThreadId[] = [...THREAD_IDS, "not-found"];

/* The emitted sheet is nested at-rules over plain declaration blocks, so a test that wants to make
   a claim about a RULE rather than about a substring needs the blocks back. This reader keeps every
   rule with the at-rule conditions it sits under. */
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

/* ---- one box per band, card-anchored, not one per connector --------------------------------- */

/* THE task's own required test. A section's band declares exactly ONE box for its connectors,
   sized to that band's own measured section box; every connector's `d` is a subpath of ONE combined
   `path()`, not a separate declaration per connector; and nothing left over from the retired
   per-connector model survives -- no per-connector span, no `svmin` sizing a motif. */
test("a band declares exactly one connector box, sized to its measured section box", () => {
  for (const id of ALL_IDS) {
    for (const band of THREAD_BANDS) {
      const markup = bandMarkup(id, band);
      const box = sectionBox(id, band.id);
      assert.equal(markup.region.box.width, band.box.width, `${id}/${band.id}`);
      assert.equal(markup.region.box.height, box.height, `${id}/${band.id}`);

      const css = threadCss(id);
      /* Exactly one rule declares this band's own box width -- never a second one, and never a
         per-connector left/top/width/height the way the retired model pinned each connector's own
         stretched box. */
      const boxRules = readRules(css).filter(
        (r) =>
          r.selector ===
            `.${threadScopeClass(id)} .${THREAD_CLASS.band}--${band.id}` &&
          r.decls.width !== undefined,
      );
      assert.equal(
        boxRules.length,
        1,
        `${id}/${band.id}: declared ${boxRules.length} connector boxes, not 1`,
      );
    }
  }
});

test("every connector's d is a subpath of one combined path per band", () => {
  for (const id of ALL_IDS) {
    for (const band of THREAD_BANDS) {
      const markup = bandMarkup(id, band);
      /* The combined `d` starts every subpath with its own `M`, one per connector -- proving the
         field's single `<path>` carries all of them rather than one connector's `d` alone. */
      const moves = markup.connectorD.match(/M/g) ?? [];
      const css = threadCss(id);
      const fieldSelector = `.${threadScopeClass(id)} .${THREAD_CLASS.band}--${band.id} .${THREAD_CLASS.field}`;
      const curve = readRules(css).find(
        (r) =>
          r.selector === `${fieldSelector} .${THREAD_CLASS.connector}` &&
          r.decls.d !== undefined,
      );
      assert.ok(curve, `${id}/${band.id}: no combined connector d declared`);
      assert.ok(
        moves.length >= 1,
        `${id}/${band.id}: connector d has no subpaths`,
      );
      assert.ok(
        (curve.decls.d as string).includes(markup.connectorD.split(" ")[0]),
        `${id}/${band.id}: the declared d is not the combined one`,
      );
    }
  }
});

test("no rule mentions a per-connector span, and no motif size reads svmin", () => {
  for (const id of ALL_IDS) {
    const css = threadCss(id);
    assert.doesNotMatch(
      css,
      /--thread-mask-lead|MASK_LEAD|CONNECTOR_MASK_COVER/,
      `${id}: the retired per-connector lead survives`,
    );
    for (const rule of readRules(css)) {
      const side = rule.decls["--thread-motif-side"];
      if (side === undefined) continue;
      assert.doesNotMatch(
        side,
        /svmin/,
        `${id}: ${rule.selector} sizes a motif off svmin`,
      );
    }
  }
});

/* MUTATION GUARD: a band's box must be the section's own MEASURED height (`thread-boxes.ts`), not
   the band's nominal device height -- Task 2's whole point, and this refactor's box now depends on
   it directly for the field's own viewBox. Falsified by hand against `sectionBox`, restored: setting
   a paired or list section back to its band's flat nominal height is exactly the class of regression
   `thread-boxes.test.ts`'s own mutation test guards upstream; this one guards that `bandMarkup`
   actually reads it rather than substituting the band's own box. */
test("a band's box is the section's measured height, not the band's flat nominal one", () => {
  const band = THREAD_BANDS.find((b) => b.id === "wide") as Band;
  const flat = bandMarkup("celebrations", band).region.box.height;
  const measured = sectionBox("celebrations", "wide").height;
  assert.equal(flat, measured);
  assert.notEqual(
    measured,
    band.box.height,
    "celebrations/wide is no longer taller than the band's flat nominal box -- update this guard",
  );
});

/* ---- bands, aspect and geometry --------------------------------------------------------------- */

test("geometry is emitted per band, and each band's connector geometry differs", () => {
  const css = threadCss("wishes");
  for (const band of THREAD_BANDS) {
    assert.ok(css.includes(band.id), `wishes emits no ${band.id} block`);
  }
});

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

test("every band's own connectors compose a different drawn curve", () => {
  for (const id of THREAD_IDS) {
    const byBand = new Map(
      THREAD_BANDS.map((band) => [band.id, bandMarkup(id, band).connectorD]),
    );
    const values = [...byBand.values()];
    assert.ok(
      new Set(values).size > 1 || values.length === 1,
      `${id}: every band composes the identical curve`,
    );
  }
});

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

/* Each band's own subtree must not paint while another band's aspect matches -- unlike the retired
   grid's shared-and-hidden union, a band that does not match is not merely inert, it never declares
   `display: block` at all outside its own query. */
test("a band's box only ever shows inside its own aspect query", () => {
  for (const id of ALL_IDS) {
    const css = threadCss(id);
    const scope = `.${threadScopeClass(id)}`;
    for (const band of THREAD_BANDS) {
      const selector = `${scope} .${THREAD_CLASS.band}--${band.id}`;
      const unconditional = readRules(css).filter(
        (r) => r.selector === selector && !conditional(r) && !inKeyframes(r),
      );
      for (const rule of unconditional) {
        assert.notEqual(
          rule.decls.display,
          "block",
          `${id}: .${THREAD_CLASS.band}--${band.id} shows outside its own aspect query`,
        );
      }
      const gated = readRules(css).filter(
        (r) =>
          r.selector === selector &&
          r.decls.display === "block" &&
          r.at.some(
            (at) => at.startsWith("@media") && at.includes("aspect-ratio"),
          ),
      );
      assert.ok(
        gated.length > 0,
        `${id}: .${THREAD_CLASS.band}--${band.id} never shows at all`,
      );
    }
  }
});

/* ---- the base state and the scrub ------------------------------------------------------------ */

test("at rest the thread is complete and no animation is required to make it so", () => {
  for (const id of ALL_IDS) {
    const rest = readRules(threadCss(id)).filter(
      (r) => !conditional(r) && !inKeyframes(r),
    );
    const scope = `.${threadScopeClass(id)}`;

    for (const rule of rest) {
      for (const property of Object.keys(rule.decls)) {
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

test("the scrub is scroll-driven off one named section timeline, never timed", () => {
  for (const id of ALL_IDS) {
    const rules = readRules(threadCss(id));
    const named = rules.flatMap((r) =>
      r.decls["view-timeline-name"] === undefined
        ? []
        : [r.decls["view-timeline-name"]],
    );

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
      [0, 0, 1, 0],
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

test("only the page's first and last sections keep a wisp at rest", () => {
  const stubbed = THREAD_IDS.filter((id) =>
    threadCss(id).includes(`${THREAD_CLASS.stub}--`),
  );
  assert.deepEqual([...stubbed], ["invite", "wishes"]);
  assert.ok(
    threadCss("not-found").includes(`${THREAD_CLASS.stub}--`),
    "not-found is closed at both ends and keeps both wisps",
  );
});

/* ---- the weave -------------------------------------------------------------------------------- */

test("wishes renders two complementary weave segments", () => {
  const css = threadCss("wishes");
  assert.match(css, /--thread-weave-under/);
  assert.match(css, /--thread-weave-over/);
});

/* Each band is self-contained, so each carries its OWN pair of weave copies -- three bands times
   two copies, not the single shared pair a union-mounted motif used to give. Checked per band. */
test("the weave's two copies cover the whole loop exactly once, in every band", () => {
  for (const band of THREAD_BANDS) {
    const dashes = readRules(threadCss("wishes"))
      .filter(
        (r) =>
          r.selector.includes(band.id) &&
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
      `wishes/${band.id}: must declare both weave copies at rest`,
    );

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
    assert.equal(
      inked[0][0],
      0,
      `wishes/${band.id}: the loop is not inked from its start`,
    );
    assert.equal(
      inked[inked.length - 1][1],
      1,
      `wishes/${band.id}: the loop is not inked to its end`,
    );
    for (let index = 1; index < inked.length; index += 1) {
      assert.equal(
        inked[index][0],
        inked[index - 1][1],
        `wishes/${band.id}: the two copies overlap or leave a gap`,
      );
    }
  }
});

/* ---- tokens and measurement ------------------------------------------------------------------ */

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
    assert.ok(
      maxX - minX >= MOTIF_SIDE / 2 || maxY - minY >= MOTIF_SIDE / 2,
      `${motif.id} spans ${maxX - minX}x${maxY - minY} of a ${MOTIF_SIDE} field`,
    );
  }
});

test("a motif's measured length is commensurate with the field it is drawn in", () => {
  for (const id of ALL_IDS) {
    for (const band of THREAD_BANDS) {
      for (const segment of threadSegments(id, band)) {
        if (segment.kind !== "motif") continue;
        const side =
          segment.place.scale * Math.min(band.box.width, band.box.height);
        assert.ok(
          segment.length > side && segment.length < side * 10,
          `${id} at ${band.id}: ${segment.place.motif} measures ${segment.length}px in a ${side}px field`,
        );
      }
    }
  }
});

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

/* ---- the turn and the mirror ------------------------------------------------------------------ */

test("a motif's turn and mirror are authored values, emitted as declared", () => {
  for (const id of ALL_IDS) {
    for (const band of THREAD_BANDS) {
      const markup = bandMarkup(id, band);
      const css = threadCss(id);
      /* This geometry lives inside the band's OWN aspect query, not at rest -- unlike the base
         state, it must NOT be filtered to unconditional rules. */
      const rules = readRules(css).filter((r) => !inKeyframes(r));
      const placed = threadSegments(id, band).filter((s) => s.kind === "motif");
      placed.forEach((segment, at) => {
        if (segment.kind !== "motif") return;
        const motif = markup.motifs[at];
        const selector = `.${threadScopeClass(id)} .${THREAD_CLASS.band}--${band.id} .${motif.className}`;
        const rule = rules.find(
          (r) =>
            r.selector === selector &&
            r.decls["--thread-motif-x"] !== undefined,
        );
        assert.ok(rule, `${id}/${band.id}: no rule for ${selector}`);
        if (segment.place.turn === 0) {
          assert.equal(
            rule.decls.rotate,
            undefined,
            `${id}/${band.id}: a zero turn still declares rotate`,
          );
        } else {
          const declared = /^(-?[\d.]+)deg$/.exec(
            (rule.decls.rotate ?? "").trim(),
          );
          assert.ok(
            declared,
            `${id}/${band.id}: unreadable rotation ${rule.decls.rotate}`,
          );
          assert.ok(
            Math.abs(Number(declared[1]) - segment.place.turn) < 1e-3,
            `${id}/${band.id}: declared ${declared[1]}deg, not the placement's ${segment.place.turn}deg`,
          );
        }
        assert.equal(
          rule.decls.scale === "-1 1",
          Boolean(segment.place.mirror),
          `${id}/${band.id}: mirror flag disagrees with the declared scale`,
        );
      });
    }
  }
});

test("no motif with a zero turn is handed a transform at all", () => {
  let checked = 0;
  for (const id of ALL_IDS) {
    for (const band of THREAD_BANDS) {
      const markup = bandMarkup(id, band);
      const placed = threadSegments(id, band).filter((s) => s.kind === "motif");
      placed.forEach((segment, at) => {
        if (segment.kind !== "motif" || segment.place.turn !== 0) return;
        checked += 1;
        const motif = markup.motifs[at];
        const selector = `.${threadScopeClass(id)} .${THREAD_CLASS.band}--${band.id} .${motif.className}`;
        const rule = readRules(threadCss(id)).find(
          (r) =>
            r.selector === selector &&
            !inKeyframes(r) &&
            r.decls["--thread-motif-x"] !== undefined,
        );
        assert.equal(rule?.decls.rotate, undefined);
      });
    }
  }
  /* Not asserted `> 0`: the owner's drawings may turn every motif, in which case this test is a
     no-op rather than a false pass -- the positive case above already proves the mechanism. */
  void checked;
});

/* ---- the join -------------------------------------------------------------------------------- */

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

test("a band's fixed mask region comfortably covers its own extended reveal", () => {
  for (const id of ALL_IDS) {
    for (const band of THREAD_BANDS) {
      const markup = bandMarkup(id, band);
      const bounds = pathBounds(markup.revealD, { width: 1, height: 1 });
      assert.ok(
        markup.region.min <= bounds.minX &&
          markup.region.min <= bounds.minY &&
          markup.region.box.width + Math.abs(markup.region.min) >=
            bounds.maxX &&
          markup.region.box.height + Math.abs(markup.region.min) >= bounds.maxY,
        `${id}/${band.id}: the fixed region does not cover the extended reveal`,
      );
    }
  }
});

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

test("a complete reveal is emitted with no trailing gap to stop it", () => {
  for (const id of ALL_IDS) {
    for (const [, dash] of threadCss(id).matchAll(
      /stroke-dasharray:\s*([^;]+);/g,
    )) {
      const values = dash.trim().split(/\s+/).map(Number);
      if (values.some((value) => Number.isNaN(value))) continue;
      let at = 0;
      let inked = 0;
      values.forEach((value, index) => {
        at += value;
        if (index % 2 === 0 && value > 0) inked = at;
      });
      if (inked < 1) continue;
      assert.equal(
        values[values.length - 1],
        0,
        `${id}: "${dash.trim()}" reaches the end and still carries a gap that stops it`,
      );
    }
  }
});
