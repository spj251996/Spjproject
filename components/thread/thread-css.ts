/* Extension-qualified, unlike the rest of components/: plain node resolves a relative import only
   with its extension, and this module stays importable outside the app's bundler. */
import { type Band, THREAD_BANDS } from "./thread-bands.ts";
import { sectionBox } from "./thread-boxes.ts";
import type { SectionBox, ThreadId } from "./thread-geometry.ts";
import { MOTIFS } from "./thread-motifs.ts";
import {
  type Connector,
  MOTIF_PLACEMENTS,
  type Placement,
  THREAD_IDS,
  THREAD_PATHS,
} from "./thread-paths.ts";

/* One section's red thread as a static stylesheet, generated from the owner's own drawn paths
   (`thread-paths.ts`). Nothing here reads the page: the output is plain CSS that paints a COMPLETE
   thread on first render, and the scroll-driven layer subtracts from it (DESIGN.md -> Components ->
   Shell -> `thread-overlay`: "The complete thread is the base state, and the reveal subtracts from
   it"). Reduced motion, a page without scripting and a browser without scroll-linked animation
   therefore all land on the same base with nothing to suppress.

   ONE BOX PER SECTION, CARD-ANCHORED, NOT ONE BOX PER CONNECTOR. Every connector used to get its own
   SVG box, pinned to its two endpoints and stretched -- the single cause of a box collapsing to
   1.79px wide, a non-monotone mask-lead constant, an oblique butt-cap cut, and 100:1 anisotropy. A
   band's whole route now composes inside ONE `<svg viewBox="0 0 bandWidth sectionHeight">`
   (`thread-boxes.ts`'s measured box), positioned and sized off the CARD rather than the viewport
   (`/home/ag-95/.claude/plans/thread-authored-paths.md` -> Architecture). Every connector's `d` is
   already in that same box's own pixels (Task 4), so nothing here re-scales a curve; the browser's
   own `preserveAspectRatio="none"` stretch is the only distortion, and it is now UNIFORM across the
   whole section rather than different per connector.

   THE WHOLE THREAD DRAWS ITSELF. Every reveal -- motif and connector alike -- is a MASK per element:
   a dashed, BUTT-capped stroked copy of the same `d`, carrying `0 {tail} {head - tail} 1` on
   `pathLength="1"`. The butt cap is load-bearing: a round cap on a zero-length dash paints a dot,
   measured as stray specks.

   Every selector starts from the section's scope class, so two threads on one page never collide.
   The stylesheet is unlayered, so it wins over the utility and component layers. */

export const THREAD_CLASS = {
  root: "thread",
  /* The ink and the light are two sibling layers of the same box, and the split is load-bearing
     rather than tidy: the bleed is a `filter` on the ink layer alone, so the head and the re-trace
     move ABOVE that blurred buffer instead of inside it. */
  inkLayer: "thread__ink-layer",
  lightLayer: "thread__light-layer",
  /* One band's whole route, card-anchored and swapped in and out of view by the aspect query that
     owns it -- three of these exist per layer, mutually exclusive, never a shared union. */
  band: "thread__band",
  /* The connectors' own field inside a band: one `<svg>`, one combined path, one mask. */
  field: "thread__field",
  connector: "thread__connector",
  inkReveal: "thread__ink-reveal",
  wispReveal: "thread__wisp-reveal",
  wisp: "thread__wisp",
  stub: "thread__stub",
  motif: "thread__motif",
  motifPath: "thread__motif-path",
  head: "thread__head",
  headReveal: "thread__head-reveal",
  retrace: "thread__retrace",
  retraceReveal: "thread__retrace-reveal",
  /* One stroked copy of the path, at this layer's own alpha and width. The head and the re-trace
     are the same light on two clocks, so a layer of one is a layer of the other. */
  light: "thread__light",
  weaveUnder: "thread--weave-under",
  weaveOver: "thread--weave-over",
} as const;

export function threadScopeClass(id: ThreadId): string {
  return `thread--${id}`;
}

function bandClass(bandId: Band["id"]): string {
  return `${THREAD_CLASS.band}--${bandId}`;
}

function motifKey(bandId: Band["id"], index: number): string {
  return `motif-${bandId}-${index}`;
}

function motifClass(bandId: Band["id"], index: number): string {
  return `thread__${motifKey(bandId, index)}`;
}

function stubKey(bandId: Band["id"], which: "entry" | "exit"): string {
  return `stub-${bandId}-${which}`;
}

function stubClass(bandId: Band["id"], which: "entry" | "exit"): string {
  return `${THREAD_CLASS.stub}--${bandId}-${which}`;
}

/* One name per section, declared on the thread's own root -- which spans the section edge to edge,
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

/* INFERRED, not stated: how far past a FREE end its stub reaches, as a fraction of the band's own
   nominal `svmin`. A free end is one with no neighbouring section to hand the thread to; the stub is
   the wisp it keeps at rest. Baked into the `d` in nominal pixels now (card-anchoring stretches the
   whole section uniformly, the stub with it), where it used to be a live `svmin` CSS length -- a
   deliberate simplification, not an oversight: the stub is decoration, and it now moves with the
   same card-anchored geometry as everything else it is attached to. Owner: design-write. */
const STUB_REACH = 0.08;

/* Every motif's `d` is authored in a 0-100 square, not a 0-1 one (`thread-motifs.ts`, and
   `thread-geometry.test.ts` asserts each `d` starts at `entry.x * 100`). Both the svg that renders a
   motif and the box that converts its arc length to pixels read it from here, so the two cannot
   disagree about the convention again. */
export const MOTIF_SIDE = 100;

/* INFERRED, not stated: the mask stroke's width in the motif's own 0-100 square. The visible stroke
   is pinned at `--stroke-thread` by `vector-effect: non-scaling-stroke` while this one scales with
   the motif, so the binding case is the SMALLEST motif on the narrowest supported viewport -- the bow
   at `scale: 0.12` on a 320px screen, 38.4px across, where 1.6px is 4.17 of these units. 6 is the
   knee measured against that bow (`tmp/thread-spike`), unaffected by this refactor. Owner:
   design-write. */
const MASK_WIDTH = 6;

