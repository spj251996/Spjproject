/* Adapts the thread's Celebrations stretch to any combination of photo strips.
 *
 * The owner drew the route once, on the page with every ritual's strip showing. Photographs arrive
 * ritual by ritual after each event, so the page can ship with any of the strips missing; each
 * missing strip takes its height out of the page beneath it. The drawn line is re-shaped for that
 * page rather than stretched: what runs beside type moves with the type, a run through an emptied
 * gap shrinks with the gap, a drawn loop is carried whole, and the change itself is smoothed along
 * the line so it adds no corner of its own.
 */

import { relaxOffType, typeClearanceReport } from "./import-thread-drawing.mjs";

/**
 * @typedef {{ x: number, y: number }} Point
 * @typedef {{ left: number, right: number, top: number, bottom: number, text?: string }} Glyph
 * @typedef {{ id: string, top: number, bottom: number }} Section
 * @typedef {{ top: number, descBottom: number, stripBottom: number, textLeft: number, textRight: number }} Row
 *   A ritual: its block's top, its description's last line, the bottom of its photo strip, and its
 *   text column. The strip occupies the `strip` pixels above `stripBottom`.
 * @typedef {{ width: number, strip: number, sections: Section[], rows: Row[], glyphs: Glyph[] }} PhotoLayout
 *   The page with every strip showing, measured; `strip` is the height one strip adds.
 * @typedef {{ shiftSigma?: number, roundSigma?: number }} Smoothing
 */

/* A point this near type is held by it, and moves with it. */
const HELD_BY_TYPE = 36;
/* Space kept clear above and below the type when a crossing is squeezed into a shrunk gap. */
const GAP_MARGIN = 10;
/* A free run that eases to within this of type is held to that type instead. */
const EASED_ONTO_TYPE = 14;
/* A carried loop is moved to the nearest place it clears type by this much. */
const LOOP_CLEARANCE = 9;
/* A loop is a self-crossing (or a near-touch the tracer drew as a kiss) closing within this arc. */
const LOOP_ARC = 260;
/* The run either side of a carried loop that blends into it. */
const LOOP_BLEND = 70;
/* How much harder than the gap a free bend inside it is narrowed, so it settles instead of curling. */
const BEND_POWER = 2.2;
/* Points are spaced this finely before re-shaping, so a long segment cannot swing across type. */
const DENSIFY = 3;
/* The owner's approved smoothing (2026-11-04): the shift is averaged over `shiftSigma` px of line,
   and the line itself rounded over `roundSigma` px. Tall carries the most squeeze and took more. */
const SMOOTHING = { shiftSigma: 60, roundSigma: 18 };
export const BAND_SMOOTHING = {
  tall: { shiftSigma: 110, roundSigma: 32 },
  upright: SMOOTHING,
  wide: SMOOTHING,
};

/** @param {Point} p @param {Glyph} g */
const distanceTo = (p, g) =>
  Math.hypot(
    Math.max(g.left - p.x, 0, p.x - g.right),
    Math.max(g.top - p.y, 0, p.y - g.bottom),
  );
/** @param {Point} p @param {Glyph[]} glyphs */
const nearestType = (p, glyphs) =>
  glyphs.reduce((m, g) => Math.min(m, distanceTo(p, g)), Infinity);
/** @param {number} t */
const ease = (t) => t * t * (3 - 2 * t);

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

/** @param {Point[]} points @param {number} step */
function densify(points, step) {
  const out = [points[0]];
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / step));
    for (let t = 1; t <= n; t += 1)
      out.push({
        x: a.x + ((b.x - a.x) * t) / n,
        y: a.y + ((b.y - a.y) * t) / n,
      });
  }
  return out;
}

/**
 * The page with the given rituals' strips removed: every strip's glyphs gone, and everything below a
 * removed strip lifted by the strip's height.
 * @param {PhotoLayout} layout
 * @param {number[]} removed ritual indices
 * @returns {PhotoLayout}
 */
