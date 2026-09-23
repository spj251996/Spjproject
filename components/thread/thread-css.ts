/* Extension-qualified, unlike the rest of components/: plain node resolves a relative import only
   with its extension, and this module stays importable outside the app's bundler. */
import {
  composePath,
  type Motif,
  type Placement,
  type SectionBox,
  type SectionThread,
  type ThreadId,
} from "./thread-geometry.ts";
import { MOTIFS } from "./thread-motifs.ts";

/* One section's thread as a static stylesheet, generated from the section's own placements. Nothing
   here reads the page: the output is plain CSS that paints a COMPLETE thread on first render, and
   the scroll-driven layer subtracts from it (DESIGN.md -> Components -> Shell -> `thread-overlay`:
   "The complete thread is the base state, and the reveal subtracts from it"). Reduced motion, a
   page without scripting and a browser without scroll-linked animation therefore all land on the
   same base with nothing to suppress.

   The reveal is a MASK per element, never a dash on the visible stroke. Every visible stroke needs
   `vector-effect: non-scaling-stroke` — a viewBox unit is ~0.78 screen px at phone and ~2.0 at
   desktop, so one declared width would otherwise render at two — and a non-scaling stroke fragments
   a `pathLength` dash into disjoint runs, measured, with no stretch at all
   (`tmp/thread-spike/VERDICT.md` -> Q1). So:

   - a connector descends monotonically by design, so a rect WIPE in the svg's own user space is
     equivalent to drawing along it, and survives both the stretch and the non-scaling stroke;
   - a motif loops back on itself, so a wipe would reveal it out of order; its mask is a dashed,
     BUTT-capped stroked copy of the same `d`, where nothing scales the dash. The butt cap is
     load-bearing: a round cap on a zero-length dash paints a dot, measured as stray specks.

   Every selector starts from the section's scope class, so two threads on one page never collide.
   The stylesheet is unlayered, so it wins over the utility and component layers. */

export const THREAD_CLASS = {
  root: "thread",
  field: "thread__field",
  connector: "thread__connector",
  wipeFrame: "thread__wipe-frame",
  inkReveal: "thread__ink-reveal",
  wispReveal: "thread__wisp-reveal",
  wisp: "thread__wisp",
  stub: "thread__stub",
  motif: "thread__motif",
  motifPath: "thread__motif-path",
  weaveUnder: "thread--weave-under",
  weaveOver: "thread--weave-over",
} as const;

export function threadScopeClass(id: ThreadId): string {
  return `thread--${id}`;
}

function segmentClass(index: number): string {
  return `thread__seg-${index}`;
}

/* One name per section, declared on the thread's own root — which spans the section edge to edge,
   so its view progress IS the section's. `animation-timeline: view()` on a SEGMENT times it against
   that segment's own box, which differs per segment; with the named timeline all segments report
   the same progress to within 0.0003 (VERDICT.md -> Q1). */
function timelineName(id: ThreadId): string {
  return `--thread-${id}`;
}

/* INFERRED, not stated: DESIGN.md fixes the hold band as "one fraction of a section's travel through
   the viewport, shared by all six sections" and gives no figure. This is the value the spike
   resolved its reveal table against. Owner: design-write. */
export const THREAD_HOLD = 0.25;

/* INFERRED, not stated: the wisp's length as a fraction of the whole thread. DESIGN.md gives the
   wisp a width and an opacity but no extent. Owner: design-write. */
const WISP_EXTENT = 0.04;

/* INFERRED, not stated: the mask stroke's width in the motif's own unit square. It must exceed the
   visible stroke at every tier and stay under the closest approach of two of the motif's own
   passes; the drawings that decide the second half land in Task 6. Owner: design-write. */
const MASK_WIDTH = 0.04;

/* INFERRED, not stated: the arc of the Wishes loop that passes BEHIND the illustration. DESIGN.md
   requires the under-segment to cross the drawn figures rather than the pale surround, which is a
   routing requirement over a drawing that does not exist yet. Task 11 tunes it against the measured
   bar (under-segment ink hidden >= 60%). Owner: design-write. */