/* The reveal width for the CONNECTOR field, in the section box's own nominal pixels -- a FIXED
   generous constant rather than the old per-connector `CONNECTOR_MASK_COVER / min(box)` correction.
   That correction existed because a connector's own box could compress to a single pixel on one
   axis; one box per section removes that pathology, and the residual anisotropy left by the card
   anchor is bounded (~1.4x at the plan's worst measured case, not the 100:1 a collapsed per-connector
   box produced), so a fixed width comfortably clears the visible stroke on both axes without a
   per-band correction. Unverified by render at the extreme end of that bound -- see the task report.
   Owner: design-write. */
const CONNECTOR_MASK_WIDTH = 10;

/* MEASURED, in px: how far past each of its own ends a connector runs, so that a join reads as one
   continuous stroke.

   Every reveal mask is butt-capped and stops at its path's last point, while the visible stroke is
   round-capped and reaches `--stroke-thread` / 2 = 0.8px further. Two masks meeting at a shared
   point therefore each cut half a cap away and leave a slit of ivory between two flat edges --
   rendered, bisected and measured at the Family joins: dropping the MOTIF mask alone closed the
   seam, dropping the connector's did nothing, and `stroke-linecap: square` on the motif mask closed
   it too. The cap is the whole cause; the mask's width is not.

   Applied here as a plain straight-line extension along each end's own sampled tangent, in the
   section's own nominal pixels -- no box, no stretch, no cotangent correction, because the field's
   own coordinate system already IS the section's undistorted pixel box; the browser's later,
   uniform, whole-section stretch is what the old per-connector model could never assume. Owner:
   design-write. */
export const JOIN_OVERLAP = 2;

/* How far past the section box a connector's reveal mask reaches on every side, in nominal pixels.
   Generous and fixed rather than sampled: the old sampling existed because a collapsed per-connector
   box could throw a control point hundreds of box-widths out; a section-wide box never collapses, so
   a flat margin comfortably covering the join overlap, the stroke and the wisp's own reach costs
   nothing to declare and needs no measurement. */
const MASK_REGION_MARGIN = 48;

/* INFERRED, not stated: the arc of the Wishes loop that passes BEHIND the illustration. DESIGN.md
   requires the under-segment to cross the drawn figures rather than the pale surround, which is a
   routing requirement over a drawing that does not exist yet. Owner: design-write. */
const WEAVE_BAND: readonly [number, number] = [0.3, 0.7];

/* ---- the card-anchored box ------------------------------------------------------------------- */

/* The tier the frame's own content cap swaps on: `(64rem <= width < 100rem) and (orientation:
   landscape)`, `mounted-sheet-frame.ts`'s own `BREAKPOINT_REM`. Written out literally rather than
   imported -- the frame is a signed-off subsystem this task may read but never change, and the same
   literal already appears throughout `app/page.tsx`'s own Tailwind arbitrary variants. */
const COMPACT_CAP_QUERY =
  "(orientation: landscape) and (64rem <= width < 100rem)";

/* The card's own rendered width, reproduced in CSS from the same rule `mounted-sheet-frame-css.ts`
   emits (`tmp/thread-draw/card-width-probe.mjs`, Task 1, 48/48 exact against the render):
   `min(capContent, sectionWidth - 2 * ringSide)`. `--ring-side` is the frame's own resolved
   `padding-inline`, a real custom property that inherits from the scope div ancestor -- reachable
   only where the thread mounts INSIDE that subtree. Wishes does today (its `<SectionThread>` sits
   inside `MountedSheet`'s own content); a section mounted as a bare sibling of the frame cannot reach
   it by inheritance and falls back to `0px` -- a cap with no ring subtracted, not a correct answer.
   See the task report: resolving that is the cutover's call, not this one's, and it is the plan's own
   stated fork (Task 1, Step 3). */
function cardWidthExpr(): string {
  return "min(var(--thread-content-cap), calc(100% - 2 * var(--ring-side, 0px)))";
}

/* `bandWidth / nominalCardWidth`: the constant that turns the card's LIVE width into the band's own
   rendered width, so that at the band's own nominal viewport the box renders exactly `bandWidth`
   pixels wide and at every other viewport it stretches by the same ratio the card itself does.
   MEASURED against the real render at each band's nominal viewport (tall 393x700, upright 820x1180,
   wide 1536x695) -- see the task report for the probe and its numbers. A pair section (Event Info,
   Family) can resolve a different `--ring-side` than a single one at the SAME viewport, which is why
   this is keyed per section as well as per band, not assumed uniform. */
/* MEASURED against the real page's own `.mounted-sheet-frame__box` at each band's nominal viewport
   (`tmp/thread-debug/card-probe.mjs`), off Wishes -- the only section a card exists on today. `wide`
   (960) reproduces Task 1's own probe exactly. `tall` and `upright` are read off the SAME single
   section for every id, including the pairs (Event Info, Family): Task 1 found a pair CAN resolve a
   narrower ring than a single at the same viewport (832 vs 768 at 1024x768), so this is a known
   approximation, not a second measurement -- flagged in the task report, not silently assumed
   exact. Re-measure per section once more of the page carries a real card (the cutover, Task 8). */
const NOMINAL_CARD_WIDTH: Record<
  Band["id"],
  Record<Exclude<ThreadId, "not-found">, number>
> = {
  tall: {
    invite: 361,
    "event-info": 361,
    contact: 361,
    family: 361,
    celebrations: 361,
    wishes: 361,
  },
  upright: {
    invite: 564,
    "event-info": 564,
    contact: 564,
    family: 564,
    celebrations: 564,
    wishes: 564,
  },
  wide: {
    invite: 960,
    "event-info": 960,
    contact: 960,
    family: 960,
    celebrations: 960,
    wishes: 960,
  },
};

function of(id: ThreadId): Exclude<ThreadId, "not-found"> {
  return id === "not-found" ? "invite" : id;
}

function cardRatio(id: ThreadId, band: Band): number {
  return band.box.width / NOMINAL_CARD_WIDTH[band.id][of(id)];
}

function connectorsFor(id: ThreadId, band: Band): readonly Connector[] {
  return THREAD_PATHS[band.id][of(id)];
}

function placementsFor(id: ThreadId, band: Band): readonly Placement[] {
  return MOTIF_PLACEMENTS[band.id][of(id)];
}

