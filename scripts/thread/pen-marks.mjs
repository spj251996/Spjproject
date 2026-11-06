/**
 * The owner's pen marks on the retouch sheets, applied to the thread in every photo state.
 *
 * The sheets are crops of the live page, one per section, Celebrations once per photo state. On
 * them the owner drew magenta for a new stretch of thread (started and ended on the red line) and
 * cyan for "smooth here". Marks are stored once per band, on the drawn page (every ritual
 * photographed), in `assets/thread/<band>/pen.json`, and each photo state takes them through the
 * same close-up of Celebrations the generator gives its type.
 */
import { retouchPiece } from "./retouch.mjs";

/** @typedef {{ x: number, y: number }} Point */
/** @typedef {{ group: number, states: string[], spread?: boolean }} Drawn which stretch a mark fixes, the photo states it was drawn on, and whether it also reaches states drawn on no sheet of its own (Celebrations: the owner drew a repeated mistake on one or two states only) */
/** @typedef {Drawn & { points: Point[], corners?: number[] }} Stroke `corners`: where the pen left the line, rounded on each photo state's page (`cornersOf`) */
/** @typedef {Drawn & { x: number, y: number, r: number }} Zone */
/** @typedef {{ box: { x0: number, y0: number, x1: number, y1: number }, dx?: number, dy: number, ease: number }} Move */
/** @typedef {{ strokes?: Stroke[], zones?: Zone[], moves?: Move[], refitRings?: boolean }} Pen `refitRings`: fit the portrait rings to the strokes past them */
/** @typedef {{ top: number, descBottom: number, stripBottom: number }} Row */
/** @typedef {{ top: number, bottom: number }} Glyph */
/** @typedef {{ strip: number, rows: Row[], glyphs: Glyph[], sections: { id: string, bottom: number }[] }} Layout */

/* A stroke's end further than this from the line is not on it (page px). Drawn on its own photo
   state an end lands within ~8px; carried to another state, up to ~20px; beside a portrait ring,
   whose line now meets the ring's trimmed ends, up to ~32px. */
const SNAP = 40;
/* A spliced stroke is eased into the line over this much of it, either side of each end. */
const BLEND = 24;
/* A traced stroke turning this sharply between two runs at least CORNER_RUN long has a corner, rounded
   over CORNER_REACH either side so the line bends no more than ~0.5° a pixel there. */
const CORNER_TURN = 25;
const CORNER_RUN = 20;
const CORNER_REACH = 48;
/* A drift at one end of a stroke eases out over this many times its own length along the stroke. */
const CARRY_REACH = 3;
/* A smoothing zone runs the smoothing this many times: once barely touches a drawn kink. */
const ZONE_PASSES = 3;
/* Points a mark adds that stray less than this from the curve through their neighbours carry no
   shape (page px); every photo state carries them, so they are thinned out. */
const THIN = 0.5;
/* A connected patch of pen smaller than this many pixels is a speck, not a mark. */
const SPECK = 40;

/**
 * Each missing strip's gap on the drawn page: from its ritual's description down to the next type
 * that stays, which closes up by the strip's height. The same gaps `adaptCelebrations` closes.
 * @param {Layout} layout @param {number[]} removed
 */
function gapsOf(layout, removed) {
  const { rows } = layout;
  const bottom = celebrationsBottom(layout);
  const kept = layout.glyphs.filter(
    (g) =>
      !removed.some(
        (k) =>
          g.top >= rows[k].descBottom - 0.5 &&
          g.bottom <= rows[k].stripBottom + 0.5,
      ),
  );
  return removed.map((k) => {
    const below = kept
      .filter((g) => g.top >= rows[k].stripBottom - 0.5)
      .map((g) => g.top);
    return {
      P: rows[k].descBottom,
      H: below.length > 0 ? Math.min(...below) : bottom,
    };
  });
}

/** @param {Layout} layout */
function celebrationsBottom(layout) {
  const section = layout.sections.find((s) => s.id === "celebrations");
  if (!section) throw new Error("the photo layout has no Celebrations");
  return section.bottom;
}

/**
 * Where a point of the drawn page sits on the page with the `removed` rituals' strips missing.
 * @template {Point} P @param {P} p @param {Layout} layout @param {number[]} removed @returns {P}
 */