export function layoutWithout(layout, removed) {
  const { strip } = layout;
  const gone = removed.map((k) => layout.rows[k].stripBottom);
  /** @param {number} y */
  const lift = (y) => gone.filter((bottom) => y >= bottom - 0.5).length * strip;
  const inStrip = (/** @type {Glyph} */ g) =>
    gone.some(
      (bottom) => g.top >= bottom - strip - 0.5 && g.bottom <= bottom + 0.5,
    );
  const total = gone.length * strip;
  return {
    ...layout,
    sections: layout.sections.map((s) =>
      s.id === "celebrations"
        ? { ...s, bottom: s.bottom - total }
        : { ...s, top: s.top - lift(s.top), bottom: s.bottom - lift(s.top) },
    ),
    rows: layout.rows.map((r) => {
      const dy = lift(r.top);
      return {
        ...r,
        top: r.top - dy,
        descBottom: r.descBottom - dy,
        stripBottom: r.stripBottom - dy,
      };
    }),
    glyphs: layout.glyphs
      .filter((g) => !inStrip(g))
      .map((g) => ({
        ...g,
        top: g.top - lift(g.top),
        bottom: g.bottom - lift(g.top),
      })),
  };
}

/**
 * The line's loops: each first self-crossing that closes within LOOP_ARC, and each near-touch (two
 * passes within 3px, at least 40px of line apart) the tracer drew as a kiss.
 * @param {Point[]} p
 * @param {number[]} s arc lengths
 */
function loopsOf(p, s) {
  /** @type {{ i: number, j: number }[]} */
  const loops = [];
  /** @param {Point} a @param {Point} b @param {Point} c @param {Point} d */
  const crosses = (a, b, c, d) => {
    const den = (b.x - a.x) * (d.y - c.y) - (b.y - a.y) * (d.x - c.x);
    if (Math.abs(den) < 1e-9) return false;
    const t = ((c.x - a.x) * (d.y - c.y) - (c.y - a.y) * (d.x - c.x)) / den;
    const u = ((c.x - a.x) * (b.y - a.y) - (c.y - a.y) * (b.x - a.x)) / den;
    return t >= 0 && t <= 1 && u >= 0 && u <= 1;
  };
  for (let i = 0; i < p.length - 1; i += 1)
    for (let j = i + 2; j < p.length - 1 && s[j] - s[i] < LOOP_ARC; j += 1)
      if (crosses(p[i], p[i + 1], p[j], p[j + 1])) {
        loops.push({ i, j });
        i = j;
        break;
      }
  for (let i = 0; i < p.length; i += 1)
    for (let j = i + 4; j < p.length && s[j] - s[i] < LOOP_ARC; j += 1) {
      if (s[j] - s[i] < 40) continue;
      const near = Math.hypot(p[i].x - p[j].x, p[i].y - p[j].y) < 3;
      if (near && !loops.some((l) => i <= l.j && j >= l.i)) {
        loops.push({ i, j });
        i = j;
        break;
      }
    }
  return loops.sort((a, b) => a.i - b.i);
}

/**
 * Re-shape the line's Celebrations stretch for the page with `removed` rituals' strips taken out.
 * `line` runs from the top of Celebrations to the bottom of the page in the all-strips page's
 * pixels; the result is in the target page's pixels, its ends where the line meets its neighbours.
 * @param {Point[]} line
 * @param {PhotoLayout} layout
 * @param {number[]} removed
 * @param {Smoothing} [smoothing]
 */