/* A section hands the thread on to the one after it, so every boundary between two sections is a
   terminal -- except the page's own two ends, and both of `not-found`'s, which is a screen with no
   neighbours at all. `THREAD_IDS.indexOf` returns -1 for `not-found`, so both read as free ends,
   which is exactly right: `not-found` is closed at both. */
function hasEntry(id: ThreadId): boolean {
  return THREAD_IDS.indexOf(id as (typeof THREAD_IDS)[number]) > 0;
}

function hasExit(id: ThreadId): boolean {
  const at = THREAD_IDS.indexOf(id as (typeof THREAD_IDS)[number]);
  return at !== -1 && at < THREAD_IDS.length - 1;
}

function round(value: number): string {
  const fixed = value.toFixed(5).replace(/\.?0+$/, "");
  return fixed === "-0" ? "0" : fixed;
}

/* ---- the bands ------------------------------------------------------------------------------ */

/* Bounded ranges, not open-ended minimums, and half-open so no aspect can match two bands. */
function aspectQuery(band: Band): string {
  if (band.min === 0) return `(aspect-ratio < ${round(band.max)})`;
  if (band.max === Number.POSITIVE_INFINITY) {
    return `(${round(band.min)} <= aspect-ratio)`;
  }
  return `(${round(band.min)} <= aspect-ratio < ${round(band.max)})`;
}

/* ---- path reading ------------------------------------------------------------------------- */

type Point = { x: number; y: number };
type Command = { code: string; points: Point[] };

/* Only the commands the thread actually uses. Anything else THROWS rather than being skipped or
   approximated: an arc silently measured as a straight line would put a wrong number into every
   keyframe stop, and a wrong number that looks plausible is the failure this project keeps
   re-learning. */
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

/* Every drawn point of a path, in order, in the box it is rendered in. `box` scales the drawing --
   `{1,1}` reads it in its own literal units, which is what every connector and every motif is
   measured in now that neither lives inside a distorted per-element box. */
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
        points.push(scale(cursor));
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

function cumulative(points: readonly Point[]): number[] {
  const lengths = [0];
  for (let index = 1; index < points.length; index += 1) {
    lengths.push(
      lengths[index - 1] +
        Math.hypot(
          points[index].x - points[index - 1].x,
          points[index].y - points[index - 1].y,
        ),
    );
  }
  return lengths;
}

/* Exported so a test can exercise the measurement the keyframe stops are derived from, against
   lengths that are known by construction rather than produced by this same code. */
export function pathLength(d: string, box: SectionBox): number {
  const lengths = cumulative(samplePath(d, box));
  return lengths[lengths.length - 1] ?? 0;
}

/* The drawn extent of a path in the box it is rendered in. Test-facing, like `pathLength` above. */
export function pathBounds(
  d: string,
  box: SectionBox,
): { minX: number; minY: number; maxX: number; maxY: number } {
  const points = samplePath(d, box);
  return {
    minX: Math.min(...points.map((p) => p.x)),
    minY: Math.min(...points.map((p) => p.y)),
    maxX: Math.max(...points.map((p) => p.x)),
    maxY: Math.max(...points.map((p) => p.y)),
  };
}

/* The unit tangent at one end of a path, sampled from its first (or last) two drawn points -- not
   derived from a declared angle, because a section boundary and a free page-end carry no authored
   tangent at all (`thread-paths.ts`'s own docstring: "the drawn sheet leaves it loose"). Read at the
   START this points BACKWARD, continuing before the path's first point -- exactly the direction an
   entry stub needs; read at the END it points FORWARD, past the last point -- an exit stub's
   direction. */
function tangentAt(d: string, atStart: boolean): Point {
  const points = samplePath(d, { width: 1, height: 1 });
  const [near, far] = atStart
    ? [points[0], points[1]]
    : [points[points.length - 1], points[points.length - 2]];
  const dx = near.x - far.x;
  const dy = near.y - far.y;
  const size = Math.hypot(dx, dy);
  return size < 1e-9 ? { x: 0, y: 0 } : { x: dx / size, y: dy / size };
}

/* The same curve, extended `JOIN_OVERLAP` px past both ends along each end's own sampled tangent, so
   the round-capped visible stroke on the far side of a join is fully covered by this butt-capped
   mask. Plain straight extensions in the section's own undistorted pixels -- no wedge, no lead
   correction, because there is no per-connector stretch left to correct for. */
function extendReveal(d: string): string {
  const points = samplePath(d, { width: 1, height: 1 });
  const first = points[0];
  const last = points[points.length - 1];
  const startDir = tangentAt(d, true);
  const endDir = tangentAt(d, false);
  const head = {
    x: first.x + startDir.x * JOIN_OVERLAP,
    y: first.y + startDir.y * JOIN_OVERLAP,
  };
  const tail = {
    x: last.x + endDir.x * JOIN_OVERLAP,
    y: last.y + endDir.y * JOIN_OVERLAP,
  };
  const body = d.replace(/^M\s*[-\d.]+[\s,]+[-\d.]+\s*/, "");
  return `M ${round(head.x)} ${round(head.y)} L ${round(first.x)} ${round(first.y)} ${body} L ${round(tail.x)} ${round(tail.y)}`;
}

/* ---- segments, for the scrub's arc budget --------------------------------------------------- */

export type ThreadSegment =
  | { kind: "connector"; index: number; d: string; length: number }
  | { kind: "motif"; index: number; place: Placement; length: number };

/* The thread's segments in drawing order: `N` motifs give exactly `N + 1` connectors
   (`thread-paths.test.ts` pins the count), so the two arrays interleave with no routing model to
   resolve -- connector, motif, connector, motif, ..., connector. One walk, read by the generator and
   by nothing else: unlike the retired grid, there is no separate consumer left to disagree with it. */