const WEAVE_BAND: readonly [number, number] = [0.3, 0.7];

/* The four width tiers, each with the nominal section box the spike measured its aspect spread
   against. A section spans the window's width and is at least one window tall, so the box is the
   window's. Only the box's ASPECT is read. */
export type ThreadTier = {
  name: string;
  /* The tier's own width band in rem, half-open [from, to). The media query is derived from it, so
     a band and the query that states it cannot drift apart, and two bands can be intersected. */
  from: number;
  to: number;
  media: string;
  box: SectionBox;
};

/* Bounded ranges, not open-ended minimums: Tailwind emits arbitrary variants in string order, and
   an open-ended `>=64rem` rule beats an open-ended `>=100rem` one wherever both match. These are
   hand-emitted rather than variants, but the same collision would apply to two overlapping tiers,
   and a bounded band cannot have one. */
function widthQuery(from: number, to: number): string {
  if (from === 0) return `(width < ${to}rem)`;
  if (to === Number.POSITIVE_INFINITY) return `(${from}rem <= width)`;
  return `(${from}rem <= width < ${to}rem)`;
}

export const THREAD_TIERS: readonly ThreadTier[] = [
  { name: "phone", from: 0, to: 48, box: { width: 390, height: 844 } },
  { name: "tablet", from: 48, to: 64, box: { width: 768, height: 1024 } },
  { name: "laptop", from: 64, to: 100, box: { width: 1440, height: 900 } },
  {
    name: "desktop",
    from: 100,
    to: Number.POSITIVE_INFINITY,
    box: { width: 1600, height: 1000 },
  },
].map((tier) => ({ ...tier, media: widthQuery(tier.from, tier.to) }));

/* Family's second placement set is keyed to the ARRANGEMENT — below `{breakpoints.md}`, where
   `MountedPair` is `flex-col` — never to a device tier, because the property belongs to the layout
   and a per-tier constant is what 5a's botanical sizing got wrong. */
const STACKED_REGIME = { from: 0, to: 48 };

function round(value: number): string {
  const fixed = value.toFixed(5).replace(/\.?0+$/, "");
  return fixed === "-0" ? "0" : fixed;
}

/* ---- path reading ------------------------------------------------------------------------- */

type Point = { x: number; y: number };

type Command = { code: string; points: Point[] };

/* Only the commands the thread actually uses. Anything else THROWS rather than being skipped or
   approximated: an arc silently measured as a straight line would put a wrong number into every
   keyframe stop, and a wrong number that looks plausible is the failure this project keeps
   re-learning. Task 6's drawings must stay inside this set or extend it deliberately. */
function parsePath(d: string): Command[] {
  const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e-?\d+)?/g) ?? [];
  const commands: Command[] = [];
  let index = 0;
  let code = "";
  const arity: Record<string, number> = { M: 2, L: 2, C: 6, Q: 4, Z: 0 };

  while (index < tokens.length) {
    if (/[a-zA-Z]/.test(tokens[index])) {
      code = tokens[index];
      index += 1;
    }
    const upper = code.toUpperCase();
    if (!(upper in arity)) {
      throw new Error(
        `thread-css: unsupported path command "${code}" in "${d}"`,
      );
    }
    const count = arity[upper];
    const numbers: number[] = [];
    for (let n = 0; n < count; n += 1) {
      numbers.push(Number(tokens[index]));
      index += 1;
    }
    const points: Point[] = [];
    for (let n = 0; n < numbers.length; n += 2) {
      points.push({ x: numbers[n], y: numbers[n + 1] });
    }
    commands.push({ code, points });
    if (upper === "M" && code === "M") code = "L";
    if (upper === "M" && code === "m") code = "l";
  }
  return commands;
}

