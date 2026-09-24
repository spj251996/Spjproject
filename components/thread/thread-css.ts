/* Extension-qualified, unlike the rest of components/: plain node resolves a relative import only
   with its extension, and this module stays importable outside the app's bundler. */
import { type Band, THREAD_BANDS } from "./thread-bands.ts";
import {
  type ConnectorEnd,
  type Motif,
  resolveEnd,
  type SectionBox,
  type Tangent,
  TERMINAL_TANGENT,
  type ThreadId,
} from "./thread-geometry.ts";
import {
  motifAngle,
  routePoints,
  type SectionRoute,
  THREAD_IDS,
  THREAD_ROUTES,
} from "./thread-grid.ts";
import { MOTIFS } from "./thread-motifs.ts";
import { type Point, splinePath } from "./thread-spline.ts";

/* One section's red thread as a static stylesheet, generated from the section's own authored route.
   Nothing here reads the page: the output is plain CSS that paints a COMPLETE thread on first
   render, and the scroll-driven layer subtracts from it (DESIGN.md -> Components -> Shell ->
   `thread-overlay`: "The complete thread is the base state, and the reveal subtracts from it").
   Reduced motion, a page without scripting and a browser without scroll-linked animation therefore
   all land on the same base with nothing to suppress.

   Geometry is emitted PER ASPECT BAND, not per width tier. A motif is a square while a section is
   not, so it is the section's aspect that decides where a connector's ends land; each band's box is
   the nominal pixel box of the device it was chosen for, and at that device the render is 1:1.

   THE WHOLE THREAD DRAWS ITSELF. Every reveal — motif and connector alike — is a MASK per element:
   a dashed, BUTT-capped stroked copy of the same `d`, carrying `0 {tail} {head - tail} 1` on
   `pathLength="1"`. The butt cap is load-bearing: a round cap on a zero-length dash paints a dot,
   measured as stray specks. It is never a dash on the visible stroke, because every visible stroke
   needs `vector-effect: non-scaling-stroke` — a viewBox unit is ~0.78 screen px at phone and ~2.0
   at desktop, so one declared width would otherwise render at two — and a non-scaling stroke
   fragments a `pathLength` dash into disjoint runs, measured, with no stretch at all
   (`tmp/thread-spike/VERDICT.md` -> Q1).

   A mask stops where its own path stops, while the visible stroke's ROUND CAP reaches half a stroke
   width further. Every connector runs `JOIN_OVERLAP` past each of its own ends to cover that, rather
   than a mask reaching past its path — see the constant. A CONNECTOR's mask needs one thing more,
   because its box is stretched: its copy runs past the ink at both ends, so that the butt cap's
   oblique cut lands clear of it — see `MASK_LEAD`.

   Every selector starts from the section's scope class, so two threads on one page never collide.
   The stylesheet is unlayered, so it wins over the utility and component layers. */