export function toState(p, layout, removed) {
  const D = layout.strip;
  if (p.y >= celebrationsBottom(layout))
    return { ...p, y: p.y - removed.length * D };
  const rise = gapsOf(layout, removed).reduce(
    (dy, z) =>
      dy + (p.y >= z.H ? D : p.y > z.P ? (D * (p.y - z.P)) / (z.H - z.P) : 0),
    0,
  );
  return { ...p, y: p.y - rise };
}

/**
 * The inverse of `toState`: where a point of a photo state's page sits on the drawn page.
 * @template {Point} P @param {P} p @param {Layout} layout @param {number[]} removed @returns {P}
 */
export function toDrawn(p, layout, removed) {
  const total = removed.length * layout.strip;
  if (total === 0) return p;
  if (p.y >= celebrationsBottom(layout) - total)
    return { ...p, y: p.y + total };
  /* The close-up never folds the page back, so its inverse is found by halving. */
  let lo = p.y;
  let hi = p.y + total;
  for (let i = 0; i < 80; i += 1) {
    const mid = (lo + hi) / 2;
    if (toState({ x: 0, y: mid }, layout, removed).y < p.y) lo = mid;
    else hi = mid;
  }
  return { ...p, y: (lo + hi) / 2 };
}

/** @param {string} state */
const stripsIn = (state) => [...state].filter((c) => c === "1").length;

/**
 * The marks a photo state takes: of each group (one stretch, perhaps drawn on several states), the
 * marks drawn on this state, else — for marks that spread — those drawn on the state nearest in
 * strip count, the fewer strips winning a tie.
 * @template {Drawn} M @param {M[]} marks @param {string} combination @returns {M[]}
 */
export function chooseMarks(marks, combination) {
  const count = stripsIn(combination);
  /** @type {Map<number, M[]>} */
  const groups = new Map();
  for (const m of marks)
    groups.set(m.group, [...(groups.get(m.group) ?? []), m]);
  return [...groups.values()].flatMap((group) => {
    const exact = group.filter((m) => m.states.includes(combination));
    if (exact.length > 0) return exact;
    const spreading = group.filter((m) => m.spread);
    if (spreading.length === 0) return [];
    const rank = (/** @type {M} */ m) =>
      Math.min(
        ...m.states.map(
          (s) =>
            Math.abs(stripsIn(s) - count) * 10 + (stripsIn(s) > count ? 1 : 0),
        ),
      );
    const best = Math.min(...spreading.map(rank));
    return spreading.filter((m) => rank(m) === best);
  });
}

/** @param {Point[]} points */
function arcLengths(points) {
  const s = [0];
  for (let i = 1; i < points.length; i += 1)
    s.push(
      s[i - 1] +
        Math.hypot(
          points[i].x - points[i - 1].x,
          points[i].y - points[i - 1].y,
        ),
    );
  return s;
}

/**
 * The nearest point of any line to `q`.
 * @param {Point[][]} lines @param {Point} q
 */