export function adaptCelebrations(
  line,
  layout,
  removed,
  smoothing = SMOOTHING,
) {
  const {
    shiftSigma = SMOOTHING.shiftSigma,
    roundSigma = SMOOTHING.roundSigma,
  } = smoothing;
  const D = layout.strip;
  const rows = layout.rows;
  const pts = densify(line, DENSIFY);
  const s = arcLengths(pts);

  /* Type that stays on the page, in the all-strips page's pixels. */
  const kept = layout.glyphs.filter(
    (g) =>
      !removed.some(
        (k) =>
          g.top >= rows[k].descBottom - 0.5 &&
          g.bottom <= rows[k].stripBottom + 0.5,
      ),
  );
  /* Each removed strip empties the gap from its description to the next type below; the gap
     shrinks by the strip's height. */
  const celebrationsBottom = /** @type {Section} */ (
    layout.sections.find((x) => x.id === "celebrations")
  ).bottom;
  const zones = removed.map((k) => {
    const below = kept
      .filter((g) => g.top >= rows[k].stripBottom - 0.5)
      .map((g) => g.top);
    return {
      P: rows[k].descBottom,
      H: below.length > 0 ? Math.min(...below) : celebrationsBottom,
      fit: 1,
    };
  });
  /** How far type at height y rises. */
  const typeShift = (/** @type {number} */ y) =>
    zones.reduce((dy, z) => dy + (y >= z.H ? D : 0), 0);
  /** Inside a shrunk gap, a point's rise follows its height, so the line never folds back. */
  const gapShift = (/** @type {number} */ y) =>
    zones.reduce(
      (dy, z) =>
        dy + (y >= z.H ? D : y > z.P ? (D * (y - z.P)) / (z.H - z.P) : 0),
      0,
    );

  /* Held points: in the ritual column, or near type. */
  const colLeft = Math.min(...rows.map((r) => r.textLeft)) - 8;
  const colRight = Math.max(...rows.map((r) => r.textRight)) + 8;
  const listTop = rows[0].top;
  const listBottom = rows[rows.length - 1].stripBottom;
  const held = pts.map(
    (p) =>
      (p.x >= colLeft &&
        p.x <= colRight &&
        p.y >= listTop &&
        p.y <= listBottom) ||
      nearestType(p, kept) < HELD_BY_TYPE,
  );

  /** @type {(number | null)[]} the rise of each point */
  const rise = pts.map(() => null);
  /* A held run inside a shrunk gap moves whole, squeezed only if the gap no longer holds it. */
  for (const z of zones) {
    const inside = pts.flatMap((p, i) =>
      held[i] && p.y > z.P && p.y < z.H ? [i] : [],
    );
    if (inside.length === 0) continue;
    const ylo = Math.min(...inside.map((i) => pts[i].y));
    const yhi = Math.max(...inside.map((i) => pts[i].y));
    const span = yhi - ylo;
    const room = z.H - D - z.P - 2 * GAP_MARGIN;
    const k = span > 0 ? Math.min(1, room / span) : 1;
    const carried = zones.filter((o) => o.H <= z.P).length * D;
    const lo = Math.max(
      z.P + GAP_MARGIN,
      Math.min(ylo - D, z.H - D - GAP_MARGIN - span * k),
    );
    for (const i of inside)
      rise[i] = pts[i].y - (lo + (pts[i].y - ylo) * k) + carried;
    z.fit = k;
  }
  /* Any other held point moves with the type that holds it. */
  for (let i = 0; i < pts.length; i += 1) {
    if (rise[i] !== null || !held[i]) continue;
    const near = kept.reduce(
      (b, g) =>
        distanceTo(pts[i], g) < b.d ? { d: distanceTo(pts[i], g), g } : b,
      { d: Infinity, g: /** @type {Glyph | null} */ (null) },
    );
    rise[i] =
      near.g && near.d < HELD_BY_TYPE
        ? typeShift(near.g.top)
        : typeShift(pts[i].y);
  }
  const freeAtFirst = rise.map((r) => r === null);
  for (let i = 0; i < pts.length; i += 1)
    if (rise[i] === null && zones.some((z) => pts[i].y > z.P && pts[i].y < z.H))
      rise[i] = gapShift(pts[i].y);

  /* The rest eases along the line between the fixed points; where it eases onto type, it is held
     to that type and the rest eases again. */
  const fixed = rise.slice();
  /** @type {number[]} */
  const d = new Array(pts.length).fill(0);
  const easeFree = () => {
    for (let i = 0; i < pts.length; ) {
      const here = fixed[i];
      if (here !== null) {
        d[i] = here;
        i += 1;
        continue;
      }
      let j = i;
      while (j < pts.length && fixed[j] === null) j += 1;
      const before = i > 0 ? /** @type {number} */ (fixed[i - 1]) : null;
      const after = j < pts.length ? /** @type {number} */ (fixed[j]) : null;
      const da = before ?? 0; // the line starts where Celebrations meets Family, which never moves
      const db = after ?? typeShift(pts[pts.length - 1].y);
      const sa = i > 0 ? s[i - 1] : s[i];
      const sb = j < pts.length ? s[j] : s[pts.length - 1];
      for (let q = i; q < j; q += 1)
        d[q] = da + (db - da) * ease(sb > sa ? (s[q] - sa) / (sb - sa) : 1);
      i = j;
    }
  };
  const moved = kept.map((g) => {
    const c = typeShift(g.top);
    return { ...g, top: g.top - c, bottom: g.bottom - c, c };
  });
  for (let round = 0; round < 8; round += 1) {
    easeFree();
    let held2 = 0;
    for (let q = 0; q < pts.length; q += 1) {
      if (fixed[q] !== null) continue;
      const p = { x: pts[q].x, y: pts[q].y - d[q] };
      const hit = moved.find((g) => distanceTo(p, g) < EASED_ONTO_TYPE);
      if (hit) {
        fixed[q] = hit.c;
        held2 += 1;
      }
    }
    if (held2 === 0) break;
  }

  /* A loop keeps its drawn shape: carried whole to the nearest rise that clears type, with the line
     blending into it either side. */
  const target = layoutWithout(layout, removed);
  const loops = loopsOf(pts, s);
  for (const l of loops) {
    const loopPts = pts.slice(l.i, l.j + 2);
    const clearAt = (/** @type {number} */ dl) =>
      Math.min(
        ...loopPts.map((p) =>
          nearestType({ x: p.x, y: p.y - dl }, target.glyphs),
        ),
      );
    const base = d[l.i];
    let dl = base;
    for (let step = 0; step <= 60; step += 1) {
      if (clearAt(base - step) >= LOOP_CLEARANCE) {
        dl = base - step;
        break;
      }
      if (clearAt(base + step) >= LOOP_CLEARANCE) {
        dl = base + step;
        break;
      }
    }
    const from = d.slice();
    for (let q = l.i; q <= l.j + 1; q += 1) d[q] = dl;
    for (let q = l.i - 1; q >= 0 && s[l.i] - s[q] < LOOP_BLEND; q -= 1)
      d[q] = dl + (from[q] - dl) * ease((s[l.i] - s[q]) / LOOP_BLEND);
    for (
      let q = l.j + 2;
      q < pts.length && s[q] - s[l.j + 1] < LOOP_BLEND;
      q += 1
    )
      d[q] = dl + (from[q] - dl) * ease((s[q] - s[l.j + 1]) / LOOP_BLEND);
  }
  const inLoop = new Int32Array(pts.length).fill(-1);
  loops.forEach((l, n) => {
    for (let q = l.i; q <= l.j + 1; q += 1) inLoop[q] = n;
  });

  /** Gaussian average over arc length; the line's own shape stops at loops, so a loop keeps its
      drawn form, while the rise averages straight across them. @param {number[]} values
      @param {number} sigma @param {number} q @param {boolean} [throughLoops] */
  const smooth = (values, sigma, q, throughLoops = false) => {
    let w = 0;
    let v = 0;
    for (
      let r = q;
      r >= 0 && s[q] - s[r] < 3 * sigma && (throughLoops || inLoop[r] < 0);
      r -= 1
    ) {
      const k = Math.exp(-((s[q] - s[r]) ** 2) / (2 * sigma * sigma));
      w += k;
      v += k * values[r];
    }
    for (
      let r = q + 1;
      r < pts.length &&
      s[r] - s[q] < 3 * sigma &&
      (throughLoops || inLoop[r] < 0);
      r += 1
    ) {
      const k = Math.exp(-((s[r] - s[q]) ** 2) / (2 * sigma * sigma));
      w += k;
      v += k * values[r];
    }
    return v / w;
  };

  /* The rise is smoothed along the line, so the adaptation brings no corner of its own. */
  const raw = d.slice();
  const last = s[pts.length - 1];
  /** How fully point q takes a smoothing of reach sigma: none at the line's ends, where it meets
      its neighbours, rising to full within three sigma. @param {number} q @param {number} sigma */
  const reach = (q, sigma) =>
    Math.min(1, s[q] / (3 * sigma), (last - s[q]) / (3 * sigma));
  for (let q = 0; q < pts.length; q += 1)
    if (inLoop[q] < 0)
      d[q] =
        raw[q] +
        (smooth(raw, shiftSigma, q, true) - raw[q]) * reach(q, shiftSigma);

  /* A free bend inside a shrunk gap is narrowed toward its chord harder than the gap shrank. */
  const dx = new Float64Array(pts.length);
  for (const z of zones)
    for (let i = 0; i < pts.length; ) {
      const inside = (/** @type {number} */ q) =>
        freeAtFirst[q] && pts[q].y > z.P && pts[q].y < z.H;
      if (!inside(i)) {
        i += 1;
        continue;
      }
      let j = i;
      while (j < pts.length && inside(j)) j += 1;
      const a = Math.max(0, i - 1);
      const b = Math.min(pts.length - 1, j);
      let y0 = Infinity;
      let y1 = -Infinity;
      let t0 = Infinity;
      let t1 = -Infinity;
      for (let q = a; q <= b; q += 1) {
        y0 = Math.min(y0, pts[q].y);
        y1 = Math.max(y1, pts[q].y);
        t0 = Math.min(t0, pts[q].y - d[q]);
        t1 = Math.max(t1, pts[q].y - d[q]);
      }
      const ratio =
        y1 - y0 > 20 ? Math.min(1, Math.max(0.25, (t1 - t0) / (y1 - y0))) : 1;
      const k = ratio ** BEND_POWER;
      if (k < 0.97)
        for (let q = a; q <= b; q += 1) {
          const t = s[b] > s[a] ? (s[q] - s[a]) / (s[b] - s[a]) : 0;
          const chord = pts[a].x + (pts[b].x - pts[a].x) * t;
          const weight = Math.sin(Math.PI * Math.min(1, Math.max(0, t))) ** 0.5;
          dx[q] = (chord - pts[q].x) * (1 - k) * weight;
        }
      i = j;
    }
  for (const l of loops)
    for (let q = l.i; q <= l.j + 1; q += 1) dx[q] = dx[l.i];

  let points = pts.map((p, q) => ({
    x: Math.min(Math.max(p.x + dx[q], 3), layout.width - 3),
    y: p.y - d[q],
  }));
  /* The line itself is rounded over a short reach, so a squeezed crossing curves rather than
     turns; loops are carried whole, and the line's ends stay where they meet the motifs. */
  if (roundSigma > 0) {
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    points = points.map((p, q) => {
      if (inLoop[q] >= 0) return p;
      const pin = reach(q, roundSigma);
      return {
        x: p.x + (smooth(xs, roundSigma, q) - p.x) * pin,
        y: p.y + (smooth(ys, roundSigma, q) - p.y) * pin,
      };
    });
  }

  const geometry = {
    width: target.width,
    sections: target.sections.map((x) => ({
      top: x.top,
      height: x.bottom - x.top,
    })),
  };
  const relaxed = relaxOffType(
    [{ connector: 0, points }],
    geometry,
    target.glyphs,
  );
  const adapted = /** @type {Point[]} */ (relaxed.connectors[0].points);
  const cells = typeClearanceReport(
    relaxed.connectors,
    geometry,
    target.glyphs,
  );
  return {
    points: adapted,
    zones,
    loops: loops.length,
    report: {
      min: Math.min(...cells.map((c) => c.min)),
      crossings: cells.reduce((n, c) => n + c.crossings, 0),
    },
  };
}