export const THREAD_CLASS = {
  root: "thread",
  /* The ink and the light are two sibling layers of the same box, and the split is load-bearing
     rather than tidy: the bleed is a `filter` on the ink layer alone, so the head and the re-trace
     move ABOVE that blurred buffer instead of inside it. */
  inkLayer: "thread__ink-layer",
  lightLayer: "thread__light-layer",
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

/* INFERRED, not stated: how far past a FREE end its stub reaches, in `svmin` — the same unit a
   motif's square is sized in, so a stub is the same shape at every window. A free end is one with
   no neighbouring section to hand the thread to; the stub is the wisp it keeps at rest.
   Owner: design-write. */
const STUB_REACH = 0.08;

/* Every motif's `d` is authored in a 0-100 square, not a 0-1 one (`thread-motifs.ts`, and
   `thread-geometry.test.ts` asserts each `d` starts at `entry.x * 100`). Both the svg that renders a
   motif and the box that converts its arc length to pixels read it from here, so the two cannot
   disagree about the convention again. */
export const MOTIF_SIDE = 100;

/* INFERRED, not stated: the mask stroke's width in the motif's own 0-100 square. The visible stroke
   is pinned at `--stroke-thread` by `vector-effect: non-scaling-stroke` while this one scales with
   the motif, so the binding case is the SMALLEST motif on the narrowest supported viewport — the bow
   at `scale: 0.12` on a 320px screen, 38.4px across, where 1.6px is 4.17 of these units.

   MEASURED there against the same bow rendered with no mask at all: 4.5 leaves 96 of 1600 pixels
   lighter than unmasked, 5 leaves 74, 6 leaves 12, and 7 and above leave 4 — the floor, which is the
   round cap on the visible stroke that a butt-capped mask cannot reach. 6 is the knee, and 1.44x the
   stroke rather than 1x because both edges are antialiased and the two partial alphas multiply.

   Its stated upper bound — staying under the closest approach of two of the motif's own passes —
   CANNOT be met at any width that satisfies the above: `rings` is drawn as a doubled contour 0.62
   units apart and `portraitLoop` as offset passes 1.02 units apart, both deliberate, both an order
   of magnitude under the lower bound. Over-width reveals a neighbouring pass early, which shows only
   mid-scrub; under-width lightens the thread at rest. This takes the bound that has a render behind
   it. Owner: design-write. */
const MASK_WIDTH = 6;

/* The same knee, in CSS pixels, for a CONNECTOR's mask — which lives in a box stretched
   non-uniformly, so its width cannot be stated in the box's own units the way a motif's can. The
   generator converts: a stroke of `w` box-units renders `w x boxSide` px along each axis, so
   covering the visible stroke on BOTH axes needs `w = COVER / min(boxWidth, boxHeight)`.

   6 units on the 38.4px bow is 2.3px, and this takes 4 for the drift a band carries away from its
   nominal device. Over-width costs a connector nothing, unlike a motif: a connector is one open
   curve that never passes near itself, so there is no neighbouring pass for a wide mask to reveal
   early. Owner: design-write. */
const CONNECTOR_MASK_COVER = 4;

/* MEASURED, in px: how far past each of its own ends a connector runs, so that a join reads as one
   continuous stroke.

   Every reveal mask is butt-capped and stops at its path's last point, while the visible stroke is
   round-capped and reaches `--stroke-thread` / 2 = 0.8px further. Two masks meeting at a shared
   point therefore each cut half a cap away and leave a slit of ivory between two flat edges —
   rendered, bisected and measured at the Family joins: dropping the MOTIF mask alone closed the
   seam, dropping the connector's did nothing, and `stroke-linecap: square` on the motif mask closed
   it too. The cap is the whole cause; the mask's width is not (24 units changed nothing).

   The fix is the neighbour's ink, not a wider mask: a connector extended past the join runs along
   the tangent it meets, which is collinear with the ink it covers, so the overlap is invisible
   where it lands. Widening the mask instead is what the caps rule out — square or round caps paint
   a square or a dot on every ZERO-LENGTH dash, which is what the retracted state and every
   collapsed band are made of.

   2px is 2.5x the 0.8px cap, which covers it at dpr 1 with the antialiased edge on both sides. Its
   upper bound is the motif's own drawing: the overlap must not reach so far in that it reads as a
   doubled line where the motif's ink curves away from its own tangent. Owner: design-write. */
export const JOIN_OVERLAP = 2;

/* How far past the curve a reveal mask reaches, in the connector box's own units. It covers the
   visible stroke's own half-width, which no unit of the box can state — a box is as small as one
   pixel where a connector travels along a single axis. One whole box-width is generous at any size
   and costs nothing: the mask is bounded by the curve, not by this. */
const MASK_MARGIN = 1;

/* INFERRED, not stated: the arc of the Wishes loop that passes BEHIND the illustration. DESIGN.md
   requires the under-segment to cross the drawn figures rather than the pale surround, which is a
   routing requirement over a drawing that does not exist yet. Task 12 tunes it against the measured
   bar (under-segment ink hidden >= 60%). Owner: design-write. */
const WEAVE_BAND: readonly [number, number] = [0.3, 0.7];

/* ---- the light ------------------------------------------------------------------------------ */

/* PROVISIONAL, and DESIGN.md says so in those words: the bleed's three radii were carried across
   from the retired glow and had never been rendered, because `{colors.thread-vermilion}` had no
   consumer anywhere in the emitted CSS. The alphas and radii below are the doc's own, verbatim
   (Domain Components -> Thread -> the `bleed:` line).

   It is NEVER animated. A filter over ink that is itself being revealed is re-rasterised while the
   thread draws — the spike priced that blurred layer at +50ms/5s on its own — and an ANIMATED
   filter would re-rasterise at rest as well, which is the cost the design exists to avoid.

   `color-mix` rather than the relative-colour syntax: the alpha has to come off the token, and a
   literal hex here would be a design value the sheet computed. Owner: design-write. */
const BLEED: readonly (readonly [number, number])[] = [
  [68, 3.5],
  [44, 12],
  [30, 33],
];

/* INFERRED, not stated: how much of a section's thread the drawing head spans, tip and trail
   together, as a fraction of the thread's own length. DESIGN.md calls it "a short bright dash at
   the leading edge with further stroked copies of the same path behind it" and gives no figure.
   Owner: design-write. */
const HEAD_EXTENT = 0.06;

/* INFERRED, not stated: the head's layers, brightest first, at the "falling opacity and width"
   DESIGN.md asks for. Three is the fewest that reads as a tip with a trail behind it rather than
   as one dash; each carries an equal share of `HEAD_EXTENT`.

   The brightest layer is as WIDE as the ink and takes a round cap while its dash has length — the
   spike measured the laid ink's own round cap showing as a dark pip ahead of a butt-capped light
   (168 against 252 on the darkest channel, ground 255). A round cap on a ZERO-length dash paints a
   dot, so the cap is animated with the dash rather than declared. Owner: design-write. */
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

/* INFERRED, not stated: one re-trace pass and the gap between two passes, in seconds. DESIGN.md ->
   Foundations -> Motion makes the re-trace's cadence "a deliberate exception to the duration and
   easing scales" and gives no figure, so there is no token to read. Owner: design-write. */
const RETRACE_PASS = 2.4;
const RETRACE_GAP = 1.6;
const RETRACE_CYCLE = RETRACE_PASS + RETRACE_GAP;
const RETRACE_ACTIVE = RETRACE_PASS / RETRACE_CYCLE;

/* A pass carries the head its own extent PAST the thread's last point, exactly as the draw does, so
   the pen runs off the end instead of parking on it. */
const RETRACE_REACH = 1 + HEAD_EXTENT;

function round(value: number): string {
  const fixed = value.toFixed(5).replace(/\.?0+$/, "");
  return fixed === "-0" ? "0" : fixed;
}

/* ---- the bands ------------------------------------------------------------------------------ */

/* Bounded ranges, not open-ended minimums, and half-open so no aspect can match two bands. The
   brief's `(min-aspect-ratio: a) and (max-aspect-ratio: b)` spelling is inclusive at BOTH ends, so
   two adjacent bands would both match exactly at their shared edge — the overlap
   `thread-grid.test.ts` exists to forbid. The range syntax below is what the frame's own generated
   sheet already uses for widths, for the same reason. */
function aspectQuery(band: Band): string {
  if (band.min === 0) return `(aspect-ratio < ${round(band.max)})`;
  if (band.max === Number.POSITIVE_INFINITY) {
    return `(${round(band.min)} <= aspect-ratio)`;
  }
  return `(${round(band.min)} <= aspect-ratio < ${round(band.max)})`;
}

/* `not-found` is a one-to-one copy of the invite's thread — the same route, not a placement of its
   own. It is closed at both ends, because it has no neighbouring section to hand the thread to. */
function routeFor(id: ThreadId, band: Band): SectionRoute {
  const of = id === "not-found" ? "invite" : id;
  const route = THREAD_ROUTES.find(
    (candidate) => candidate.id === of && candidate.band === band.id,
  );
  if (route === undefined) {
    throw new Error(`thread-css: no route for "${id}" in band "${band.id}"`);
  }
  return route;
}

/* A section hands the thread on to the one after it, so every boundary between two sections is a
   terminal. The two ends of the PAGE are free instead, and so are both of `not-found`'s — a screen
   with no neighbours at all. A free end keeps a wisp at rest; a terminal's wisp is the next
   section's ink. */
function hasEntry(id: ThreadId): boolean {
  return THREAD_IDS.indexOf(id) > 0;
}

function hasExit(id: ThreadId): boolean {
  const at = THREAD_IDS.indexOf(id);
  return at !== -1 && at < THREAD_IDS.length - 1;
}

/* ---- pinning a connector's box ------------------------------------------------------------- */

/* A position the browser resolves rather than the generator: a percentage of the section box, a
   multiple of `svmin` — the unit `--thread-motif-side` is written in — and a pixel allowance. The
   three never collapse into one number at build time, because their ratio is the section's aspect
   and no nominal box knows it. */
type CssLength = { pct: number; svmin: number; px: number };

function endLength(
  end: ConnectorEnd,
  axis: "x" | "y",
  sign: 1 | -1,
  overlap: number,
): CssLength {
  const radians = (end.tangent.angle * Math.PI) / 180;
  return {
    pct: end.fraction[axis] * 100,
    svmin: end.svmin[axis] * 100,
    px: sign * overlap * (axis === "x" ? Math.cos(radians) : Math.sin(radians)),
  };
}

function lengthCss(length: CssLength): string {
  const terms: string[] = [];
  for (const [value, unit] of [
    [length.pct, "%"],
    [length.svmin, "svmin"],
    [length.px, "px"],
  ] as const) {
    if (Math.abs(value) < 1e-9) continue;
    const sign =
      terms.length === 0 ? (value < 0 ? "-" : "") : value < 0 ? " - " : " + ";
    terms.push(`${sign}${round(Math.abs(value))}${unit}`);
  }
  if (terms.length === 0) return "0px";
  const sum = terms.join("");
  return terms.length === 1 ? sum : `calc(${sum})`;
}

/* The box an element is given so it spans every point the curve passes through, whichever way round
   they fall — `min` and `max` are order-free, which is what lets a waypoint sit between the two
   ends without the generator having to know which end is nearer.

   The 1px floor keeps a box that collapses on one axis — a connector that travels straight down —
   from becoming a zero-size SVG viewport, which renders nothing at all; it costs at most 1px, and
   only where every point is already within 1px of the others on that axis. */
function boxCss(lengths: readonly CssLength[]): {
  start: string;
  size: string;
} {
  const terms = lengths.map(lengthCss);
  const start = terms.length === 1 ? terms[0] : `min(${terms.join(", ")})`;
  const end = terms.length === 1 ? terms[0] : `max(${terms.join(", ")})`;
  return {
    start,
    size: terms.length === 1 ? "1px" : `max(1px, calc(${end} - ${start}))`,
  };
}

/* ---- path reading ------------------------------------------------------------------------- */

type Command = { code: string; points: Point[] };

/* Only the commands the thread actually uses. Anything else THROWS rather than being skipped or
   approximated: an arc silently measured as a straight line would put a wrong number into every
   keyframe stop, and a wrong number that looks plausible is the failure this project keeps
   re-learning. A motif's drawing must stay inside this set or extend it deliberately. */
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

/* Every drawn point of a path, in order, in the box it is rendered in. Arc length, the mask region
   and the reparametrisation below all read the same samples, so none of them can disagree with
   another. */
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

/* The drawn extent of a path in the box it is rendered in. Test-facing, like `pathLength` above, and
   reading the same samples so the two cannot disagree: it is what lets a test say "a motif is drawn
   inside its own field" against the units rather than against a viewBox spelling. */
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

/* A `pathLength="1"` dash is measured in the path's OWN user space, and a connector's is the unit
   square its box stretches. So a band the owner reads as "half drawn" is half of the distorted
   length, not half of the rendered one, and the pen speeds up and slows down with direction.

   This is the correction: a monotone map from a fraction of the RENDERED arc, in the band's nominal
   pixels, to the fraction of the user-space arc that reaches the same point. A uniformly scaled path
   — every motif — maps identically and is left alone. */
type Reparametrise = (fraction: number) => number;

function reparametrise(
  d: string,
  box: SectionBox,
  /* The stretch of `d` the fraction is a fraction OF, in the box's pixels: a mask copy runs past
     the ink it reveals at both ends, so "half drawn" is half of the ink, not half of the copy. */
  window: { from: number; reach: number } | null = null,
): Reparametrise {
  const drawn = cumulative(samplePath(d, box));
  const user = cumulative(samplePath(d, { width: 1, height: 1 }));
  const total = drawn[drawn.length - 1];
  const userTotal = user[user.length - 1];
  if (!(total > 0) || !(userTotal > 0)) return (fraction) => fraction;
  const from = window?.from ?? 0;
  const reach = window?.reach ?? total;
  return (fraction) => {
    /* The ends SNAP to the copy's own ends rather than to the ink's. A fully drawn band has to
       cover the lead, or the cap lands back on the ink and the lead buys nothing; a fully
       retracted one has to start behind it, for the same reason at the other end. In between the
       rate is the ink's own, so the pen still advances evenly along what the reader sees. */
    if (fraction <= 0) return 0;
    if (fraction >= 1) return 1;
    const target = from + fraction * reach;
    let at = 1;
    while (at < drawn.length - 1 && drawn[at] < target) at += 1;
    const span = drawn[at] - drawn[at - 1];
    const share = span < 1e-12 ? 0 : (target - drawn[at - 1]) / span;
    return (user[at - 1] + share * (user[at] - user[at - 1])) / userTotal;
  };
}

/* A connector's box is stretched non-uniformly, and that is what makes its mask a different problem
   from a motif's. A `stroke-linecap: butt` is square-on to the path in the element's OWN space, and
   an anisotropic stretch turns it into an OBLIQUE cut across the rendered stroke — so the cap slices
   a wedge back ALONG the path instead of across it. MEASURED at the tall band's Event Info join,
   where the box is 84.5 x 272.8: the mask ended 5.5 px short of its own path's end and the thread
   rendered in two pieces. `stroke-linecap: square` closes it and is ruled out — a square cap paints
   a square on every zero-length dash, which the retracted state is made of — and
   `vector-effect: non-scaling-stroke` closes it and is ruled out too: re-measured here, it fragments
   the `pathLength` dash into 81 disjoint runs, exactly as the spike recorded (VERDICT.md -> Q1).

   So the mask copy RUNS PAST the ink at both ends, and the dash is mapped onto the stretch in the
   middle. The lead SCALES with `cot(the angle between the rendered cap line and the rendered path)`,
   computed per end rather than guessed, because that is the quantity the wedge grows with — but the
   multiplier is MEASURED, not derived. The obvious derivation (half the visible stroke times that
   cotangent) predicts 1.1 px at the tall band's Event Info join against 5.5 px observed, so it is
   wrong by about 5x and only its SHAPE is trusted here. 8 px at cot 1 is what closes every one of
   the join gate's 84 renders; 4 px leaves 26 of them broken in the `upright` band. The cap at 96 px
   is so a near-tangential end cannot produce an absurd path.

   None of the lead is ever inked. It is covered only when a band reaches the ink's own end, where
   the mapping snaps to the copy's end — see `reparametrise`. Owner: design-write. */
const MASK_LEAD = 8;
const MAX_MASK_LEAD = 96;

function maskCopy(
  d: string,
  nominal: SectionBox,
): { d: string; along: Reparametrise } {
  const drawn = samplePath(d, nominal);
  const user = samplePath(d, { width: 1, height: 1 });
  const total = pathLength(d, nominal);
  if (drawn.length < 2 || !(total > 0)) {
    return { d, along: reparametrise(d, nominal) };
  }

  const lead = (at: "start" | "end") => {
    const [near, far] =
      at === "start"
        ? [
            { drawn: drawn[0], user: user[0] },
            { drawn: drawn[1], user: user[1] },
          ]
        : [
            { drawn: drawn[drawn.length - 1], user: user[user.length - 1] },
            { drawn: drawn[drawn.length - 2], user: user[user.length - 2] },
          ];
    const tangent = {
      x: near.drawn.x - far.drawn.x,
      y: near.drawn.y - far.drawn.y,
    };
    const size = Math.hypot(tangent.x, tangent.y);
    if (size < 1e-9) return { reach: MASK_MARGIN, step: { x: 0, y: 0 } };
    const step = { x: tangent.x / size, y: tangent.y / size };
    /* The cap line: the user-space normal, carried through the same stretch the path is. */
    const normal = {
      x: -(near.user.y - far.user.y) * nominal.width,
      y: (near.user.x - far.user.x) * nominal.height,
    };
    const cross = Math.abs(step.x * normal.y - step.y * normal.x);
    const along = Math.abs(step.x * normal.x + step.y * normal.y);
    const wedge = cross < 1e-9 ? MAX_MASK_LEAD : along / cross;
    return {
      reach: Math.min(MAX_MASK_LEAD, MASK_LEAD * (1 + wedge)),
      step,
    };
  };

  const point = (at: "start" | "end") => {
    const { reach, step } = lead(at);
    const from = at === "start" ? user[0] : user[user.length - 1];
    return {
      reach,
      x: from.x + (reach * step.x) / nominal.width,
      y: from.y + (reach * step.y) / nominal.height,
    };
  };
  const head = point("start");
  const tail = point("end");

  /* `M a L b` in place of the original `M b`, and one `L` past the far end: the copy is the same
     curve with a straight lead at each end, so the dash's own arithmetic is unchanged. */
  const body = d.replace(/^M\s+[-\d.]+\s+[-\d.]+\s*/, "");
  const first = user[0];
  const extended = `M ${round(head.x)} ${round(head.y)} L ${round(first.x)} ${round(first.y)} ${body} L ${round(tail.x)} ${round(tail.y)}`;

  return {
    d: extended,
    along: reparametrise(extended, nominal, {
      from: head.reach,
      reach: total,
    }),
  };
}

/* ---- the route, resolved -------------------------------------------------------------------- */

/* A motif is NOT yet turned onto the route it sits on, and the reason is a measurement rather than
   an omission. Turning it means turning its two attachment points with it, which throws the
   drawing's whole chord onto the axis the route travels: with the seeded scales, `rings` at 0.44 and
   `knot` at 0.29 on a four-row grid, their attachment points cross at `r = 0.685` — the window's
   shorter side over the section's height — so from the `upright` band upward the thread would run
   back up itself. The scales and the grid are the owner's to tune on the panel; the turn follows
   them, not the other way round. `motifAngle` is the route's own direction of travel and already
   aims every free end's stub. */

export type MotifPlacement = {
  motif: Motif;
  x: number;
  y: number;
  scale: number;
};

function motifEnd(place: MotifPlacement, tangent: Tangent): ConnectorEnd {
  return {
    fraction: { x: place.x, y: place.y },
    svmin: {
      x: (tangent.x - 0.5) * place.scale,
      y: (tangent.y - 0.5) * place.scale,
    },
    tangent,
  };
}

function plainEnd(point: Point, angle: number): ConnectorEnd {
  return {
    fraction: { x: point.x, y: point.y },
    svmin: { x: 0, y: 0 },
    tangent: { x: 0, y: 0, angle },
  };
}

/* A point where the thread is interrupted: a terminal on the section's edge, a free end at the top
   or bottom of the page, or a motif — which the thread enters on one side and leaves on the other,
   so its two ends differ. Everything between two breaks is one connector, and the route's remaining
   stops are the waypoints it passes through. */
type Break = {
  arrive: ConnectorEnd;
  depart: ConnectorEnd;
  motif: MotifPlacement | null;
  stub: "entry" | "exit" | null;
};

function breaksAndWaypoints(
  id: ThreadId,
  band: Band,
): { breaks: Break[]; between: Point[][] } {
  const route = routeFor(id, band);
  const points = routePoints(route);
  const last = points.length - 1;

  const breaks: Break[] = [];
  const between: Point[][] = [];
  let pending: Point[] = [];

  const push = (made: Break) => {
    if (breaks.length > 0) between.push(pending);
    pending = [];
    breaks.push(made);
  };

  if (hasEntry(id)) {
    const end = plainEnd({ x: points[0].x, y: 0 }, TERMINAL_TANGENT.angle);
    push({ arrive: end, depart: end, motif: null, stub: null });
  }

  route.stops.forEach((stop, at) => {
    const free =
      (at === 0 && !hasEntry(id)) || (at === last && !hasExit(id))
        ? at === 0 && !hasEntry(id)
          ? "entry"
          : "exit"
        : null;

    if (stop.motif === undefined) {
      if (free === null) {
        pending.push(points[at]);
        return;
      }
      const end = plainEnd(points[at], motifAngle(route, at));
      push({ arrive: end, depart: end, motif: null, stub: free });
      return;
    }

    const motif = MOTIFS[stop.motif];
    const place: MotifPlacement = {
      motif,
      x: points[at].x,
      y: points[at].y,
      scale: stop.scale ?? 0.3,
    };
    push({
      arrive: motifEnd(place, motif.entry),
      depart: motifEnd(place, motif.exit),
      motif: place,
      stub: free,
    });
  });

  if (hasExit(id)) {
    const end = plainEnd({ x: points[last].x, y: 1 }, TERMINAL_TANGENT.angle);
    push({ arrive: end, depart: end, motif: null, stub: null });
  }

  return { breaks, between };
}

/* ---- segments ----------------------------------------------------------------------------- */

export type ThreadSegment =
  | {
      kind: "connector";
      index: number;
      /* The two ends and the stops between them this connector was composed from — an alternate
         geometry for a window where the ends fall the other way round is re-composed from them. */
      from: ConnectorEnd;
      to: ConnectorEnd;
      waypoints: readonly Point[];
      /* Normalised into this connector's own box: its two ends are the box's opposite corners, so
         nothing here carries the section's aspect. The box does, in CSS. */
      d: string;
      /* The same curve, run past both ends, for the mask copy to be dashed along. */
      revealD: string;
      length: number;
      /* Rendered arc fraction -> user-space arc fraction, so the dash advances evenly on screen. */
      along: Reparametrise;
      /* The mask's stroke width in this box's own units, sized to cover the visible stroke on
         whichever axis the box compresses hardest. */
      maskWidth: number;
      /* How far past its box, in box units, this band's curve and its mask reach. The mask's own
         region is a markup attribute and cannot vary per band, so the component takes the widest. */
      region: { min: number; max: number };
      box: { left: string; top: string; width: string; height: string };
    }
  | {
      kind: "motif";
      index: number;
      place: MotifPlacement;
      length: number;
    };

function connectorSegment(
  index: number,
  from: ConnectorEnd,
  to: ConnectorEnd,
  waypoints: readonly Point[],
  box: SectionBox,
): ThreadSegment {
  /* Both ends run `JOIN_OVERLAP` past themselves along the tangent they are met on, so the ink
     covers the round cap the neighbour's butt-capped mask cuts away. */
  const start = resolveEnd(from, box, JOIN_OVERLAP, -1);
  const finish = resolveEnd(to, box, JOIN_OVERLAP, 1);
  const through = [start, ...waypoints, finish];

  /* The box is pinned to the connector's two ENDS and to nothing else, so its two corners ARE the
     two points the curve has to meet and a join costs nothing at any window. A waypoint between
     them is normalised into that same frame and may fall outside the box, which `.field`'s
     `overflow: visible` renders. */
  const horizontal = boxCss([
    endLength(from, "x", -1, JOIN_OVERLAP),
    endLength(to, "x", 1, JOIN_OVERLAP),
  ]);
  const vertical = boxCss([
    endLength(from, "y", -1, JOIN_OVERLAP),
    endLength(to, "y", 1, JOIN_OVERLAP),
  ]);

  /* The same span, in the band's nominal pixels, with the same 1px floor the CSS above takes — so
     the two cannot disagree about a collapsed axis. On a collapsed axis one box unit is one nominal
     pixel, which keeps both ends exactly on the box's own edge and lets a waypoint's excursion
     still be drawn rather than flattened to the middle. */
  const span = (axis: "x" | "y") => {
    const side = axis === "x" ? box.width : box.height;
    const at = [start[axis] * side, finish[axis] * side];
    const min = Math.min(...at);
    return { min, size: Math.max(1, Math.max(...at) - min), side };
  };
  const spanX = span("x");
  const spanY = span("y");
  const unit = (point: Point): Point => ({
    x: (point.x * spanX.side - spanX.min) / spanX.size,
    y: (point.y * spanY.side - spanY.min) / spanY.size,
  });

  const d = splinePath(through.map(unit));
  const maskWidth = CONNECTOR_MASK_COVER / Math.min(spanX.size, spanY.size);
  const nominal = { width: spanX.size, height: spanY.size };
  const reveal = maskCopy(d, nominal);

  /* A cubic stays inside the hull of its four points, so the emitted numbers bound the curve — and
     the mask's stroke reaches half its own width further than that. The mask copy runs past both
     ends, so it is the copy's hull the region has to hold. */
  const hull = [...reveal.d.matchAll(/-?[\d.]+/g)].map((match) =>
    Number(match[0]),
  );
  const region = {
    min: Math.min(0, ...hull) - MASK_MARGIN - maskWidth / 2,
    max: Math.max(1, ...hull) + MASK_MARGIN + maskWidth / 2,
  };

  return {
    kind: "connector",
    index,
    from,
    to,
    waypoints,
    d,
    revealD: reveal.d,
    length: pathLength(d, nominal),
    along: reveal.along,
    maskWidth,
    region,
    box: {
      left: horizontal.start,
      top: vertical.start,
      width: horizontal.size,
      height: vertical.size,
    },
  };
}

/* A connector's box holds its two ends whichever way round they fall, but the curve inside it is
   normalised to named corners — so the generator has to know which end is the near one, and that
   can change with the window.

   An end sits at `fraction x sectionSide + svmin x window`, so the order of two ends turns on
   `r = svmin / sectionSide`: their separation is `a + b*r`, and where that crosses zero the two
   swap. Measured, not supposed: under the retired placements Wishes' first connector crossed at
   r = 0.476, and at 1920x900 — an ordinary maximised window — its end landed 5px from the motif and
   at 2560x900, 67px.

   Across the WIDTH axis `r` is `min(1, height/width)` of the window itself, which a media query can
   state as an aspect ratio, so a crossing inside the band's own range is emitted as a second
   geometry and the browser picks. Down the HEIGHT axis `r` is the window's shorter side over the
   SECTION's height, which no media query can see — and an end order that turned over down the page
   would mean a thread running back up it. `no connector's box changes which point pins it` is what
   holds that, since the generator cannot. */
function flipAspect(from: ConnectorEnd, to: ConnectorEnd): number | null {
  const constant = from.fraction.x - to.fraction.x;
  const perSvmin = from.svmin.x - to.svmin.x;
  if (Math.abs(perSvmin) < 1e-9) return null;
  const crossing = -constant / perSvmin;
  return crossing > 0 && crossing < 1 ? 1 / crossing : null;
}

/* The box a band's own aspect would have if the window sat at `aspect` — the band's height is kept,
   so only the quantity under test moves. */
function aspectBox(band: Band, aspect: number): SectionBox {
  return { width: band.box.height * aspect, height: band.box.height };
}

/* The thread's segments in drawing order, connectors and motifs alternating. One walk of the route,
   read by the generator and by the component alike — neither re-derives the order. */
export function threadSegments(id: ThreadId, band: Band): ThreadSegment[] {
  const { breaks, between } = breaksAndWaypoints(id, band);
  const segments: ThreadSegment[] = [];

  breaks.forEach((made, at) => {
    if (at > 0) {
      segments.push(
        connectorSegment(
          segments.length,
          breaks[at - 1].depart,
          made.arrive,
          between[at - 1],
          band.box,
        ),
      );
    }
    if (made.motif === null) return;
    const side = made.motif.scale * Math.min(band.box.width, band.box.height);
    /* A connector's `d` is in its own box and a motif's is in its own 0-100 square, so the two need
       different boxes to come out in the same pixels — and they have to, because the scrub divides
       one arc budget between them. */
    const step = side / MOTIF_SIDE;
    segments.push({
      kind: "motif",
      index: segments.length,
      place: made.motif,
      length: pathLength(made.motif.motif.d, { width: step, height: step }),
    });
  });

  return segments;
}

/* A `<mask>`'s own region is markup, not CSS, so one value has to hold every band. This is the
   widest any of them reaches, per segment. */
export function threadMaskRegions(
  id: ThreadId,
): Map<number, { min: number; max: number }> {
  const widest = new Map<number, { min: number; max: number }>();
  for (const band of THREAD_BANDS) {
    for (const segment of threadSegments(id, band)) {
      if (segment.kind !== "connector") continue;
      const held = widest.get(segment.index);
      widest.set(segment.index, {
        min: Math.min(held?.min ?? segment.region.min, segment.region.min),
        max: Math.max(held?.max ?? segment.region.max, segment.region.max),
      });
    }
  }
  return widest;
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
function dashArray(bands: readonly Band01[], along: Reparametrise): string {
  if (bands.length === 0) return "0 1";
  const values: number[] = [0];
  let cursor = 0;
  for (const [start, end] of bands) {
    const from = along(start);
    const to = Math.max(from, along(end));
    values.push(from - cursor, to - from);
    cursor = to;
  }
  values.push(1);
  return values.map((value) => round(Math.max(0, value))).join(" ");
}

const FULL: Band01 = [0, 1];
const IDENTITY: Reparametrise = (fraction) => fraction;

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
  /* `view` reads the section's own named scroll timeline; `time` runs on the clock. Only the
     re-trace is timed, and DESIGN.md -> Foundations -> Motion sanctions exactly that one loop. */
  clock: "view" | "time";
  /* `[tail, head]` and the wisp bands are both a list of arcs; a layer is the list it paints. */
  bands: (progress: number, span: Span) => Band01[];
  /* Arc positions, beyond the segment's own two ends, at which this layer's bands cross a boundary
     — the keyframe stops where linear interpolation would otherwise cut a corner. */
  arcs: (span: Span) => number[];
  /* The brightest layer alone animates its cap: round while it has length, butt while it has none.
     See `HEAD_LAYERS`. */
  cap: boolean;
  /* The weave restricts a layer to part of the motif; every other layer sees the whole of it. */
  within: readonly Band01[];
  /* A class on the thread's ROOT that this layer's rules are additionally qualified by — the weave
     variant is chosen per mount, not per segment. */
  root: string;
  /* The element the mask lives on, relative to the segment. */
  target: string;
};

const NO_ARCS = () => [];

/* The head's own bands, at layer `index` of the stack: a window of the thread `HEAD_STEP` long,
   `index` steps behind the leading edge.

   The leading edge is UNCAPPED — `progress / THREAD_HOLD` rather than `headAt`, which stops at 1 —
   so once the thread is fully drawn the head slides off its end and shrinks to nothing there,
   instead of parking on the last point for the whole hold band. */
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

/* The same head, on the clock instead of on the scroll. `cycle` is the fraction of one pass plus
   one gap: the leading edge crosses the whole thread over the pass and then rests at the far end,
   where every band is collapsed and paints nothing. */
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

/* The loop renders twice, as complementary segments of one curve: an under-copy beneath the
   illustration and an over-copy above it, both on the same scrub, so the stroke passes from one to
   the other mid-draw. Both are the SAME `d` — the split is in the mask, not in the geometry. */
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
  /* The light is split by the weave exactly as the ink is: a head painted on BOTH copies would
     show in front of the illustration while the thread it leads runs behind it. The wisp is the
     one layer left whole — it paints outside the inked arc, so the split does not reach it. */
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

function isWeave(id: ThreadId, segment: ThreadSegment): boolean {
  return (
    id === "wishes" &&
    segment.kind === "motif" &&
    segment.place.motif.id === "wishesLoop"
  );
}

/* The stops one CLOCK-timed pass needs: every point at which the head's bands cross one of the
   segment's own ends, in fractions of the whole cycle, plus the moment the pass ends and the gap
   begins. Between two of them the leading edge is linear in time, so linear interpolation is exact
   — the same claim `stops` makes for the scrub. */
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

function emitSegment(
  id: ThreadId,
  band: Band,
  segment: ThreadSegment,
  span: Span,
  layers: readonly Layer[],
  extraStops: readonly number[],
  animated: Set<string>,
): { animations: string[]; keyframes: string[] } {
  const scope = `.${threadScopeClass(id)}`;
  const along = segment.kind === "connector" ? segment.along : IDENTITY;
  const animations: string[] = [];
  const emitted: string[] = [];

  for (const layer of layers) {
    const name = `thread-${id}-${segment.index}-${layer.suffix}-${band.id}`;
    const selector = `${scope}${layer.root} .${segmentClass(segment.index)} ${layer.target}`;
    const at =
      layer.clock === "time"
        ? cycleStops(span)
        : stops(span, [...extraStops, ...layer.arcs(span)]);
    const frames = at.map((stop) => {
      const dash = dashArray(
        intersect(layer.bands(stop, span), layer.within),
        along,
      );
      const decls = [`stroke-dasharray: ${dash};`];
      /* A round cap reaches half the mask's stroke past the dash, which is what covers the laid
         ink's own cap ahead of the light — and what paints a dot on a band with no length. Read
         off the EMITTED dash, not off the band it came from: a band with length in the segment's
         own space can still round to nothing once `along` has mapped it onto a stretched box, and
         it is the emitted number that paints. */
      if (layer.cap) {
        const draws = dash
          .split(" ")
          .filter((_, at) => at % 2 === 0)
          .some((length) => Number(length) > 0);
        decls.push(`stroke-linecap: ${draws ? "round" : "butt"};`);
      }
      return { at: stop, decl: decls.join(" ") };
    });
    animations.push(
      rule(
        selector,
        layer.clock === "time"
          ? [
              `animation-name: ${name};`,
              `animation-duration: ${round(RETRACE_CYCLE)}s;`,
              "animation-iteration-count: infinite;",
              "animation-fill-mode: both;",
              "animation-timing-function: linear;",
            ]
          : [
              `animation-name: ${name};`,
              `animation-timeline: ${timelineName(id)};`,
              "animation-fill-mode: both;",
              "animation-timing-function: linear;",
            ],
      ),
    );
    animated.add(selector);
    emitted.push(keyframes(name, frames));
  }
  return { animations, keyframes: emitted };
}

/* A connector's curve, and the mask width its box's own units need. The visible stroke, the wisp
   and both reveal copies are the same curve, so all four take the same `d` on one rule — a band
   cannot move one without the others. */
function curveRules(selector: string, segment: ThreadSegment): string {
  if (segment.kind !== "connector") return "";
  return [
    rule(
      [
        `${selector} .${THREAD_CLASS.connector}`,
        `${selector} .${THREAD_CLASS.wisp}`,
        `${selector} .${THREAD_CLASS.light}`,
      ].join(", "),
      [`d: path("${segment.d}");`],
    ),
    rule(
      [
        `${selector} .${THREAD_CLASS.inkReveal}`,
        `${selector} .${THREAD_CLASS.wispReveal}`,
        `${selector} .${THREAD_CLASS.headReveal}`,
        `${selector} .${THREAD_CLASS.retraceReveal}`,
      ].join(", "),
      [`d: path("${segment.revealD}");`],
    ),
    rule(selector, [`--thread-mask-width: ${round(segment.maskWidth)};`]),
  ].join("\n");
}

/* Everything a band fixes: where each motif's square sits, how big it is and how far it is turned,
   the box each connector and each stub is pinned into, the connectors' own path data, and one set of
   keyframes per segment per layer. All of it is per band, because a motif is a square off
   `min(width, height)` while its cell is a fraction of the section, so the section's aspect enters
   the geometry and cannot be removed at build time. */
function bandRules(id: ThreadId, band: Band, animated: Set<string>): string {
  const scope = `.${threadScopeClass(id)}`;
  const segments = threadSegments(id, band);
  const total = segments.reduce((sum, segment) => sum + segment.length, 0);
  const geometry: string[] = [];
  const animations: string[] = [];
  const frames: string[] = [];

  const boxRule = (
    selector: string,
    box: { left: string; top: string; width: string; height: string },
  ) =>
    rule(selector, [
      `left: ${box.left};`,
      `top: ${box.top};`,
      `width: ${box.width};`,
      `height: ${box.height};`,
    ]);

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
        boxRule(selector, segment.box),
        curveRules(selector, segment),
      );

      /* The one window-dependent thing left in the normalised curve: which of the connector's two
         ends is the near corner of its box. Where that can turn over INSIDE this band, both
         geometries are emitted and the aspect ratio the crossing sits at chooses between them. */
      const flip = flipAspect(segment.from, segment.to);
      if (flip !== null && flip > band.min && flip < band.max) {
        const composed = Math.max(1, band.box.width / band.box.height);
        const below = composed < flip;
        const alternate = below
          ? Math.min(
              flip * 1.5,
              band.max === Number.POSITIVE_INFINITY
                ? flip * 1.5
                : (flip + band.max) / 2,
            )
          : (flip + band.min) / 2;
        geometry.push(
          `@media (aspect-ratio ${below ? ">=" : "<"} ${round(flip)}) {\n${curveRules(
            selector,
            connectorSegment(
              segment.index,
              segment.from,
              segment.to,
              segment.waypoints,
              aspectBox(band, alternate),
            ),
          )}\n}`,
        );
      }
    } else {
      geometry.push(
        rule(selector, [
          `--thread-motif-x: ${round(segment.place.x)};`,
          `--thread-motif-y: ${round(segment.place.y)};`,
          `--thread-motif-side: calc(${round(segment.place.scale)} * 100svmin);`,
        ]),
      );
    }

    /* A zero-length segment cannot be scrubbed and does not need to be: it draws nothing. */
    if (segment.length === 0) continue;

    const weave = isWeave(id, segment);
    const emitted = emitSegment(
      id,
      band,
      segment,
      span,
      layersFor(weave),
      weave ? WEAVE_BAND : [],
      animated,
    );
    animations.push(...emitted.animations);
    frames.push(...emitted.keyframes);
  }

  for (const stub of threadStubs(id, band)) {
    const selector = `${scope} .${THREAD_CLASS.stub}--${stub.which}`;
    geometry.push(
      boxRule(selector, stub.box),
      rule(`${selector} path`, [`d: path("${stub.d}");`]),
    );
  }

  const scrub =
    animations.length === 0
      ? ""
      : `\n@supports (animation-timeline: view()) {\n${[...animations, ...frames].join("\n")}\n}`;
  return `${geometry.filter((piece) => piece.length > 0).join("\n")}${scrub}`;
}