function nearestOn(lines, q) {
  let best = { line: -1, seg: 0, point: q, d: Infinity, s: 0 };
  lines.forEach((points, line) => {
    const s = arcLengths(points);
    for (let i = 0; i < points.length - 1; i += 1) {
      const a = points[i];
      const b = points[i + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const span = dx * dx + dy * dy;
      const t =
        span === 0
          ? 0
          : Math.max(
              0,
              Math.min(1, ((q.x - a.x) * dx + (q.y - a.y) * dy) / span),
            );
      const point = { x: a.x + dx * t, y: a.y + dy * t };
      const d = Math.hypot(point.x - q.x, point.y - q.y);
      if (d < best.d)
        best = { line, seg: i, point, d, s: s[i] + Math.sqrt(span) * t };
    }
  });
  return best;
}

/** @param {Point[]} points */
function withoutRepeats(points) {
  return points.filter(
    (p, i) => i === 0 || p.x !== points[i - 1].x || p.y !== points[i - 1].y,
  );
}

/**
 * Where a traced pen stroke turns at a single point between two long straight runs: traced and
 * simplified, a hand-drawn stroke is short runs, so such a corner is where the pen ran along the red
 * line and then turned off it. Indices into `points`.
 * @param {Point[]} points
 */
export function cornersOf(points) {
  /** @type {number[]} */
  const corners = [];
  const s = arcLengths(points);
  for (let i = 1; i < points.length - 1; i += 1) {
    /* Rounding a corner replaces the stroke within CORNER_REACH of it, so a corner closer than two
       reaches to the last one kept would land on that curve. */
    if (
      corners.length > 0 &&
      s[i] - s[corners[corners.length - 1]] < 2 * CORNER_REACH
    )
      continue;
    const [p, q, r] = [points[i - 1], points[i], points[i + 1]];
    if (
      Math.hypot(q.x - p.x, q.y - p.y) < CORNER_RUN ||
      Math.hypot(r.x - q.x, r.y - q.y) < CORNER_RUN
    )
      continue;
    const turn = Math.abs(
      ((((Math.atan2(r.y - q.y, r.x - q.x) - Math.atan2(q.y - p.y, q.x - p.x)) *
        180) /
        Math.PI +
        540) %
        360) -
        180,
    );
    if (turn >= CORNER_TURN) corners.push(i);
  }
  return corners;
}

/**
 * The stroke with each named corner rounded over CORNER_REACH either side. Rounded on the photo
 * state's page, after the stroke is mapped there: a missing strip's gap closes up beneath it, and a
 * curve rounded before that would be squeezed into a bend.
 * @param {Point[]} points @param {number[]} corners indices into `points`
 */
export function roundedCorners(points, corners) {
  let out = points;
  /* Last first, so an earlier corner's index still names its point. */
  for (const i of [...corners].sort((a, b) => b - a)) {
    const s = arcLengths(out);
    const total = s[s.length - 1];
    const reach = Math.min(CORNER_REACH, s[i], total - s[i]);
    const from = alongStroke(out, s, s[i] - reach);
    const to = alongStroke(out, s, s[i] + reach);
    /* A cubic leaving and arriving along the runs, its arms about a circle's for this turn. */
    const arm = reach * 0.55;
    const c1 = { x: from.x + from.dx * arm, y: from.y + from.dy * arm };
    const c2 = { x: to.x - to.dx * arm, y: to.y - to.dy * arm };
    const steps = Math.ceil((2 * reach) / 4);
    const curve = [];
    for (let k = 0; k <= steps; k += 1) {
      const t = k / steps;
      const u = 1 - t;
      curve.push({
        x:
          u ** 3 * from.x +
          3 * u * u * t * c1.x +
          3 * u * t * t * c2.x +
          t ** 3 * to.x,
        y:
          u ** 3 * from.y +
          3 * u * u * t * c1.y +
          3 * u * t * t * c2.y +
          t ** 3 * to.y,
      });
    }
    out = [
      ...out.filter((_, k) => s[k] < s[i] - reach),
      ...curve,
      ...out.filter((_, k) => s[k] > s[i] + reach),
    ];
  }
  return out;
}

/**
 * The point `at` along a stroke, with the unit direction of the run it lies on.
 * @param {Point[]} points @param {number[]} s @param {number} at
 */
function alongStroke(points, s, at) {
  let k = 1;
  while (k < points.length - 1 && s[k] < at) k += 1;
  const a = points[k - 1];
  const b = points[k];
  const span = s[k] - s[k - 1] || 1;
  const t = Math.min(1, Math.max(0, (at - s[k - 1]) / span));
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    dx: (b.x - a.x) / span,
    dy: (b.y - a.y) / span,
  };
}

/**
 * The stroke with its ends moved onto `from` and `to`. A drift both ends share — the stroke drawn on
 * a page that sits a little apart from this one — carries the whole stroke. What is left at each
 * end — the line moved under that end since the stroke was drawn — eases out near that end, so the
 * rest of the stroke stays where it was drawn.
 * @param {Point[]} points @param {Point} from @param {Point} to
 */
function carriedOnto(points, from, to) {
  const s = arcLengths(points);
  const length = s[s.length - 1] || 1;
  const head = { x: from.x - points[0].x, y: from.y - points[0].y };
  const last = /** @type {Point} */ (points.at(-1));
  const tail = { x: to.x - last.x, y: to.y - last.y };
  const shared = sharedDrift(head, tail);
  const ownHead = { x: head.x - shared.x, y: head.y - shared.y };
  const ownTail = { x: tail.x - shared.x, y: tail.y - shared.y };
  /* Over a reach that grows with the drift, so a large one turns the line gently. */
  const reachOf = (/** @type {Point} */ v) =>
    Math.min(length, Math.max(BLEND, CARRY_REACH * Math.hypot(v.x, v.y)));
  const headReach = reachOf(ownHead);
  const tailReach = reachOf(ownTail);
  const fade = (/** @type {number} */ d, /** @type {number} */ reach) =>
    d >= reach ? 0 : Math.cos((Math.PI / 2) * (d / reach)) ** 2;
  return points.map((p, i) => {
    const h = fade(s[i], headReach);
    const t = fade(length - s[i], tailReach);
    return {
      x: p.x + shared.x + ownHead.x * h + ownTail.x * t,
      y: p.y + shared.y + ownHead.y * h + ownTail.y * t,
    };
  });
}