function cubic(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const u = 1 - t;
  return {
    x:
      u * u * u * p0.x +
      3 * u * u * t * p1.x +
      3 * u * t * t * p2.x +
      t * t * t * p3.x,
    y:
      u * u * u * p0.y +
      3 * u * u * t * p1.y +
      3 * u * t * t * p2.y +
      t * t * t * p3.y,
  };
}

const SAMPLES = 48;

/* Every drawn point of a path, in order, in the box it is rendered in. Arc length, the wipe axis
   and the monotonicity guard all read the same samples, so none of them can disagree with another. */
function samplePath(d: string, box: SectionBox): Point[] {
  const scale = (p: Point) => ({ x: p.x * box.width, y: p.y * box.height });
  const points: Point[] = [];
  let cursor: Point = { x: 0, y: 0 };
  let start: Point = { x: 0, y: 0 };

  for (const { code, points: raw } of parsePath(d)) {
    const relative = code === code.toLowerCase();
    const absolute = raw.map((p) =>
      relative ? { x: cursor.x + p.x, y: cursor.y + p.y } : p,
    );
    switch (code.toUpperCase()) {
      case "M":
        cursor = absolute[0];
        start = cursor;
        break;
      case "L":
        points.push(scale(cursor), scale(absolute[0]));
        cursor = absolute[0];
        break;
      case "Q":
      case "C": {
        const [c1, c2, end] =
          code.toUpperCase() === "C"
            ? absolute
            : [
                {
                  x: cursor.x + (2 / 3) * (absolute[0].x - cursor.x),
                  y: cursor.y + (2 / 3) * (absolute[0].y - cursor.y),
                },
                {
                  x: absolute[1].x + (2 / 3) * (absolute[0].x - absolute[1].x),
                  y: absolute[1].y + (2 / 3) * (absolute[0].y - absolute[1].y),
                },
                absolute[1],
              ];
        for (let step = 0; step <= SAMPLES; step += 1) {
          points.push(scale(cubic(cursor, c1, c2, end, step / SAMPLES)));
        }
        cursor = end;
        break;
      }
      case "Z":
        points.push(scale(cursor), scale(start));
        cursor = start;
        break;
    }
  }
  return points;
}

/* Exported so a test can exercise the measurement the keyframe stops are derived from, against
   lengths that are known by construction rather than produced by this same code. */
export function pathLength(d: string, box: SectionBox): number {
  const points = samplePath(d, box);
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += Math.hypot(
      points[index].x - points[index - 1].x,
      points[index].y - points[index - 1].y,
    );
  }
  return total;
}

/* `composePath` returns every connector in one `d`, lifting the pen across each motif's footprint.
   A subpath that is only a moveto draws nothing — it is the lift itself — and is dropped. */
export function drawnSubpaths(d: string): string[] {
  return d
    .split(/(?=M )/)
    .map((piece) => piece.trim())
    .filter((piece) => piece.length > 0 && /[CLQZclqz]/.test(piece));
}

/* ---- segments ----------------------------------------------------------------------------- */

export type ThreadSegment =
  | {
      kind: "connector";
      index: number;
      d: string;
      length: number;
      axis: "x" | "y";
      monotone: boolean;
      frame: string;
    }
  | {
      kind: "motif";
      index: number;
      motif: Motif;
      placement: Placement;
      length: number;
    };