/* ---- the free ends --------------------------------------------------------------------------- */

/* The wisp is the thread's cut end, not an ornament, so a head or a tail mid-scrub carries one
   exactly as a terminal does — those are handled by the wisp layer above, which paints just outside
   the inked arc and so collapses to nothing at rest. The two ends that keep a wisp AT REST are the
   ones with no connector to carry them: the page's own top and bottom, and both of `not-found`'s. A
   short stub past the free end, along that end's own direction of travel, is their whole geometry. */
export type ThreadStub = {
  which: "entry" | "exit";
  d: string;
  box: { left: string; top: string; width: string; height: string };
};

export function threadStubs(id: ThreadId, band: Band): ThreadStub[] {
  const { breaks } = breaksAndWaypoints(id, band);
  const stubs: ThreadStub[] = [];

  for (const made of breaks) {
    if (made.stub === null) continue;
    const which = made.stub;
    const direction: 1 | -1 = which === "entry" ? -1 : 1;
    const end = which === "entry" ? made.arrive : made.depart;
    const radians = (end.tangent.angle * Math.PI) / 180;
    /* A stub is the same shape at every band — its reach is a multiple of `svmin`, like the motif's
       own square, so neither of its ends carries an aspect. It runs `JOIN_OVERLAP` INTO whatever it
       meets, for the same reason a connector does: the neighbour's butt-capped mask cuts its round
       cap off there. */
    const away: ConnectorEnd = {
      fraction: end.fraction,
      svmin: {
        x: end.svmin.x + direction * STUB_REACH * Math.cos(radians),
        y: end.svmin.y + direction * STUB_REACH * Math.sin(radians),
      },
      tangent: end.tangent,
    };
    const into: 1 | -1 = direction === 1 ? -1 : 1;
    const horizontal = boxCss([
      endLength(away, "x", 1, 0),
      endLength(end, "x", into, JOIN_OVERLAP),
    ]);
    const vertical = boxCss([
      endLength(away, "y", 1, 0),
      endLength(end, "y", into, JOIN_OVERLAP),
    ]);
    /* `away` is the box's first corner and the free end the opposite one on each axis the stub
       actually travels along; where it travels on neither, both sit at the middle of a box the 1px
       floor holds open. */
    const corner = (at: "away" | "point", axis: "x" | "y") => {
      const moves = axis === "x" ? Math.cos(radians) : Math.sin(radians);
      if (Math.abs(moves) < 1e-6) return 0.5;
      const greater = moves * direction > 0 ? "away" : "point";
      return at === greater ? 1 : 0;
    };
    stubs.push({
      which,
      d: `M ${corner("away", "x")} ${corner("away", "y")} L ${corner("point", "x")} ${corner("point", "y")}`,
      box: {
        left: horizontal.start,
        top: vertical.start,
        width: horizontal.size,
        height: vertical.size,
      },
    });
  }
  return stubs;
}