export function threadSegments(id: ThreadId, band: Band): ThreadSegment[] {
  const connectors = connectorsFor(id, band);
  const motifs = placementsFor(id, band);
  const segments: ThreadSegment[] = [];
  connectors.forEach((connector, at) => {
    segments.push({
      kind: "connector",
      index: segments.length,
      d: connector.d,
      length: pathLength(connector.d, { width: 1, height: 1 }),
    });
    const place = motifs[at];
    if (place === undefined) return;
    const side = place.scale * Math.min(band.box.width, band.box.height);
    const step = side / MOTIF_SIDE;
    segments.push({
      kind: "motif",
      index: segments.length,
      place,
      length: pathLength(MOTIFS[place.motif].d, { width: step, height: step }),
    });
  });
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

function isTimed(id: ThreadId): boolean {
  return id === "not-found";
}

const HEAD_EXTENT = 0.06;

export const HEAD_LAYERS: readonly {
  name: string;
  alpha: number;
  width: number;
}[] = [
  { name: "tip", alpha: 1, width: 1 },
  { name: "trail", alpha: 0.5, width: 0.8 },
  { name: "fade", alpha: 0.22, width: 0.6 },
];

const HEAD_STEP = HEAD_EXTENT / HEAD_LAYERS.length;

const RETRACE_PASS = 2.4;
const RETRACE_GAP = 1.6;
const RETRACE_CYCLE = RETRACE_PASS + RETRACE_GAP;
const RETRACE_ACTIVE = RETRACE_PASS / RETRACE_CYCLE;
const RETRACE_REACH = 1 + HEAD_EXTENT;

const TIMED_DRAW_DELAY = 0.4;
const TIMED_DRAW_DURATION = 2.4;
const DRAW_REACH = THREAD_HOLD * (1 + HEAD_EXTENT);

type Band01 = readonly [number, number];

function inkBands(progress: number, span: Span): Band01[] {
  return [[localise(tailAt(progress), span), localise(headAt(progress), span)]];
}

function wispBands(progress: number, span: Span): Band01[] {
  const head = headAt(progress);
  const tail = tailAt(progress);
  return [
    [localise(head, span), localise(head + WISP_EXTENT, span)],
    [localise(tail - WISP_EXTENT, span), localise(tail, span)],
  ];
}

function intersect(
  bands: readonly Band01[],
  within: readonly Band01[],
): Band01[] {
  const out: Band01[] = [];
  for (const [a0, a1] of bands) {
    for (const [b0, b1] of within) {
      const lo = Math.max(a0, b0);
      const hi = Math.min(a1, b1);
      if (hi >= lo) out.push([lo, hi]);
    }
  }
  return out.sort((a, b) => a[0] - b[0]);
}

/* A four-value `stroke-dasharray` on `pathLength="1"` encodes one inked arc as
   `0 {tail} {head - tail} 1`; more arcs simply extend the same alternation. An empty list still has
   to paint nothing, which `0 1` does.

   THE TRAILING GAP IS 0 WHERE THE LAST BAND REACHES THE END, and that is not tidiness. A dash asked
   to cover a whole `pathLength="1"` path does not reach that path's end in Chromium: reproduced in
   isolation on one connector's own numbers (a 1x1 viewBox stretched to 95.577 x 328.302, the reveal
   copy butt-capped at `stroke-width: 0.042`), `0 0 1 1` stops about 7% short of the end while
   `0 0 1 0` and `none` both run to it. Masked by that dash, the visible stroke loses its last dozen
   pixels -- and where that end is a join, the section renders in two pieces with nothing wrong with
   its geometry. A zero gap closes it because the pattern then repeats with no gap in it. */
/* Two bands that touch or overlap are coalesced into one before walking the pattern. This never
   mattered for a single segment's own [tail, head] pair, but the connector group merges bands from
   several connectors that sit end to end in the combined path -- a fully-inked connector followed
   immediately by another gives two ADJACENT bands with nothing between them, and left unmerged that
   emits a real dash, a ZERO-length gap, then another dash where one continuous dash was meant:
   harmless on screen (a zero-length gap never lifts the pen), but not the same pattern the retired
   single-segment model ever had reason to emit. */
function mergeBands(bands: readonly Band01[]): Band01[] {
  const sorted = [...bands].sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const [start, end] of sorted) {
    const last = merged[merged.length - 1];
    if (last !== undefined && start <= last[1] + 1e-9) {
      last[1] = Math.max(last[1], end);
    } else {
      merged.push([start, end]);
    }
  }
  return merged;
}

function dashArray(bands: readonly Band01[], scale: number): string {
  if (bands.length === 0 || scale <= 0) return "0 1";
  const values: number[] = [0];
  let cursor = 0;
  for (const [start, end] of mergeBands(bands)) {
    const from = clamp(start * scale);
    const to = Math.max(from, clamp(end * scale));
    values.push(from - cursor, to - from);
    cursor = to;
  }
  const emitted = values.map((value) => round(Math.max(0, value)));
  const reach = emitted.reduce((sum, value) => sum + Number(value), 0);
  return [...emitted, reach >= 1 ? "0" : "1"].join(" ");
}

const FULL: Band01 = [0, 1];

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

function timedDrawDecls(name: string): string[] {
  return [
    `animation-name: ${name};`,
    `animation-duration: ${round(TIMED_DRAW_DURATION)}s;`,
    `animation-delay: ${round(TIMED_DRAW_DELAY)}s;`,
    "animation-fill-mode: both;",
    "animation-timing-function: linear;",
  ];
}

type Layer = {
  suffix: string;
  clock: "view" | "time";
  bands: (progress: number, span: Span) => Band01[];
  arcs: (span: Span) => number[];
  cap: boolean;
  within: readonly Band01[];
  root: string;
  target: string;
};

const NO_ARCS = () => [];

function headBands(index: number) {
  return (leading: number, span: Span): Band01[] => [
    [
      localise(leading - (index + 1) * HEAD_STEP, span),
      localise(leading - index * HEAD_STEP, span),
    ],
  ];
}

function headArcs(index: number) {
  return (span: Span) =>
    [span.start, span.end].flatMap((arc) => [
      arc + index * HEAD_STEP,
      arc + (index + 1) * HEAD_STEP,
    ]);
}

function headLayer(name: string, index: number): Layer {
  return {
    suffix: `head-${name}`,
    clock: "view",
    bands: (progress, span) => headBands(index)(progress / THREAD_HOLD, span),
    arcs: headArcs(index),
    cap: index === 0,
    within: [FULL],
    root: "",
    target: `.${THREAD_CLASS.headReveal}--${name}`,
  };
}