function connectorSegment(
  index: number,
  d: string,
  box: SectionBox,
): ThreadSegment {
  const points = samplePath(d, box);
  const first = points[0];
  const last = points[points.length - 1];

  const advances = (candidate: "x" | "y") => {
    const along = points.map((p) => (candidate === "y" ? p.y : p.x));
    const forward = along[along.length - 1] >= along[0];
    return along.every((value, at) =>
      at === 0
        ? true
        : forward
          ? value >= along[at - 1] - 1e-9
          : value <= along[at - 1] + 1e-9,
    );
  };

  /* The widest sweep is the axis a wipe reads best along, but a connector that leaves its motif
     along the exit tangent and then turns back reverses on that axis — and a wipe is equivalent to
     drawing along the curve only where the curve advances. The other axis is taken when the wide
     one turns back, because a wipe that reveals the arc OUT OF ORDER is a worse defect than one
     that reveals it unevenly. */
  const travelX = Math.abs(last.x - first.x);
  const travelY = Math.abs(last.y - first.y);
  const widest: "x" | "y" = travelY >= travelX ? "y" : "x";
  const other: "x" | "y" = widest === "y" ? "x" : "y";
  const axis = advances(widest) || !advances(other) ? widest : other;
  const monotone = advances(axis);

  /* The wipe rect is a unit square; the frame maps it onto this connector's own span, so the rect's
     animated transform is the same unit sweep whichever axis it runs along. The cross-axis scale of
     3 (from -1) is what makes the band reach past the section on the other axis. */
  const startFraction =
    axis === "y" ? first.y / box.height : first.x / box.width;
  const span =
    axis === "y"
      ? (last.y - first.y) / box.height
      : (last.x - first.x) / box.width;
  const frame =
    axis === "y"
      ? `translate(-1px, ${round(startFraction)}px) scale(3, ${round(span)})`
      : `translate(${round(startFraction)}px, -1px) scale(${round(span)}, 3)`;

  return {
    kind: "connector",
    index,
    d,
    length: pathLength(d, box),
    axis,
    monotone,
    frame,
  };
}

/* The thread's segments in drawing order, connectors and motifs alternating. The connectors come
   from `composePath`'s own output rather than being re-derived, so there is one composition walk in
   the repo, not two — and `every connector the component renders is a subpath composePath drew`
   fails the moment the two disagree. */
export function threadSegments(
  section: SectionThread,
  tier: ThreadTier,
  placements: readonly Placement[] = section.placements,
): ThreadSegment[] {
  const composed = { ...section, placements };
  const connectors = drawnSubpaths(composePath(composed, MOTIFS, tier.box));
  const segments: ThreadSegment[] = [];
  let next = 0;
  const take = () => {
    const d = connectors[next];
    next += 1;
    return connectorSegment(segments.length, d, tier.box);
  };

  if (placements.length === 0) {
    if (section.entryX !== null && section.exitX !== null)
      segments.push(take());
    return segments;
  }

  placements.forEach((placement, at) => {
    if (at > 0 || section.entryX !== null) segments.push(take());
    const motif = MOTIFS[placement.motif];
    const side = placement.scale * Math.min(tier.box.width, tier.box.height);
    segments.push({
      kind: "motif",
      index: segments.length,
      motif,
      placement,
      length: pathLength(motif.d, { width: side, height: side }),
    });
  });
  if (section.exitX !== null) segments.push(take());
  return segments;
}

/* ---- the scrub law ------------------------------------------------------------------------- */

/* The inked arc is [tail, head] over the section's whole thread: the head grows as the section
   enters the viewport, both hold through the hold band, and the tail eats forward as it leaves. */
function headAt(progress: number): number {
  return progress >= THREAD_HOLD ? 1 : progress / THREAD_HOLD;
}

function tailAt(progress: number): number {
  return progress <= 1 - THREAD_HOLD
    ? 0
    : (progress - (1 - THREAD_HOLD)) / THREAD_HOLD;
}

function clamp(value: number): number {
  return Math.min(1, Math.max(0, value));
}

type Span = { start: number; end: number };

function localise(global: number, span: Span): number {
  return span.end === span.start
    ? global >= span.end
      ? 1
      : 0
    : clamp((global - span.start) / (span.end - span.start));
}

/* The progress values at which the head or the tail crosses one of this segment's own boundaries.
   Between two of them both are linear in progress, so linear keyframe interpolation is exact rather
   than approximate — which is what "the draw advances evenly along the thread's rendered length"
   asks for. */