/* The part of two drifts that points the same way: the shorter one's projection onto the longer,
   none where they disagree. */
function sharedDrift(/** @type {Point} */ a, /** @type {Point} */ b) {
  const [short, long] =
    Math.hypot(a.x, a.y) <= Math.hypot(b.x, b.y) ? [a, b] : [b, a];
  const longLength = Math.hypot(long.x, long.y);
  if (longLength === 0) return { x: 0, y: 0 };
  const along = (short.x * long.x + short.y * long.y) / longLength;
  if (along <= 0) return { x: 0, y: 0 };
  return { x: (long.x / longLength) * along, y: (long.y / longLength) * along };
}

/**
 * The line with its run between `from` and `to` replaced by `middle`, eased in where the stroke
 * meets the line. A missing `from` or `to` is the line's own end, which stays where it is.
 * @param {Point[]} line
 * @param {{ seg: number, point: Point } | null} from
 * @param {{ seg: number, point: Point } | null} to
 * @param {Point[]} middle
 */
function splice(line, from, to, middle) {
  const spliced = withoutRepeats([
    ...(from ? [...line.slice(0, from.seg + 1), from.point] : [line[0]]),
    ...middle,
    ...(to
      ? [to.point, ...line.slice(to.seg + 1)]
      : [/** @type {Point} */ (line.at(-1))]),
  ]);
  const s = arcLengths(spliced);
  const length = s[s.length - 1];
  const seams = [from, to].flatMap((end) =>
    end
      ? [
          s[
            spliced.findIndex((p) => p.x === end.point.x && p.y === end.point.y)
          ] / length,
        ]
      : [],
  );
  return retouchPiece(
    spliced,
    seams.map((at) => ({
      at,
      reach: BLEND,
      smooth: /** @type {true} */ (true),
    })),
  );
}

/**
 * The owner's moves for one photo state: the line and the attachments inside each box carried by
 * (`dx`, `dy`), the line easing back over `ease` px of itself beyond the box. Applied to the drawn
 * connectors, before the motifs are fitted, so a motif inside the box moves with its line.
 * `place` takes a point of the drawn page to this state's page.
 * @template {{ points: Point[] }} C
 * @template {Point} A
 * @param {C[]} connectors @param {A[]} attachments @param {Move[] | undefined} moves
 * @param {(p: Point) => Point} place
 * @returns {{ connectors: C[], attachments: A[] }}
 */
export function applyMoves(connectors, attachments, moves, place) {
  const lines = connectors.map((c) => c.points.slice());
  const moved = attachments.map((a) => ({ ...a }));
  for (const move of moves ?? []) {
    const a = place({ x: move.box.x0, y: move.box.y0 });
    const b = place({ x: move.box.x1, y: move.box.y1 });
    const inBox = (/** @type {Point} */ p) =>
      p.x >= a.x && p.x <= b.x && p.y >= a.y && p.y <= b.y;
    lines.forEach((points, k) => {
      const inside = points.map(inBox);
      if (!inside.includes(true)) return;
      const s = arcLengths(points);
      const insideAt = s.filter((_, i) => inside[i]);
      lines[k] = points.map((p, i) => {
        const d = inside[i]
          ? 0
          : Math.min(...insideAt.map((t) => Math.abs(t - s[i])));
        if (d >= move.ease) return p;
        const w = Math.cos((Math.PI / 2) * (d / move.ease)) ** 2;
        return { ...p, x: p.x + (move.dx ?? 0) * w, y: p.y + move.dy * w };
      });
    });
    for (const att of moved)
      if (inBox(att)) {
        att.x += move.dx ?? 0;
        att.y += move.dy;
      }
  }
  return {
    connectors: connectors.map((c, k) => ({ ...c, points: lines[k] })),
    attachments: moved,
  };
}