function retraceLayer(name: string, index: number): Layer {
  return {
    suffix: `retrace-${name}`,
    clock: "time",
    bands: (cycle, span) =>
      headBands(index)(
        RETRACE_REACH * Math.min(1, cycle / RETRACE_ACTIVE),
        span,
      ),
    arcs: NO_ARCS,
    cap: index === 0,
    within: [FULL],
    root: "",
    target: `.${THREAD_CLASS.retraceReveal}--${name}`,
  };
}

const BASE_LAYERS: readonly Layer[] = [
  {
    suffix: "ink",
    clock: "view",
    bands: inkBands,
    arcs: NO_ARCS,
    cap: false,
    within: [FULL],
    root: "",
    target: `.${THREAD_CLASS.inkReveal}`,
  },
  {
    suffix: "wisp",
    clock: "view",
    bands: wispBands,
    arcs: NO_ARCS,
    cap: false,
    within: [FULL],
    root: "",
    target: `.${THREAD_CLASS.wispReveal}`,
  },
  ...HEAD_LAYERS.map((layer, index) => headLayer(layer.name, index)),
  ...HEAD_LAYERS.map((layer, index) => retraceLayer(layer.name, index)),
];

function layersFor(weave: boolean): readonly Layer[] {
  if (!weave) return BASE_LAYERS;
  const [under0, under1] = WEAVE_BAND;
  const copies = [
    {
      which: "under",
      root: `.${THREAD_CLASS.weaveUnder}`,
      within: [[under0, under1]] as readonly Band01[],
    },
    {
      which: "over",
      root: `.${THREAD_CLASS.weaveOver}`,
      within: [
        [0, under0],
        [under1, 1],
      ] as readonly Band01[],
    },
  ];
  return [
    ...BASE_LAYERS,
    ...BASE_LAYERS.filter((layer) => layer.suffix !== "wisp").flatMap((layer) =>
      copies.map(({ which, root, within }) => ({
        ...layer,
        suffix: layer.suffix === "ink" ? which : `${layer.suffix}-${which}`,
        within,
        root,
      })),
    ),
  ];
}

/* The weave is a property of WISHES' own section -- the couple illustration sits there, mounted
   twice (`weave="under"`/`"over"`) either side of it -- not of one fixed motif name. Task 4's own
   fitting found `wishesLoop` actually attaches inside CELEBRATIONS' box by y-range, and the sole
   motif Wishes places in every band is `bow`; hardcoding "wishesLoop" here (this file's own
   pre-Task-4 assumption) would silently stop splitting the loop the illustration sits behind. Every
   motif Wishes places is treated as the weave motif -- today that is `bow` alone, in all three
   bands. */
function isWeave(id: ThreadId, segment: ThreadSegment): boolean {
  return id === "wishes" && segment.kind === "motif";
}

function cycleStops(span: Span): number[] {
  const all = [0, RETRACE_ACTIVE, 1];
  for (const arc of [span.start, span.end]) {
    for (let layer = 0; layer <= HEAD_LAYERS.length; layer += 1) {
      const at = ((arc + layer * HEAD_STEP) / RETRACE_REACH) * RETRACE_ACTIVE;
      if (at > 0 && at < RETRACE_ACTIVE) all.push(at);
    }
  }
  return [...new Set(all.map((at) => Number(at.toFixed(6))))].sort(
    (a, b) => a - b,
  );
}

function capDecl(dash: string): string[] {
  const draws = dash
    .split(" ")
    .filter((_, at) => at % 2 === 0)
    .some((length) => Number(length) > 0);
  return [`stroke-linecap: ${draws ? "round" : "butt"};`];
}

function animationDecls(
  name: string,
  layer: Layer,
  id: ThreadId,
  onClock: boolean,
): string[] {
  if (layer.clock === "time") {
    return [
      `animation-name: ${name};`,
      `animation-duration: ${round(RETRACE_CYCLE)}s;`,
      "animation-iteration-count: infinite;",
      "animation-fill-mode: both;",
      "animation-timing-function: linear;",
    ];
  }
  if (onClock) return timedDrawDecls(name);
  return [
    `animation-name: ${name};`,
    `animation-timeline: ${timelineName(id)};`,
    "animation-fill-mode: both;",
    "animation-timing-function: linear;",
  ];
}

/* A single MOTIF's own reveal: unchanged mechanism from before this task, since a motif is still
   its own uniformly-scaled square SVG and its own single element -- that is what holds a motif's
   aspect at 0.0% spread across viewports, and this refactor leaves it alone. */
function emitMotifSegment(
  id: ThreadId,
  band: Band,
  segment: ThreadSegment & { kind: "motif" },
  selector: string,
  span: Span,
  layers: readonly Layer[],
  extraStops: readonly number[],
  animated: Set<string>,
): { animations: string[]; keyframes: string[] } {
  const animations: string[] = [];
  const emitted: string[] = [];
  const timed = isTimed(id);

  for (const layer of layers) {
    /* `band.id` is load-bearing here, not decoration: `segment.index` is local to each band's own
       `threadSegments` walk, so two DIFFERENT bands can hand this the same index -- without the
       band in the name, the second band's `@keyframes` block would silently redefine the first
       one's, and the later definition wins (`no two keyframes in a section's sheet share a name`
       is what this guards). */
    const name = `thread-${id}-${band.id}-${segment.index}-${layer.suffix}`;
    const fullSelector = `${selector}${layer.root} ${layer.target}`;
    const onClock = timed && layer.clock === "view";
    const scrub =
      layer.clock === "time"
        ? cycleStops(span)
        : stops(span, [...extraStops, ...layer.arcs(span)]);
    const at = onClock ? drawStops(scrub) : scrub;
    const frames = at.map((stop) => {
      const dash = dashArray(
        intersect(layer.bands(stop, span), layer.within),
        1,
      );
      const decls = [`stroke-dasharray: ${dash};`];
      if (layer.cap) decls.push(...capDecl(dash));
      return { at: onClock ? stop / DRAW_REACH : stop, decl: decls.join(" ") };
    });
    animations.push(
      rule(fullSelector, animationDecls(name, layer, id, onClock)),
    );
    animated.add(fullSelector);
    emitted.push(keyframes(name, frames));
  }
  return { animations, keyframes: emitted };
}