function stops(span: Span, extra: readonly number[]): number[] {
  const arcs = [span.start, span.end, ...extra];
  const all = [0, 1, THREAD_HOLD, 1 - THREAD_HOLD];
  for (const arc of arcs) {
    all.push(THREAD_HOLD * arc, 1 - THREAD_HOLD + THREAD_HOLD * arc);
  }
  return [...new Set(all.map(clamp).map((p) => Number(p.toFixed(6))))].sort(
    (a, b) => a - b,
  );
}

type Band = readonly [number, number];

function inkBands(progress: number, span: Span): Band[] {
  return [[localise(tailAt(progress), span), localise(headAt(progress), span)]];
}

function wispBands(progress: number, span: Span): Band[] {
  const head = headAt(progress);
  const tail = tailAt(progress);
  return [
    [localise(head, span), localise(head + WISP_EXTENT, span)],
    [localise(tail - WISP_EXTENT, span), localise(tail, span)],
  ];
}

function intersect(bands: readonly Band[], within: readonly Band[]): Band[] {
  const out: Band[] = [];
  for (const [a0, a1] of bands) {
    for (const [b0, b1] of within) {
      const lo = Math.max(a0, b0);
      const hi = Math.min(a1, b1);
      /* A zero-width band is KEPT, not dropped. It paints nothing either way — the mask is
         butt-capped so a zero-length dash cannot leave a dot — but it carries the position the
         band collapsed AT. Dropped, the retract's last frame falls back to the path's start and
         the thread pulls in from the wrong end. */
      if (hi >= lo) out.push([lo, hi]);
    }
  }
  return out.sort((a, b) => a[0] - b[0]);
}

/* A four-value `stroke-dasharray` on `pathLength="1"` encodes one inked arc as
   `0 {tail} {head - tail} 1`; two arcs simply extend the same alternation. An empty list still has
   to paint nothing, which `0 1` does — a lone zero-length dash would paint a dot under a round cap,
   and the mask is butt-capped precisely so it cannot. */
function dashArray(bands: readonly Band[]): string {
  if (bands.length === 0) return "0 1";
  const values: number[] = [0];
  let cursor = 0;
  for (const [start, end] of bands) {
    values.push(start - cursor, end - start);
    cursor = end;
  }
  values.push(1);
  return values.map((value) => round(Math.max(0, value))).join(" ");
}

function wipeTransform(band: Band, axis: "x" | "y"): string {
  const [start, end] = band;
  const extent = Math.max(0, end - start);
  return axis === "y"
    ? `translate(0px, ${round(start)}px) scale(1, ${round(extent)})`
    : `translate(${round(start)}px, 0px) scale(${round(extent)}, 1)`;
}

const FULL: Band = [0, 1];

/* ---- emission ------------------------------------------------------------------------------ */

function rule(selector: string, decls: readonly string[]): string {
  return `${selector} { ${decls.join(" ")} }`;
}

function keyframes(
  name: string,
  frames: readonly { at: number; decl: string }[],
): string {
  const body = frames
    .map(({ at, decl }) => `  ${round(at * 100)}% { ${decl} }`)
    .join("\n");
  return `@keyframes ${name} {\n${body}\n}`;
}

type Layer = {
  /* The suffix that separates this layer's animation and keyframes from the segment's others. */
  suffix: string;
  /* `[tail, head]` and the wisp bands are both a list of arcs; a layer is the list it paints. */
  bands: (progress: number, span: Span) => Band[];
  /* The weave restricts a layer to part of the motif; every other layer sees the whole of it. */
  within: readonly Band[];
  /* A class on the thread's ROOT that this layer's rules are additionally qualified by — the weave
     variant is chosen per mount, not per segment. */
  root: string;
  /* The element the mask lives on, relative to the segment. */
  target: string;
  /* `transform` for a connector's wipe, `stroke-dasharray` for a motif's dashed copy. */
  declare: (bands: Band[], axis: "x" | "y") => string;
};