/**
 * The first place the line crosses itself near `c` (within `near` px): the indices of the two
 * crossing spans, so the loop between them is `line.slice(i + 1, j + 1)`.
 * @param {Point[]} line @param {Point} c @param {number} near
 */
function loopNear(line, c, near) {
  const side = (
    /** @type {Point} */ p,
    /** @type {Point} */ q,
    /** @type {Point} */ r,
  ) => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
  const close = (/** @type {number} */ i) =>
    Math.hypot(line[i].x - c.x, line[i].y - c.y) < near;
  for (let i = 0; i < line.length - 1; i += 1) {
    if (!close(i)) continue;
    for (let j = i + 2; j < line.length - 1; j += 1) {
      if (!close(j)) continue;
      const [a, b, p, q] = [line[i], line[i + 1], line[j], line[j + 1]];
      if (
        side(a, b, p) * side(a, b, q) < 0 &&
        side(p, q, a) * side(p, q, b) < 0
      )
        return { i, j };
    }
  }
  return null;
}

/**
 * The line smoothed where it passes within `r` of `c`. A loop there is a drawn feature, not a kink:
 * it is kept whole, and the line either side of it smoothed with its join to the loop held.
 * @param {Point[]} line @param {Point} c @param {number} r @returns {Point[]}
 */
function smoothedAround(line, c, r) {
  const loop = loopNear(line, c, r * 1.5);
  if (loop)
    return [
      ...smoothedAround(line.slice(0, loop.i + 1), c, r),
      ...line.slice(loop.i + 1, loop.j + 1),
      ...smoothedAround(line.slice(loop.j + 1), c, r),
    ];
  let out = line;
  for (let pass = 0; pass < ZONE_PASSES; pass += 1) {
    const s = arcLengths(out);
    const length = s[s.length - 1];
    const inside = out.flatMap((p, i) =>
      Math.hypot(p.x - c.x, p.y - c.y) < r ? [s[i]] : [],
    );
    if (inside.length === 0 || length === 0) break;
    const from = Math.min(...inside);
    const to = Math.max(...inside);
    out = retouchPiece(out, [
      {
        at: (from + to) / 2 / length,
        reach: (to - from) / 2 + r / 2,
        smooth: true,
      },
    ]);
  }
  return out;
}

/**
 * Ramer-Douglas-Peucker: the fewest points whose polyline stays within `tolerance` of the run.
 * @param {Point[]} points @param {number} tolerance @returns {Point[]}
 */
function simplified(points, tolerance) {
  if (points.length < 3) return points;
  const first = points[0];
  const last = /** @type {Point} */ (points.at(-1));
  const dx = last.x - first.x;
  const dy = last.y - first.y;
  const span = Math.hypot(dx, dy) || 1;
  let worst = 0;
  let at = 0;
  for (let i = 1; i < points.length - 1; i += 1) {
    const d =
      Math.abs(
        dy * points[i].x -
          dx * points[i].y +
          last.x * first.y -
          last.y * first.x,
      ) / span;
    if (d > worst) {
      worst = d;
      at = i;
    }
  }
  if (worst <= tolerance) return [first, last];
  return [
    ...simplified(points.slice(0, at + 1), tolerance),
    ...simplified(points.slice(at), tolerance).slice(1),
  ];
}

/**
 * The marked line with the points its marks added thinned to THIN, between every pair of the
 * line's own points that survive untouched — so where no mark reached, nothing changes.
 * @param {Point[]} line @param {Point[]} own
 */
function thinned(line, own) {
  const kept = new Set(own.map((p) => `${p.x},${p.y}`));
  /** @type {Point[]} */
  const out = [];
  let run = [line[0]];
  for (let i = 1; i < line.length; i += 1) {
    run.push(line[i]);
    if (kept.has(`${line[i].x},${line[i].y}`) || i === line.length - 1) {
      out.push(...simplified(run, THIN).slice(out.length > 0 ? 1 : 0));
      run = [line[i]];
    }
  }
  return out;
}

/**
 * The owner's strokes and smoothing zones for one photo state, applied to its connectors as eased
 * into their motifs — the line the owner drew on. Every connector keeps both its ends, so each
 * still meets its motif. `place` takes a point of the drawn page to this state's page.
 * @template {{ points: Point[] }} C
 * @param {C[]} connectors @param {Pen} pen @param {string} combination
 * @param {(p: Point) => Point} place
 * @returns {C[]}
 */