function drawStops(scrub: readonly number[]): number[] {
  const within = scrub.filter((stop) => stop <= DRAW_REACH);
  return [...new Set([...within, DRAW_REACH])].sort((a, b) => a - b);
}

/* ---- the connector group: one field per band, one path, one mask per layer ------------------- */

type ConnectorSpan = {
  segment: ThreadSegment & { kind: "connector" };
  span: Span;
  offset: number;
};

/* Every connector segment of a band, carrying its GLOBAL span (its share of the whole thread's arc,
   motifs included -- what times it against the scrub) alongside its OFFSET within the connector-only
   total (what places it inside the combined path's own `pathLength="1"`). The two totals differ by
   exactly the motifs' own arc length, and that is the whole point: a `moveto` between two connectors
   contributes zero to the combined path, so the combined dash holds flat while a motif between them
   animates on its own separate element, and resumes advancing the instant the next connector's own
   span begins. */
function connectorSpans(segments: readonly ThreadSegment[]): {
  spans: ConnectorSpan[];
  total: number;
} {
  const overall = segments.reduce((sum, s) => sum + s.length, 0);
  const spans: ConnectorSpan[] = [];
  let travelled = 0;
  let offset = 0;
  for (const segment of segments) {
    if (segment.kind === "connector") {
      spans.push({
        segment,
        offset,
        span:
          overall === 0
            ? { start: 0, end: 0 }
            : {
                start: travelled / overall,
                end: (travelled + segment.length) / overall,
              },
      });
      offset += segment.length;
    }
    travelled += segment.length;
  }
  return { spans, total: offset };
}

function emitConnectorGroup(
  id: ThreadId,
  band: Band,
  spans: readonly ConnectorSpan[],
  total: number,
  fieldSelector: string,
  animated: Set<string>,
): { animations: string[]; keyframes: string[] } {
  const animations: string[] = [];
  const emitted: string[] = [];
  const timed = isTimed(id);
  const layers = BASE_LAYERS;

  for (const layer of layers) {
    const name = `thread-${id}-connectors-${layer.suffix}-${band.id}`;
    const selector = `${fieldSelector} ${layer.target}`;
    const onClock = timed && layer.clock === "view";

    const stopSet = new Set<number>();
    for (const { span } of spans) {
      const scrub =
        layer.clock === "time"
          ? cycleStops(span)
          : stops(span, layer.arcs(span));
      for (const stop of scrub) stopSet.add(stop);
    }
    const scrub = [...stopSet].sort((a, b) => a - b);
    const at = onClock ? drawStops(scrub) : scrub;

    const frames = at.map((stop) => {
      const merged: Band01[] = [];
      for (const { segment, span, offset } of spans) {
        if (total <= 0) continue;
        /* A DEGENERATE band (start === end -- this connector's span not reached yet, or already
           passed) is kept, not dropped: `intersect`'s own `hi >= lo` already decided it belongs,
           and dropping it removes the only band carrying THIS connector's position in the
           combined path, which starves `dashArray` down to its zero-bands shortcut ("0 1",
           read as the gap covering the whole path FROM POSITION 0) instead of the zero-length
           band it should encode at this connector's own offset. That collapse is exactly what
           broke monotonicity: the first frame (nothing drawn, offset 0) correctly read position
           0, but the LAST frame (also nothing drawn, fully retracted, offset 1) fell back to the
           same shortcut and read as position 0 again -- a start that visibly moved backwards. */
        for (const [a, b] of intersect(layer.bands(stop, span), layer.within)) {
          merged.push([
            (offset + a * segment.length) / total,
            (offset + b * segment.length) / total,
          ]);
        }
      }
      const dash = dashArray(merged, 1);
      const decls = [`stroke-dasharray: ${dash};`];
      if (layer.cap) decls.push(...capDecl(dash));
      return { at: onClock ? stop / DRAW_REACH : stop, decl: decls.join(" ") };
    });
    animations.push(rule(selector, animationDecls(name, layer, id, onClock)));
    animated.add(selector);
    emitted.push(keyframes(name, frames));
  }
  return { animations, keyframes: emitted };
}

/* ---- stubs -------------------------------------------------------------------------------- */

export type ThreadStub = { which: "entry" | "exit"; d: string };

function stubFor(
  which: "entry" | "exit",
  connectorD: string,
  nominalSvmin: number,
): ThreadStub {
  const atStart = which === "entry";
  const points = samplePath(connectorD, { width: 1, height: 1 });
  const point = atStart ? points[0] : points[points.length - 1];
  const dir = tangentAt(connectorD, atStart);
  const reach = STUB_REACH * nominalSvmin;
  const away = { x: point.x + dir.x * reach, y: point.y + dir.y * reach };
  return {
    which,
    d: `M ${round(point.x)} ${round(point.y)} L ${round(away.x)} ${round(away.y)}`,
  };
}

/* ---- the sheet ------------------------------------------------------------------------------ */

export type BandMotif = {
  key: string;
  className: string;
  d: string;
};

/* Everything the component mounts for ONE band: the field (one combined connector `d`/`revealD`),
   the free-end stubs this band actually has, and every motif this band places. Bands are mutually
   exclusive by aspect, so unlike the retired grid there is no union to build and no spare element to
   hide -- each band's own markup is self-contained and simply not displayed outside its own query. */
export type BandMarkup = {
  bandId: Band["id"];
  fieldClassName: string;
  connectorD: string;
  revealD: string;
  region: { min: number; max: number; box: SectionBox };
  stubs: readonly (ThreadStub & { key: string; className: string })[];
  motifs: readonly (BandMotif & { motifId: Placement["motif"] })[];
};