function emitSegment(
  section: SectionThread,
  tier: ThreadTier,
  segment: ThreadSegment,
  span: Span,
  layers: readonly Layer[],
  extraStops: readonly number[],
  variant: string,
): { animations: string[]; keyframes: string[] } {
  const scope = `.${threadScopeClass(section.id)}`;
  const animations: string[] = [];
  const emitted: string[] = [];
  const axis = segment.kind === "connector" ? segment.axis : "y";

  for (const layer of layers) {
    const name = `thread-${section.id}-${segment.index}-${layer.suffix}-${tier.name}${variant}`;
    const selector = `${scope}${layer.root} .${segmentClass(segment.index)} ${layer.target}`;
    const frames = stops(span, extraStops).map((at) => ({
      at,
      decl: layer.declare(intersect(layer.bands(at, span), layer.within), axis),
    }));
    animations.push(
      rule(selector, [
        `animation-name: ${name};`,
        `animation-timeline: ${timelineName(section.id)};`,
        "animation-fill-mode: both;",
        "animation-timing-function: linear;",
      ]),
    );
    emitted.push(keyframes(name, frames));
  }
  return { animations, keyframes: emitted };
}

function layersFor(segment: ThreadSegment, weave: boolean): Layer[] {
  const ink: Layer["declare"] =
    segment.kind === "connector"
      ? (bands, axis) =>
          `transform: ${wipeTransform(bands[0] ?? [0, 0], axis)};`
      : (bands) => `stroke-dasharray: ${dashArray(bands)};`;

  const base: Layer[] = [
    {
      suffix: "ink",
      bands: inkBands,
      within: [FULL],
      root: "",
      target: `.${THREAD_CLASS.inkReveal}`,
      declare: ink,
    },
    {
      suffix: "wisp",
      bands: wispBands,
      within: [FULL],
      root: "",
      target: `.${THREAD_CLASS.wispReveal}`,
      declare:
        segment.kind === "connector"
          ? (bands, axis) =>
              `transform: ${wipeTransform(bands[0] ?? [0, 0], axis)};`
          : (bands) => `stroke-dasharray: ${dashArray(bands)};`,
    },
  ];

  if (!weave) return base;

  /* The loop renders twice, as complementary segments of one curve: an under-copy beneath the
     illustration and an over-copy above it, both on the same scrub, so the stroke passes from one
     to the other mid-draw. Both are the SAME `d` — the split is in the mask, not in the geometry. */
  const [under0, under1] = WEAVE_BAND;
  return [
    ...base,
    {
      suffix: "under",
      bands: inkBands,
      within: [[under0, under1]],
      root: `.${THREAD_CLASS.weaveUnder}`,
      target: `.${THREAD_CLASS.inkReveal}`,
      declare: ink,
    },
    {
      suffix: "over",
      bands: inkBands,
      within: [
        [0, under0],
        [under1, 1],
      ],
      root: `.${THREAD_CLASS.weaveOver}`,
      target: `.${THREAD_CLASS.inkReveal}`,
      declare: ink,
    },
  ];
}

function isWeave(section: SectionThread, segment: ThreadSegment): boolean {
  return (
    section.id === "wishes" &&
    segment.kind === "motif" &&
    segment.motif.id === "wishesLoop"
  );
}

/* Every per-tier rule this section needs: the connectors' own path data and wipe frames, the
   motifs' boxes, and one set of keyframes per segment per layer. The path data is per tier because
   a motif is a square off `min(width, height)` while its placement is a fraction of the section, so
   the section's aspect enters the geometry and cannot be removed at build time. */