export function applyPen(connectors, pen, combination, place) {
  const lines = connectors.map((c) => c.points.slice());

  const strokes = pen.strokes ?? [];
  for (const stroke of chooseMarks(strokes, combination)) {
    const index = strokes.indexOf(stroke);
    let points = roundedCorners(stroke.points.map(place), stroke.corners ?? []);
    let a = nearestOn(lines, points[0]);
    let b = nearestOn(lines, /** @type {Point} */ (points.at(-1)));
    const off = Math.max(a.d, b.d);
    if (off > SNAP)
      throw new Error(
        `stroke ${index} on ${combination}: an end lies ${off.toFixed(1)}px off the line`,
      );
    /* Where a motif's two connectors pass close, an end can lie nearest the other one. If both ends
       are within reach of one connector, the stroke is a fix to that connector. */
    if (a.line !== b.line) {
      const end = /** @type {Point} */ (points.at(-1));
      const bOnA = { ...nearestOn([lines[a.line]], end), line: a.line };
      const aOnB = { ...nearestOn([lines[b.line]], points[0]), line: b.line };
      if (bOnA.d <= SNAP && (aOnB.d > SNAP || bOnA.d <= aOnB.d)) b = bOnA;
      else if (aOnB.d <= SNAP) a = aOnB;
    }
    if (a.line > b.line || (a.line === b.line && a.s > b.s)) {
      [a, b] = [b, a];
      points = points.slice().reverse();
    }
    points = carriedOnto(points, a.point, b.point);
    if (a.line === b.line) {
      lines[a.line] = splice(lines[a.line], a, b, points.slice(1, -1));
      continue;
    }
    if (b.line !== a.line + 1)
      throw new Error(
        `stroke ${index} on ${combination}: its ends land on connectors that do not meet`,
      );
    /* From one connector to the next: the stroke passes the motif between them. Each connector
       keeps the end that meets the motif and takes the stroke up to the point nearest that end. */
    const into = lines[a.line];
    const outOf = lines[b.line];
    const nearest = (/** @type {Point} */ q, /** @type {number} */ from) => {
      let best = from;
      for (let i = from; i < points.length; i += 1)
        if (
          Math.hypot(points[i].x - q.x, points[i].y - q.y) <
          Math.hypot(points[best].x - q.x, points[best].y - q.y)
        )
          best = i;
      return best;
    };
    const iA = nearest(/** @type {Point} */ (into.at(-1)), 0);
    const iB = nearest(outOf[0], iA);
    /* Each half bends onto the motif's end rather than jumping to it from the stroke's nearest
       point, which turned the line back on itself where that point fell short. */
    const head = carriedOnto(
      points.slice(0, iA + 1),
      a.point,
      /** @type {Point} */ (into.at(-1)),
    );
    const tail = carriedOnto(points.slice(iB), outOf[0], b.point);
    lines[a.line] = splice(into, a, null, head.slice(1, -1));
    lines[b.line] = splice(outOf, null, b, tail.slice(1, -1));
  }

  for (const zone of chooseMarks(pen.zones ?? [], combination)) {
    const c = place(zone);
    lines.forEach((points, k) => {
      lines[k] = smoothedAround(points, c, zone.r);
    });
  }

  return connectors.map((c, k) => ({
    ...c,
    points: thinned(lines[k], c.points),
  }));
}

/**
 * Pen pixels: where the drawing differs from the sheet sent, the magenta pen (red well above green,
 * blue above green — the thread's red has no blue) and the cyan pen.
 * @param {Uint8Array} sent @param {Uint8Array} drawn @param {number} channels
 */
export function penMask(sent, drawn, channels) {
  const n = Math.floor(drawn.length / channels);
  const magenta = new Uint8Array(n);
  const cyan = new Uint8Array(n);
  for (let i = 0; i < n; i += 1) {
    const o = i * channels;
    const [r, g, b] = [drawn[o], drawn[o + 1], drawn[o + 2]];
    const change =
      Math.abs(sent[o] - r) +
      Math.abs(sent[o + 1] - g) +
      Math.abs(sent[o + 2] - b);
    if (change < 30) continue;
    if (r > 100 && r - g > 45 && b - g > 20) magenta[i] = 1;
    else if (b > 180 && g > 150 && r < 140) cyan[i] = 1;
  }
  return { magenta, cyan };
}