export function bandMarkup(id: ThreadId, band: Band): BandMarkup {
  const nominalSvmin = Math.min(band.box.width, band.box.height);
  const connectors = connectorsFor(id, band);
  const motifs = placementsFor(id, band);
  const connectorD = connectors.map((c) => c.d).join(" ");
  const revealD = connectors.map((c) => extendReveal(c.d)).join(" ");

  const stubs: (ThreadStub & { key: string; className: string })[] = [];
  if (!hasEntry(id)) {
    const stub = stubFor("entry", connectors[0].d, nominalSvmin);
    stubs.push({
      ...stub,
      key: stubKey(band.id, "entry"),
      className: stubClass(band.id, "entry"),
    });
  }
  if (!hasExit(id)) {
    const stub = stubFor(
      "exit",
      connectors[connectors.length - 1].d,
      nominalSvmin,
    );
    stubs.push({
      ...stub,
      key: stubKey(band.id, "exit"),
      className: stubClass(band.id, "exit"),
    });
  }

  return {
    bandId: band.id,
    fieldClassName: THREAD_CLASS.field,
    connectorD,
    revealD,
    region: {
      min: -MASK_REGION_MARGIN,
      max: MASK_REGION_MARGIN,
      box: { width: band.box.width, height: sectionHeight(id, band) },
    },
    stubs,
    motifs: motifs.map((place, at) => ({
      key: motifKey(band.id, at),
      className: motifClass(band.id, at),
      d: MOTIFS[place.motif].d,
      motifId: place.motif,
    })),
  };
}

/* A section's measured height (`thread-boxes.ts`), not the band's own device height: a paired
   section stacks in portrait and Celebrations is a list, so both run taller than one screen. */
function sectionHeight(id: ThreadId, band: Band): number {
  return sectionBox(id, band.id).height;
}

function bandRules(id: ThreadId, band: Band, animated: Set<string>): string {
  const scope = `.${threadScopeClass(id)}`;
  const markup = bandMarkup(id, band);
  /* The SAME box the viewBox itself is built from (`markup.region.box`), read once here rather than
     re-measured -- two calls to `sectionHeight` used to disagree the moment one drifted from the
     other, which the mutation test below exists to catch: mutating the viewBox's own box left a
     motif's position fraction computed against the band's flat nominal height instead, and every
     gate stayed green until a render actually showed it split from its connector. */
  const box: SectionBox = markup.region.box;
  const fieldSelector = `${scope} .${bandClass(band.id)} .${THREAD_CLASS.field}`;

  const geometry: string[] = [
    rule(`${scope} .${bandClass(band.id)}`, [
      "display: block;",
      `width: calc(${round(cardRatio(id, band))} * ${cardWidthExpr()});`,
    ]),
    rule(
      [
        `${fieldSelector} .${THREAD_CLASS.connector}`,
        `${fieldSelector} .${THREAD_CLASS.wisp}`,
        `${fieldSelector} .${THREAD_CLASS.light}`,
      ].join(", "),
      [`d: path("${markup.connectorD}");`],
    ),
    rule(
      [
        `${fieldSelector} .${THREAD_CLASS.inkReveal}`,
        `${fieldSelector} .${THREAD_CLASS.wispReveal}`,
        `${fieldSelector} .${THREAD_CLASS.headReveal}`,
        `${fieldSelector} .${THREAD_CLASS.retraceReveal}`,
      ].join(", "),
      [`d: path("${markup.revealD}");`],
    ),
    rule(fieldSelector, [
      `--thread-mask-width: ${round(CONNECTOR_MASK_WIDTH)};`,
    ]),
  ];

  for (const stub of markup.stubs) {
    geometry.push(
      rule(`${fieldSelector} .${stub.className}`, [`d: path("${stub.d}");`]),
    );
  }

  const segments = threadSegments(id, band);
  const { spans, total } = connectorSpans(segments);
  const animations: string[] = [];
  const frames: string[] = [];

  const connectorEmitted = emitConnectorGroup(
    id,
    band,
    spans,
    total,
    fieldSelector,
    animated,
  );
  animations.push(...connectorEmitted.animations);
  frames.push(...connectorEmitted.keyframes);

  const overallTotal = segments.reduce((sum, s) => sum + s.length, 0);

  /* Motifs are still individual elements, so they still ride `threadSegments`'s own ordering to
     find their GLOBAL span -- the same mechanism the connector group above reads its span from. */
  let cursor = 0;
  for (const segment of segments) {
    const span: Span =
      overallTotal === 0
        ? { start: 0, end: 0 }
        : {
            start: cursor / overallTotal,
            end: (cursor + segment.length) / overallTotal,
          };
    cursor += segment.length;
    if (segment.kind !== "motif") continue;

    const at = segments
      .filter((s) => s.kind === "motif")
      .findIndex((s) => s === segment);
    const motif = markup.motifs[at];
    const place = segment.place;
    /* `scale * nominalSvmin / bandWidth`: the motif's own side as a fraction of the BAND WRAPPER's
       rendered width -- algebraically identical to `scale * nominalSvmin / nominalCardWidth` (the
       plan's own `scale_card`) TIMES the wrapper's own `bandWidth / nominalCardWidth` ratio, i.e. the
       side as a fraction of the card, converted once more into a fraction of the wrapper that is
       already tracking the card. A `%` read directly off `--ring-side`/the content cap here would
       resolve against the motif's OWN containing block (the band wrapper, already scaled) rather
       than the section the wrapper itself reads its `100%` against -- computed here as a plain
       constant instead, which sidesteps that double-scaling rather than correcting for it. */
    const sidePct =
      (place.scale * Math.min(band.box.width, band.box.height)) /
      band.box.width;
    geometry.push(
      rule(`${scope} .${bandClass(band.id)} .${motif.className}`, [
        `--thread-motif-x: ${round(place.x / box.width)};`,
        `--thread-motif-y: ${round(place.y / box.height)};`,
        `--thread-motif-side: ${round(sidePct * 100)}%;`,
        ...(place.mirror ? ["scale: -1 1;"] : []),
        ...(round(place.turn) === "0"
          ? []
          : [`rotate: ${round(place.turn)}deg;`]),
      ]),
    );

    if (segment.length === 0) continue;
    const weave = isWeave(id, segment);
    const selector = `${scope} .${bandClass(band.id)} .${motif.className}`;
    const emitted = emitMotifSegment(
      id,
      band,
      segment as ThreadSegment & { kind: "motif" },
      selector,
      span,
      layersFor(weave),
      weave ? WEAVE_BAND : [],
      animated,
    );
    animations.push(...emitted.animations);
    frames.push(...emitted.keyframes);
  }

  const draw = [...animations, ...frames].join("\n");
  const scrub =
    animations.length === 0
      ? ""
      : isTimed(id)
        ? `\n${draw}`
        : `\n@supports (animation-timeline: view()) {\n${draw}\n}`;
  return `${geometry.filter((piece) => piece.length > 0).join("\n")}${scrub}`;
}