function tierRules(
  section: SectionThread,
  tier: ThreadTier,
  placements: readonly Placement[],
  variant: string,
): string {
  const scope = `.${threadScopeClass(section.id)}`;
  const segments = threadSegments(section, tier, placements);
  const total = segments.reduce((sum, segment) => sum + segment.length, 0);
  const geometry: string[] = [];
  const animations: string[] = [];
  const frames: string[] = [];

  let travelled = 0;
  for (const segment of segments) {
    const selector = `${scope} .${segmentClass(segment.index)}`;
    const span: Span =
      total === 0
        ? { start: 0, end: 0 }
        : {
            start: travelled / total,
            end: (travelled + segment.length) / total,
          };
    travelled += segment.length;

    if (segment.kind === "connector") {
      geometry.push(
        rule(`${selector} .${THREAD_CLASS.connector}`, [
          `d: path("${segment.d}");`,
        ]),
        rule(`${selector} .${THREAD_CLASS.wipeFrame}`, [
          `transform: ${segment.frame};`,
        ]),
      );
    } else {
      geometry.push(
        rule(selector, [
          `--thread-motif-x: ${round(segment.placement.x)};`,
          `--thread-motif-y: ${round(segment.placement.y)};`,
          `--thread-motif-side: calc(${round(segment.placement.scale)} * 100svmin);`,
        ]),
      );
    }

    /* A zero-length segment cannot be scrubbed and does not need to be: it draws nothing. Every
       motif measures zero until Task 6 supplies its `d`, at which point these stops start moving
       without a second edit here. */
    if (segment.length === 0) continue;

    const weave = isWeave(section, segment);
    const emitted = emitSegment(
      section,
      tier,
      segment,
      span,
      layersFor(segment, weave),
      weave ? WEAVE_BAND : [],
      variant,
    );
    animations.push(...emitted.animations);
    frames.push(...emitted.keyframes);
  }

  const scrub =
    animations.length === 0
      ? ""
      : `\n@supports (animation-timeline: view()) {\n${[...animations, ...frames].join("\n")}\n}`;
  return `${geometry.join("\n")}${scrub}`;
}

/* The wisp is the thread's cut end, not an ornament, so a head or a tail mid-scrub carries one
   exactly as a terminal does — those are handled by the wisp layer above, which paints just outside
   the inked arc and so collapses to nothing at rest. The two ends that keep a wisp AT REST are the
   invite's top and Wishes' closing terminal (and both of `not-found`'s), and they are the ones with
   no connector to carry them: a stub past the free end is their whole geometry. */
export type ThreadStub = { which: "entry" | "exit"; d: string };

/* The two ends that keep a wisp AT REST are the ones with no connector to carry them: the invite's
   top, Wishes' closing terminal, and both of `not-found`'s. A short stub past the free end, along
   that end's own tangent, is their whole geometry. Every other free end is a head or a tail
   mid-scrub, and the wisp layer paints those just outside the inked arc. */
export function threadStubs(
  section: SectionThread,
  tier: ThreadTier,
  placements: readonly Placement[] = section.placements,
): ThreadStub[] {
  const stubs: ThreadStub[] = [];
  const draw = (
    placement: Placement,
    tangent: { x: number; y: number; angle: number },
    direction: 1 | -1,
    which: "entry" | "exit",
  ) => {
    const side = placement.scale * Math.min(tier.box.width, tier.box.height);
    const length = side * WISP_EXTENT * 6;
    const point = {
      x: placement.x + (tangent.x - 0.5) * (side / tier.box.width),
      y: placement.y + (tangent.y - 0.5) * (side / tier.box.height),
    };
    const radians = (tangent.angle * Math.PI) / 180;
    const away = {
      x: point.x + (direction * length * Math.cos(radians)) / tier.box.width,
      y: point.y + (direction * length * Math.sin(radians)) / tier.box.height,
    };
    stubs.push({
      which,
      d: `M ${round(away.x)} ${round(away.y)} L ${round(point.x)} ${round(point.y)}`,
    });
  };

  const first = placements[0];
  const last = placements[placements.length - 1];
  if (section.entryX === null && first !== undefined) {
    draw(first, MOTIFS[first.motif].entry, -1, "entry");
  }
  if (section.exitX === null && last !== undefined) {
    draw(last, MOTIFS[last.motif].exit, 1, "exit");
  }
  return stubs;
}

