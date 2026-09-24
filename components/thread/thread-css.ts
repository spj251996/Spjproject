/* Extension-qualified, unlike the rest of components/: plain node resolves a relative import only
   with its extension, and this module stays importable outside the app's bundler. */
import {
  type Connector,
  type ConnectorEnd,
  composeConnectors,
  connectorCurve,
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

   Both masks therefore stop exactly where their path stops, and the visible stroke's ROUND CAP
   reaches half a stroke width further. Every connector runs `JOIN_OVERLAP` past each of its own
   ends to cover that, rather than either mask reaching past its path — see the constant.

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

/* ---- pinning a connector's box ------------------------------------------------------------- */

/* A position the browser resolves rather than the generator: a percentage of the section box, a
   multiple of `svmin` — the unit `--thread-motif-side` is written in — and a pixel allowance. The
   three never collapse into one number at build time, because their ratio is the section's aspect
   and no tier box knows it. */
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

function difference(a: CssLength, b: CssLength): CssLength {
  return { pct: a.pct - b.pct, svmin: a.svmin - b.svmin, px: a.px - b.px };
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

/* The box an element is given so its two opposite corners land ON the two points, whichever way
   round they fall: `min` takes the near corner and `max` of the difference with its own negation
   takes the distance without needing `abs()`. The 1px floor keeps a box that collapses on one axis
   — a connector that travels only vertically — from becoming a zero-size SVG viewport, which
   renders nothing at all; it costs at most 1px, and only where the two points are already within
   1px of each other. */
function boxCss(
  from: CssLength,
  to: CssLength,
): { start: string; size: string } {
  return {
    start: `min(${lengthCss(from)}, ${lengthCss(to)})`,
    size: `max(1px, ${lengthCss(difference(to, from))}, ${lengthCss(difference(from, to))})`,
  };
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
      /* The two ends this connector was composed from — an alternate geometry for a window where
         they fall the other way round is re-composed from them. */
      connector: Connector;
      /* Normalised into this connector's own box: its two ends are the box's opposite corners, so
         nothing here carries the section's aspect. The box does, in CSS. */
      d: string;
      /* The same curve in section fractions, against the nominal box — what the length and the
         wipe axis are measured from. */
      absolute: string;
      length: number;
      axis: "x" | "y";
      monotone: boolean;
      frame: string;
      /* How far past its box, in box units, this tier's curve reaches. The mask's own region is a
         markup attribute and cannot vary per tier, so the component takes the widest. */
      region: { min: number; max: number };
      box: { left: string; top: string; width: string; height: string };
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
  connector: Connector,
  box: SectionBox,
): ThreadSegment {
  const curve = connectorCurve(connector, box, JOIN_OVERLAP);
  const d = curve.d;
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

  /* The connector's own box spans its two ends, so the curve normalises into a unit square whose
     corners ARE those ends — and the box itself is pinned in CSS, where `%` and `svmin` resolve
     against the real section and the real window. A degenerate axis (a connector that travels only
     one way) keeps its points at the middle of a box the floor holds open. */
  const spanX = {
    min: Math.min(curve.from.x, curve.to.x),
    max: Math.max(curve.from.x, curve.to.x),
  };
  const spanY = {
    min: Math.min(curve.from.y, curve.to.y),
    max: Math.max(curve.from.y, curve.to.y),
  };
  const unit = (value: number, span: { min: number; max: number }) =>
    span.max - span.min < 1e-9
      ? 0.5
      : (value - span.min) / (span.max - span.min);
  const local = (point: { x: number; y: number }) =>
    `${round(unit(point.x, spanX))} ${round(unit(point.y, spanY))}`;

  /* A cubic stays inside the hull of its four points, so those four bound the curve — in the box's
     own units, where a control point can sit many box-widths out: the box is only as wide as the
     two ends are apart, and a connector that travels 262px down and 6px across reaches 34px to the
     side on the way. That reach is what the wipe has to cover on the CROSS axis, and what the
     mask's own region has to hold; a fixed "one box-width past each edge" cut the curve off. */
  const hull = [curve.from, curve.c1, curve.c2, curve.to].map((point) => ({
    x: unit(point.x, spanX),
    y: unit(point.y, spanY),
  }));
  const reach = (of: "x" | "y") => ({
    min: Math.min(0, ...hull.map((point) => point[of])) - MASK_MARGIN,
    max: Math.max(1, ...hull.map((point) => point[of])) + MASK_MARGIN,
  });
  const cross = reach(axis === "y" ? "x" : "y");
  const region = {
    min: Math.min(reach("x").min, reach("y").min),
    max: Math.max(reach("x").max, reach("y").max),
  };

  /* The wipe rect is a unit square and the box is the connector's own span, so the frame maps it
     across the cross axis and runs the band from the end the curve starts at — the far corner
     wherever the curve descends against the axis.

     ALONG the axis the band reaches `JOIN_OVERLAP` past both ends, because a connector arrives at a
     motif along its tangent and therefore runs PARALLEL to the box's own edge as it gets there: a
     mask that stopped at the edge cut the last stroke in half lengthwise, measured as a 7px break
     at 1920x900 where a band that stopped at the endpoint would have cost nothing. Mid-scrub it
     makes the head lead and the tail lag by those same two pixels. An empty band is still empty:
     the keyframes scale it to nothing and a factor on nothing is nothing. */
  const forward =
    axis === "y" ? curve.to.y >= curve.from.y : curve.to.x >= curve.from.x;
  const travelled =
    axis === "y"
      ? (spanY.max - spanY.min) * box.height
      : (spanX.max - spanX.min) * box.width;
  const ease = Math.min(0.5, travelled < 1e-9 ? 0.5 : JOIN_OVERLAP / travelled);
  const along = round(1 + 2 * ease);
  const lead = round(forward ? -ease : 1 + ease);
  const span = round(cross.max - cross.min);
  const at = round(cross.min);
  const frame =
    axis === "y"
      ? `translate(${at}px, ${lead}px) scale(${span}, ${forward ? along : round(-(1 + 2 * ease))})`
      : `translate(${lead}px, ${at}px) scale(${forward ? along : round(-(1 + 2 * ease))}, ${span})`;

  const from = (axis: "x" | "y") =>
    endLength(connector.from, axis, -1, JOIN_OVERLAP);
  const to = (axis: "x" | "y") =>
    endLength(connector.to, axis, 1, JOIN_OVERLAP);
  const horizontal = boxCss(from("x"), to("x"));
  const vertical = boxCss(from("y"), to("y"));

  return {
    kind: "connector",
    index,
    connector,
    d: `M ${local(curve.from)} C ${local(curve.c1)}, ${local(curve.c2)}, ${local(curve.to)}`,
    absolute: d,
    length: pathLength(d, box),
    axis,
    monotone,
    frame,
    region,
    box: {
      left: horizontal.start,
      top: vertical.start,
      width: horizontal.size,
      height: vertical.size,
    },
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
  const connectors = composeConnectors(section, MOTIFS, placements);
  const segments: ThreadSegment[] = [];
  let next = 0;
  const take = () => {
    const connector = connectors[next];
    next += 1;
    return connectorSegment(segments.length, connector, tier.box);
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
    /* A connector's `d` is in section fractions and a motif's is in its own 0-100 square, so the
       two need different boxes to come out in the same pixels — and they have to, because the
       scrub divides one arc budget between them. */
    const unit = side / MOTIF_SIDE;
    segments.push({
      kind: "motif",
      index: segments.length,
      motif,
      placement,
      length: pathLength(motif.d, { width: unit, height: unit }),
    });
  });
  if (section.exitX !== null) segments.push(take());
  return segments;
}

/* A connector's box holds its two ends whichever way round they fall, but the curve inside it is
   drawn to named corners — so the generator has to know which end is the near one, and that can
   change with the window.

   An end sits at `fraction x sectionSide + svmin x window`, so the order of two ends turns on
   `r = svmin / sectionSide`: their separation is `a + b*r`, and where that crosses zero the two
   swap. Measured, not supposed: Wishes' first connector crosses at r = 0.476, and at 1920x900 —
   an ordinary maximised window — its end landed 5px from the motif and at 2560x900, 67px.

   Across the WIDTH axis `r` is `min(1, height/width)` of the window itself, which a media query can
   state as an aspect ratio, so the crossing is emitted as two geometries and the browser picks.
   Down the HEIGHT axis `r` is the window's shorter side over the SECTION's height, which no media
   query can see — and an end order that turns over down the page would mean a thread running back
   up it. `no connector's ends can swap order down the page` is what holds that, since the
   generator cannot. */
function flipAspect(connector: Connector): number | null {
  const separation = (of: "fraction" | "svmin") =>
    connector.from[of].x - connector.to[of].x;
  const constant = separation("fraction");
  const perSvmin = separation("svmin");
  if (Math.abs(perSvmin) < 1e-9) return null;
  const crossing = -constant / perSvmin;
  return crossing > 0 && crossing < 1 ? 1 / crossing : null;
}

/* The box a tier's own aspect would have if the window sat at `r` across its width — the tier's
   height is kept, so only the quantity under test moves. */
function aspectBox(tier: ThreadTier, ratio: number): SectionBox {
  return { width: tier.box.height / ratio, height: tier.box.height };
}

/* A `<mask>`'s own region is markup, not CSS, so one value has to hold every tier and — where a
   section has one — both arrangements. This is the widest any of them reaches, per segment. */
export function threadMaskRegions(
  section: SectionThread,
): Map<number, { min: number; max: number }> {
  const widest = new Map<number, { min: number; max: number }>();
  const arrangements =
    section.stacked === undefined
      ? [section.placements]
      : [section.placements, section.stacked];
  for (const placements of arrangements) {
    for (const tier of THREAD_TIERS) {
      for (const segment of threadSegments(section, tier, placements)) {
        if (segment.kind !== "connector") continue;
        const held = widest.get(segment.index);
        widest.set(segment.index, {
          min: Math.min(held?.min ?? segment.region.min, segment.region.min),
          max: Math.max(held?.max ?? segment.region.max, segment.region.max),
        });
      }
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
/* A connector's curve and the frame its wipe sweeps: the two things that move together, since the
   frame runs the band from the end the curve starts at. The wisp is the same curve as the ink it
   trails, so it takes the same `d` on the same rule — a tier cannot move one without the other. */
function curveRules(selector: string, segment: ThreadSegment): string {
  if (segment.kind !== "connector") return "";
  return [
    rule(
      `${selector} .${THREAD_CLASS.connector}, ${selector} .${THREAD_CLASS.wisp}`,
      [`d: path("${segment.d}");`],
    ),
    rule(`${selector} .${THREAD_CLASS.wipeFrame}`, [
      `transform: ${segment.frame};`,
    ]),
  ].join("\n");
}

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
      geometry.push(curveRules(selector, segment));

      /* The one window-dependent thing left in the composed curve: which of the connector's two
         ends is the near corner of its box. Where that can turn over, both geometries are emitted
         and the aspect ratio the crossing sits at chooses between them. */
      const flip = flipAspect(segment.connector);
      if (flip !== null) {
        const composedAspect = Math.max(1, tier.box.width / tier.box.height);
        const below = composedAspect < flip;
        const alternate = below ? flip * 1.5 : (flip + 1) / 2;
        geometry.push(
          `@media (aspect-ratio ${below ? ">=" : "<"} ${round(flip)}) {\n${curveRules(
            selector,
            connectorSegment(
              segment.index,
              segment.connector,
              aspectBox(tier, 1 / alternate),
            ),
          )}\n}`,
        );
      }
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
export type ThreadStub = {
  which: "entry" | "exit";
  d: string;
  box: { left: string; top: string; width: string; height: string };
};

/* The two ends that keep a wisp AT REST are the ones with no connector to carry them: the invite's
   top, Wishes' closing terminal, and both of `not-found`'s. A short stub past the free end, along
   that end's own tangent, is their whole geometry. Every other free end is a head or a tail
   mid-scrub, and the wisp layer paints those just outside the inked arc. */
export function threadStubs(
  section: SectionThread,
  placements: readonly Placement[] = section.placements,
): ThreadStub[] {
  const stubs: ThreadStub[] = [];
  const draw = (
    placement: Placement,
    tangent: { x: number; y: number; angle: number },
    direction: 1 | -1,
    which: "entry" | "exit",
  ) => {
    const radians = (tangent.angle * Math.PI) / 180;
    /* A stub is the same shape at every tier — its length is a multiple of the motif's own side,
       so both of its ends are an `svmin` term like the motif's, and neither carries an aspect. It
       runs `JOIN_OVERLAP` INTO the motif at the end it meets, for the same reason a connector
       does: the motif's mask cuts its round cap off there. */
    const reach = (at: number) => ({
      fraction: { x: placement.x, y: placement.y },
      svmin: {
        x: (tangent.x - 0.5 + at * Math.cos(radians)) * placement.scale,
        y: (tangent.y - 0.5 + at * Math.sin(radians)) * placement.scale,
      },
      tangent,
    });
    const point = reach(0);
    const away = reach(direction * WISP_EXTENT * 6);
    const into: 1 | -1 = direction === 1 ? -1 : 1;
    const horizontal = boxCss(
      endLength(away, "x", 1, 0),
      endLength(point, "x", into, JOIN_OVERLAP),
    );
    const vertical = boxCss(
      endLength(away, "y", 1, 0),
      endLength(point, "y", into, JOIN_OVERLAP),
    );
    /* `away` is the box's first corner and `point` the opposite one on each axis the stub
       actually travels along; a tangent is horizontal or vertical, so exactly one axis moves and
       the other sits at the middle of a box the 1px floor holds open. */
    const corner = (end: "away" | "point", axis: "x" | "y") => {
      const moves = axis === "x" ? Math.cos(radians) : Math.sin(radians);
      if (Math.abs(moves) < 1e-9) return 0.5;
      const greater = moves * direction > 0 ? "away" : "point";
      return end === greater ? 1 : 0;
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

/* Everything a placement set fixes that no tier can move: where each motif's square sits and how
   big it is, and the box each connector and each stub is pinned into. None of it carries a section
   aspect — `%` is the section's own box and `svmin` the window's shorter side, both resolved by the
   browser — so one emission serves every tier, and the stacked arrangement overrides the set rather
   than a tier's copy of it. */
function placementRules(
  section: SectionThread,
  placements: readonly Placement[],
): string {
  const scope = `.${threadScopeClass(section.id)}`;
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

  /* Any tier serves: a connector's box and a motif's placement read the placement set alone. */
  const rules = threadSegments(section, THREAD_TIERS[0], placements).map(
    (segment) => {
      const selector = `${scope} .${segmentClass(segment.index)}`;
      return segment.kind === "connector"
        ? boxRule(selector, segment.box)
        : rule(selector, [
            `--thread-motif-x: ${round(segment.placement.x)};`,
            `--thread-motif-y: ${round(segment.placement.y)};`,
            `--thread-motif-side: calc(${round(segment.placement.scale)} * 100svmin);`,
          ]);
    },
  );

  for (const stub of threadStubs(section, placements)) {
    const selector = `${scope} .${THREAD_CLASS.stub}--${stub.which}`;
    rules.push(
      boxRule(selector, stub.box),
      rule(`${selector} path`, [`d: path("${stub.d}");`]),
    );
  }
  return rules.join("\n");
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

  base.push(placementRules(section, section.placements));

  const tiers = THREAD_TIERS.flatMap((tier) => {
    const blocks = [
      `@media ${tier.media} {\n${tierRules(section, tier, section.placements, "")}\n}`,
    ];

    /* The stacked band and this tier's band are intersected rather than `and`-ed, so a tier the
       arrangement cannot reach emits no block at all instead of a query that is never true. */
    const from = Math.max(tier.from, STACKED_REGIME.from);
    const to = Math.min(tier.to, STACKED_REGIME.to);
    if (section.stacked !== undefined && from < to) {
      const stackedBody = [
        placementRules(section, section.stacked),
        tierRules(section, tier, section.stacked, "-stacked"),
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