export function threadCss(id: ThreadId): string {
  const scope = `.${threadScopeClass(id)}`;
  const timeline = timelineName(id);
  const animated = new Set<string>();

  const woven = THREAD_BANDS.some((band) =>
    threadSegments(id, band).some((segment) => isWeave(id, segment)),
  );

  const base: string[] = [
    rule(scope, [
      ...(isTimed(id)
        ? []
        : [`view-timeline-name: ${timeline};`, "view-timeline-axis: block;"]),
      `--thread-mask-width: ${round(MASK_WIDTH)};`,
      "--thread-content-cap: var(--container-content);",
      ...(woven
        ? [
            `--thread-weave-under: ${round(WEAVE_BAND[0])} ${round(WEAVE_BAND[1])};`,
            `--thread-weave-over: 0 ${round(WEAVE_BAND[0])}, ${round(WEAVE_BAND[1])} 1;`,
          ]
        : []),
    ]),
    `@media ${COMPACT_CAP_QUERY} {\n${rule(scope, [
      "--thread-content-cap: var(--container-content-compact);",
    ])}\n}`,
    rule(`${scope} .${THREAD_CLASS.band}`, [
      "position: absolute;",
      "left: 50%;",
      "top: 0;",
      "height: 100%;",
      "transform: translateX(-50%);",
      "display: none;",
    ]),
    rule(`${scope} .${THREAD_CLASS.field}`, [
      "position: absolute;",
      "inset: 0;",
      "width: 100%;",
      "height: 100%;",
      "overflow: visible;",
    ]),
    rule(`${scope} .${THREAD_CLASS.inkReveal}`, [
      `stroke-dasharray: ${dashArray([FULL], 1)};`,
    ]),
    rule(`${scope} .${THREAD_CLASS.wispReveal}`, [
      `stroke-dasharray: ${dashArray([], 1)};`,
    ]),
    rule(
      `${scope} .${THREAD_CLASS.headReveal}, ${scope} .${THREAD_CLASS.retraceReveal}`,
      [`stroke-dasharray: ${dashArray([], 1)};`],
    ),
    rule(`${scope} .${THREAD_CLASS.inkLayer}`, [
      `filter: ${BLEED.map(
        ([alpha, radius]) =>
          `drop-shadow(color-mix(in srgb, var(--color-thread-vermilion) ${round(alpha)}%, transparent) 0 0 ${round(radius)}px)`,
      ).join(" ")};`,
    ]),
    ...HEAD_LAYERS.map((layer) =>
      rule(`${scope} .${THREAD_CLASS.light}--${layer.name}`, [
        "stroke: var(--color-thread-vermilion);",
        `stroke-width: ${
          layer.width === 1
            ? "var(--stroke-thread)"
            : `calc(var(--stroke-thread) * ${round(layer.width)})`
        };`,
        `stroke-opacity: ${round(layer.alpha)};`,
      ]),
    ),
  ];

  if (woven) {
    for (const band of THREAD_BANDS) {
      for (const segment of threadSegments(id, band)) {
        if (!isWeave(id, segment)) continue;
        const at = threadSegments(id, band)
          .filter((s) => s.kind === "motif")
          .findIndex((s) => s === segment);
        const className = motifClass(band.id, at);
        const [under0, under1] = WEAVE_BAND;
        base.push(
          rule(
            `${scope}.${THREAD_CLASS.weaveUnder} .${bandClass(band.id)} .${className} .${THREAD_CLASS.inkReveal}`,
            [`stroke-dasharray: ${dashArray([[under0, under1]], 1)};`],
          ),
          rule(
            `${scope}.${THREAD_CLASS.weaveOver} .${bandClass(band.id)} .${className} .${THREAD_CLASS.inkReveal}`,
            [
              `stroke-dasharray: ${dashArray(
                [
                  [0, under0],
                  [under1, 1],
                ],
                1,
              )};`,
            ],
          ),
        );
      }
    }
  }

  const bands = THREAD_BANDS.map(
    (band) =>
      `@media ${aspectQuery(band)} {\n${bandRules(id, band, animated)}\n}`,
  );

  const gateName = `thread-${id}-retrace-gate`;
  const edge = 0.001;
  const gateFrames: readonly (readonly [number, number])[] = isTimed(id)
    ? [
        [0, 0],
        [1 - edge, 0],
        [1, 1],
      ]
    : [
        [0, 0],
        [THREAD_HOLD - edge, 0],
        [THREAD_HOLD, 1],
        [1 - THREAD_HOLD, 1],
        [1 - THREAD_HOLD + edge, 0],
        [1, 0],
      ];
  const gateBody =
    animated.size === 0
      ? ""
      : [
          rule(
            `${scope} .${THREAD_CLASS.retrace}`,
            isTimed(id)
              ? timedDrawDecls(gateName)
              : [
                  `animation-name: ${gateName};`,
                  `animation-timeline: ${timeline};`,
                  "animation-fill-mode: both;",
                  "animation-timing-function: linear;",
                ],
          ),
          keyframes(
            gateName,
            gateFrames.map(([at, opacity]) => ({
              at,
              decl: `opacity: ${opacity};`,
            })),
          ),
        ].join("\n");
  const gate =
    gateBody === ""
      ? ""
      : isTimed(id)
        ? `\n${gateBody}`
        : `\n@supports (animation-timeline: view()) {\n${gateBody}\n}`;
  if (animated.size > 0) animated.add(`${scope} .${THREAD_CLASS.retrace}`);

  const cancelled =
    animated.size > 0 ? [...animated] : [`${scope} .${THREAD_CLASS.inkReveal}`];
  const reduced = `@media (prefers-reduced-motion: reduce) {\n${cancelled
    .map((selector) => rule(selector, ["animation: none;"]))
    .join("\n")}\n}`;

  return [...base, ...bands, gate, reduced].join("\n");
}

const BLEED: readonly (readonly [number, number])[] = [
  [68, 3.5],
  [44, 12],
  [30, 33],
];