/**
 * One zone per connected blob of the mask: its centre, and the radius that encloses it.
 * @param {Uint8Array} mask @param {number} width @param {number} height
 * @returns {{ x: number, y: number, r: number, size: number }[]}
 */
export function zonesOf(mask, width, height) {
  const seen = new Uint8Array(mask.length);
  const out = [];
  for (let start = 0; start < mask.length; start += 1) {
    if (mask[start] === 0 || seen[start] === 1) continue;
    const stack = [start];
    /** @type {number[]} */
    const pixels = [];
    seen[start] = 1;
    while (stack.length > 0) {
      const at = /** @type {number} */ (stack.pop());
      pixels.push(at);
      const x = at % width;
      const y = Math.floor(at / width);
      for (let dy = -1; dy <= 1; dy += 1)
        for (let dx = -1; dx <= 1; dx += 1) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const n = ny * width + nx;
          if (mask[n] === 1 && seen[n] === 0) {
            seen[n] = 1;
            stack.push(n);
          }
        }
    }
    if (pixels.length < SPECK) continue;
    const cx = pixels.reduce((t, at) => t + (at % width), 0) / pixels.length;
    const cy =
      pixels.reduce((t, at) => t + Math.floor(at / width), 0) / pixels.length;
    const r = Math.max(
      ...pixels.map((at) =>
        Math.hypot((at % width) - cx, Math.floor(at / width) - cy),
      ),
    );
    out.push({ x: cx, y: cy, r: r + 0.5, size: pixels.length });
  }
  return out;
}

/**
 * Refuse a pen file the generator could not apply, naming the band and the mark.
 * @param {string} band @param {Pen} pen
 */
export function checkPen(band, pen) {
  const finite = (/** @type {unknown} */ v) =>
    typeof v === "number" && Number.isFinite(v);
  /** @param {Drawn} m */
  const drawnOk = (m) =>
    Number.isInteger(m.group) &&
    m.group >= 0 &&
    Array.isArray(m.states) &&
    m.states.length > 0 &&
    m.states.every((s) => /^[01]{4}$/.test(s));
  /** @param {string} kind @param {number} i @param {string} problem */
  const fail = (kind, i, problem) => {
    throw new Error(`${band}: pen ${kind} ${i}: ${problem}`);
  };
  /** @param {string} kind @param {Drawn} m @param {number} i */
  const spreadOk = (kind, m, i) => {
    if (m.spread !== undefined && typeof m.spread !== "boolean")
      fail(kind, i, "spread is true or false");
  };
  if (pen.refitRings !== undefined && typeof pen.refitRings !== "boolean")
    throw new Error(`${band}: pen refitRings is true or false`);
  (pen.strokes ?? []).forEach((m, i) => {
    spreadOk("stroke", m, i);
  });
  (pen.zones ?? []).forEach((m, i) => {
    spreadOk("zone", m, i);
  });
  (pen.strokes ?? []).forEach((m, i) => {
    if (!drawnOk(m))
      fail("stroke", i, "needs a group and the photo states it was drawn on");
    if (
      !Array.isArray(m.points) ||
      m.points.length < 2 ||
      !m.points.every((p) => finite(p.x) && finite(p.y))
    )
      fail("stroke", i, "needs two or more points");
    if (
      m.corners !== undefined &&
      !(
        Array.isArray(m.corners) &&
        m.corners.every(
          (k, n, corners) =>
            Number.isInteger(k) &&
            k > 0 &&
            k < m.points.length - 1 &&
            (n === 0 || k > corners[n - 1]),
        )
      )
    )
      fail(
        "stroke",
        i,
        "corners name points inside the stroke, in order, once each",
      );
  });
  (pen.zones ?? []).forEach((m, i) => {
    if (!drawnOk(m))
      fail("zone", i, "needs a group and the photo states it was drawn on");
    if (!finite(m.x) || !finite(m.y) || !finite(m.r) || m.r <= 0)
      fail("zone", i, "needs a centre and a radius");
  });
  (pen.moves ?? []).forEach((m, i) => {
    const b = m.box;
    if (!b || !(b.x0 < b.x1) || !(b.y0 < b.y1)) fail("move", i, "needs a box");
    if (
      !finite(m.dy) ||
      (m.dx !== undefined && !finite(m.dx)) ||
      !finite(m.ease) ||
      m.ease <= 0
    )
      fail("move", i, "needs a dy, a finite dx if any, and an ease");
  });
}