function stubRules(
  section: SectionThread,
  tier: ThreadTier,
  placements: readonly Placement[],
): string {
  const scope = `.${threadScopeClass(section.id)}`;
  return threadStubs(section, tier, placements)
    .map((stub) =>
      rule(`${scope} .${THREAD_CLASS.stub}--${stub.which}`, [
        `d: path("${stub.d}");`,
      ]),
    )
    .join("\n");
}

export function threadCss(section: SectionThread): string {
  const scope = `.${threadScopeClass(section.id)}`;
  const timeline = timelineName(section.id);

  const woven = threadSegments(section, THREAD_TIERS[0]).filter((segment) =>
    isWeave(section, segment),
  );

  const base: string[] = [
    rule(scope, [
      `view-timeline-name: ${timeline};`,
      "view-timeline-axis: block;",
      `--thread-mask-width: ${round(MASK_WIDTH)};`,
      ...(woven.length === 0
        ? []
        : [
            `--thread-weave-under: ${round(WEAVE_BAND[0])} ${round(WEAVE_BAND[1])};`,
            `--thread-weave-over: 0 ${round(WEAVE_BAND[0])}, ${round(WEAVE_BAND[1])} 1;`,
          ]),
    ]),
    /* The complete thread, declared unconditionally: a full wipe on every connector and a fully
       inked dash on every motif. Everything below only ever narrows it. */
    rule(`${scope} .${THREAD_CLASS.inkReveal}`, [
      `transform: ${wipeTransform(FULL, "y")};`,
      `stroke-dasharray: ${dashArray([FULL])};`,
    ]),
    rule(`${scope} .${THREAD_CLASS.wispReveal}`, [
      `transform: ${wipeTransform([0, 0], "y")};`,
      `stroke-dasharray: ${dashArray([])};`,
    ]),
  ];

  /* The weave is a property of the COMPLETE thread, not of the scrub, so the two copies split the
     loop at rest as well as mid-draw — otherwise a resting page paints both copies whole and the
     pass behind the illustration never reads. */
  for (const segment of woven) {
    const [under0, under1] = WEAVE_BAND;
    base.push(
      rule(
        `${scope}.${THREAD_CLASS.weaveUnder} .${segmentClass(segment.index)} .${THREAD_CLASS.inkReveal}`,
        [`stroke-dasharray: ${dashArray([[under0, under1]])};`],
      ),
      rule(
        `${scope}.${THREAD_CLASS.weaveOver} .${segmentClass(segment.index)} .${THREAD_CLASS.inkReveal}`,
        [
          `stroke-dasharray: ${dashArray([
            [0, under0],
            [under1, 1],
          ])};`,
        ],
      ),
    );
  }

  const tiers = THREAD_TIERS.flatMap((tier) => {
    const body = [
      tierRules(section, tier, section.placements, ""),
      stubRules(section, tier, section.placements),
    ]
      .filter((piece) => piece.length > 0)
      .join("\n");
    const blocks = [`@media ${tier.media} {\n${body}\n}`];

    /* The stacked band and this tier's band are intersected rather than `and`-ed, so a tier the
       arrangement cannot reach emits no block at all instead of a query that is never true. */
    const from = Math.max(tier.from, STACKED_REGIME.from);
    const to = Math.min(tier.to, STACKED_REGIME.to);
    if (section.stacked !== undefined && from < to) {
      const stackedBody = [
        tierRules(section, tier, section.stacked, "-stacked"),
        stubRules(section, tier, section.stacked),
      ]
        .filter((piece) => piece.length > 0)
        .join("\n");
      blocks.push(`@media ${widthQuery(from, to)} {\n${stackedBody}\n}`);
    }
    return blocks;
  });

  /* Reduced motion removes the animation and nothing else, which lands on the complete base above —
     one code path, not a second rendering of the same thread. */
  const reduced = `@media (prefers-reduced-motion: reduce) {\n${rule(
    `${scope} .${THREAD_CLASS.inkReveal}, ${scope} .${THREAD_CLASS.wispReveal}`,
    ["animation: none;"],
  )}\n}`;

  return [...base, ...tiers, reduced].join("\n");
}