/* ---- the sheet ------------------------------------------------------------------------------ */

export function threadCss(id: ThreadId): string {
  const scope = `.${threadScopeClass(id)}`;
  const timeline = timelineName(id);
  /* Every selector the bands put an animation on, collected as they are written rather than
     re-derived: the reduced-motion block below repeats each one verbatim, so it cancels the
     animation at EQUAL specificity and later in the sheet. The rule it replaced was two classes
     against the per-segment rule's three and lost the cascade, so reduced motion left the whole
     scrub running — invisible on a parked section, and no gate could see it. */
  const animated = new Set<string>();

  const woven = threadSegments(id, THREAD_BANDS[0]).filter((segment) =>
    isWeave(id, segment),
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
    /* The complete thread, declared unconditionally: every reveal fully inked. Everything below
       only ever narrows it. */
    rule(`${scope} .${THREAD_CLASS.inkReveal}`, [
      `stroke-dasharray: ${dashArray([FULL], IDENTITY)};`,
    ]),
    rule(`${scope} .${THREAD_CLASS.wispReveal}`, [
      `stroke-dasharray: ${dashArray([], IDENTITY)};`,
    ]),
    /* The light is the one thing the base state does NOT carry: a resting thread has no pen on it.
       Both reveals therefore start asking for nothing, which is where reduced motion, a page
       without scripting and a browser without `animation-timeline` all land. */
    rule(
      `${scope} .${THREAD_CLASS.headReveal}, ${scope} .${THREAD_CLASS.retraceReveal}`,
      [`stroke-dasharray: ${dashArray([], IDENTITY)};`],
    ),
    /* The bleed, and the reason it sits on a layer of its own rather than on each stroke: a CSS
       filter's lengths resolve in the filtered element's own coordinate system, and a connector's
       box is a stretched unit square, so 3.5px on the path would be 3.5 BOX WIDTHS. The layer is a
       plain absolutely positioned box the size of the section, where a pixel is a pixel — and it
       holds the ink alone, so the head and the re-trace paint above the blurred buffer rather than
       inside it. */
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

  /* The weave is a property of the COMPLETE thread, not of the scrub, so the two copies split the
     loop at rest as well as mid-draw — otherwise a resting page paints both copies whole and the
     pass behind the illustration never reads. */
  for (const segment of woven) {
    const [under0, under1] = WEAVE_BAND;
    base.push(
      rule(
        `${scope}.${THREAD_CLASS.weaveUnder} .${segmentClass(segment.index)} .${THREAD_CLASS.inkReveal}`,
        [`stroke-dasharray: ${dashArray([[under0, under1]], IDENTITY)};`],
      ),
      rule(
        `${scope}.${THREAD_CLASS.weaveOver} .${segmentClass(segment.index)} .${THREAD_CLASS.inkReveal}`,
        [
          `stroke-dasharray: ${dashArray(
            [
              [0, under0],
              [under1, 1],
            ],
            IDENTITY,
          )};`,
        ],
      ),
    );
  }

  const bands = THREAD_BANDS.map(
    (band) =>
      `@media ${aspectQuery(band)} {\n${bandRules(id, band, animated)}\n}`,
  );

  /* The re-trace runs on the clock, because a RESTING re-trace has to move while the reader does
     not — so nothing about the scroll can start or stop it. What gates it to the hold band is this
     one scroll-driven animation on the group the passes live in: coverage, not the dash, so the
     per-layer alphas underneath it are untouched. Its keyframes step rather than ramp; the gate
     carries state, and a property carrying state is correct on its first frame.

     One block, outside the bands: the gate is the same at every aspect, and a per-band copy would
     define one `@keyframes` name three times, where the later definition silently wins. */
  const gateName = `thread-${id}-retrace-gate`;
  const edge = 0.001;
  const gate =
    animated.size === 0
      ? ""
      : `\n@supports (animation-timeline: view()) {\n${[
          rule(`${scope} .${THREAD_CLASS.retrace}`, [
            `animation-name: ${gateName};`,
            `animation-timeline: ${timeline};`,
            "animation-fill-mode: both;",
            "animation-timing-function: linear;",
          ]),
          keyframes(
            gateName,
            [
              [0, 0],
              [THREAD_HOLD - edge, 0],
              [THREAD_HOLD, 1],
              [1 - THREAD_HOLD, 1],
              [1 - THREAD_HOLD + edge, 0],
              [1, 0],
            ].map(([at, opacity]) => ({ at, decl: `opacity: ${opacity};` })),
          ),
        ].join("\n")}\n}`;
  if (animated.size > 0) animated.add(`${scope} .${THREAD_CLASS.retrace}`);

  /* Reduced motion removes the animation and nothing else, which lands on the complete base above —
     one code path, not a second rendering of the same thread. Every animated selector is repeated
     verbatim, so each cancellation matches its own rule's specificity exactly and wins on order;
     a selector of this block's own choosing would be a specificity bet, and the last one lost it. */
  const cancelled =
    animated.size > 0
      ? [...animated]
      : /* A section whose every segment measures zero is never animated; the block still states
           the rule, so the contract reads the same whether or not there is a thread to draw. */
        [`${scope} .${THREAD_CLASS.inkReveal}`];
  const reduced = `@media (prefers-reduced-motion: reduce) {\n${cancelled
    .map((selector) => rule(selector, ["animation: none;"]))
    .join("\n")}\n}`;

  return [...base, ...bands, gate, reduced].join("\n");
}
