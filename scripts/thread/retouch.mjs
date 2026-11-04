/* The owner's retouch: small corrections to the imported thread, made on the rendered page and kept
 * in `assets/thread/<band>/retouch.json` as an input to `build-thread-paths.mjs`.
 *
 * An edit names a place ALONG the line — the section, the index of that section's connector piece,
 * and how far along the piece (0–1) — never a point on the page. So it moves only the stretch it was
 * made on: a later pass of the line that happens to run close by in space is far away along the
 * line and stays as drawn. And it lands on the same stretch whatever the photo strips do to the page.
 *
 *   nudge  { section, piece, at, dx, dy, reach }       the point at `at` moves by (dx, dy)
 *   smooth { section, piece, at, reach, smooth: true }  the stretch is pulled toward its own average
 *
 * Either one fades to nothing `reach` px of line either side of `at`, and to nothing at the piece's
 * two ends: those meet a motif, a section boundary or the page's edge, and a moved end would open
 * the join there.
 */

/** @typedef {{ x: number, y: number }} Point */
/** @typedef {{ section: string, piece: number, at: number, reach: number, dx?: number, dy?: number, smooth?: true }} Edit */
/** @typedef {Omit<Edit, "section" | "piece">} Change what an edit does, wherever it is */

/* Spacing of the points added inside an edit's reach, so the falloff has a shape to bend. */
const STEP = 4;

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
 * The piece with points added every STEP px inside (lo, hi), on a grid that includes `centre`
 * itself; the drawn vertices are kept as they are.
 * @param {Point[]} points @param {number[]} s @param {number} centre @param {number} lo @param {number} hi
 */
function densifyAround(points, s, centre, lo, hi) {
  /** @type {{ p: Point, s: number }[]} */
  const out = [{ p: points[0], s: 0 }];
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    const from = Math.max(s[i - 1], lo);
    const to = Math.min(s[i], hi);
    if (from < to) {
      const first = Math.ceil((from - centre) / STEP);
      for (let k = first; centre + k * STEP < to; k += 1) {
        const at = centre + k * STEP;
        if (at <= s[i - 1] || at >= s[i]) continue;
        const t = (at - s[i - 1]) / (s[i] - s[i - 1]);
        out.push({
          p: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t },
          s: at,
        });
      }
    }
    out.push({ p: b, s: s[i] });
  }
  return out;
}

/** @param {Point[]} points @param {Change} edit */
function applyEdit(points, edit) {
  const s = arcLengths(points);
  const length = s[s.length - 1];
  if (length === 0) return points;
  const centre = edit.at * length;
  const { reach } = edit;
  const dense = densifyAround(
    points,
    s,
    centre,
    centre - reach,
    centre + reach,
  );

  /* cos² across the reach, times a smoothstep taper that holds both ends still. */
  const weight = (/** @type {number} */ at) => {
    const d = Math.abs(at - centre);
    if (d >= reach) return 0;
    const fall = Math.cos((Math.PI / 2) * (d / reach)) ** 2;
    const e = Math.min(1, at / reach, (length - at) / reach);
    return fall * e * e * (3 - 2 * e);
  };

  if (edit.smooth) {
    const sigma = reach / 3;
    return dense.map(({ p, s: at }) => {
      const w = weight(at);
      if (w === 0) return p;
      let sx = 0;
      let sy = 0;
      let total = 0;
      for (const q of dense) {
        const d = q.s - at;
        if (Math.abs(d) > reach) continue;
        const g = Math.exp(-(d * d) / (2 * sigma * sigma));
        sx += q.p.x * g;
        sy += q.p.y * g;
        total += g;
      }
      return {
        x: p.x + (sx / total - p.x) * w,
        y: p.y + (sy / total - p.y) * w,
      };
    });
  }
  const dx = edit.dx ?? 0;
  const dy = edit.dy ?? 0;
  return dense.map(({ p, s: at }) => {
    const w = weight(at);
    return w === 0 ? p : { x: p.x + dx * w, y: p.y + dy * w };
  });
}

/**
 * A connector piece with its edits applied, in order.
 * @param {Point[]} points @param {Change[]} edits
 */
export function retouchPiece(points, edits) {
  return edits.reduce(applyEdit, points);
}

/**
 * One piece's edits, in the file's order.
 * @param {Edit[]} edits @param {string} section @param {number} piece
 */
export function editsFor(edits, section, piece) {
  return edits.filter((e) => e.section === section && e.piece === piece);
}

/**
 * Refuses an edit that names no section, piece or place, or moves nothing.
 * @param {string} band @param {Edit[]} edits @param {readonly string[]} sections
 */
export function checkEdits(band, edits, sections) {
  edits.forEach((e, i) => {
    const finite = (/** @type {unknown} */ v) =>
      typeof v === "number" && Number.isFinite(v);
    const problem = !sections.includes(e.section)
      ? `unknown section "${e.section}"`
      : !Number.isInteger(e.piece) || e.piece < 0
        ? `piece ${e.piece} is not a piece index`
        : !finite(e.at) || e.at < 0 || e.at > 1
          ? `at ${e.at} is not a fraction 0–1`
          : !finite(e.reach) || e.reach <= 0
            ? `reach ${e.reach} is not a positive length`
            : e.smooth !== true && (!finite(e.dx) || !finite(e.dy))
              ? "a nudge needs dx and dy"
              : null;
    if (problem) throw new Error(`${band}: retouch edit ${i}: ${problem}`);
  });
}
