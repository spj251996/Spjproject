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
 * the join there. So a motif is moved by an edit of its own, which carries the line with it:
 *
 *   move   { section, motif, dx, dy, ease }  the motif and the line round it move by (dx, dy), the
 *                                            line easing back over `ease` px beyond the motif's ends
 */

/** @typedef {{ x: number, y: number }} Point */
/** @typedef {{ section: string, piece: number, at: number, reach: number, dx?: number, dy?: number, smooth?: true }} Edit */
/** @typedef {Omit<Edit, "section" | "piece">} Change what an edit does, wherever it is */
/** @typedef {{ section: string, motif: string, dx: number, dy: number, ease: number }} MotifMove */
/** @typedef {Edit | MotifMove} Retouch one entry of a band's retouch file */

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

  /* cos² across the reach, squeezed on the side of an end nearer than the reach so the end holds
     still while the named point still takes the whole offset. A taper across the ends instead
     slid the peak inward, onto the next dot the panel shows. */
  const before = Math.min(reach, centre);
  const after = Math.min(reach, length - centre);
  /* An edit on an end itself has nothing it may move. */
  if (before === 0 || after === 0) return points;
  const weight = (/** @type {number} */ at) => {
    const side = at < centre ? before : after;
    const d = Math.abs(at - centre);
    if (d >= side) return 0;
    return Math.cos((Math.PI / 2) * (d / side)) ** 2;
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
 * @param {Retouch[]} edits @param {string} section @param {number} piece
 * @returns {Edit[]}
 */
export function editsFor(edits, section, piece) {
  return edits.filter(
    /** @returns {e is Edit} */ (e) =>
      "piece" in e && e.section === section && e.piece === piece,
  );
}

/* How far a motif move's box reaches past the motif's two ends: a drawn line ends a few px off the
   point its motif was fitted to, and a move leaves a line with no point in its box where it was. */
const MOTIF_MARGIN = 12;

/**
 * The motif moves, each as a move of the box its motif's two ends span, MOTIF_MARGIN wider each way —
 * the line inside it is the motif's own approach, and both connectors ease back beyond it.
 * @param {Retouch[]} edits
 * @param {{ section: string, motif: string, x: number, y: number }[]} attachments entry/exit pairs on the drawn page
 */
export function motifMoves(edits, attachments) {
  return edits
    .filter(/** @returns {e is MotifMove} */ (e) => "motif" in e)
    .map((e) => {
      const ends = attachments.filter(
        (a) => a.section === e.section && a.motif === e.motif,
      );
      if (ends.length !== 2)
        throw new Error(`${e.section} has no ${e.motif} to move`);
      const xs = ends.map((a) => a.x);
      const ys = ends.map((a) => a.y);
      return {
        box: {
          x0: Math.min(...xs) - MOTIF_MARGIN,
          y0: Math.min(...ys) - MOTIF_MARGIN,
          x1: Math.max(...xs) + MOTIF_MARGIN,
          y1: Math.max(...ys) + MOTIF_MARGIN,
        },
        dx: e.dx,
        dy: e.dy,
        ease: e.ease,
      };
    });
}

/**
 * Refuses an edit that names no section, piece or place, or moves nothing.
 * @param {string} band @param {Retouch[]} edits @param {readonly string[]} sections
 */
export function checkEdits(band, edits, sections) {
  edits.forEach((e, i) => {
    const finite = (/** @type {unknown} */ v) =>
      typeof v === "number" && Number.isFinite(v);
    if ("motif" in e) {
      const problem = !sections.includes(e.section)
        ? `unknown section "${e.section}"`
        : typeof e.motif !== "string" || e.motif === ""
          ? "a move names no motif"
          : !finite(e.dx) || !finite(e.dy)
            ? "a move needs dx and dy"
            : !finite(e.ease) || e.ease <= 0
              ? `ease ${e.ease} is not a positive length`
              : null;
      if (problem) throw new Error(`${band}: retouch edit ${i}: ${problem}`);
      return;
    }
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
