/* ---------------------------------------------------------------------------------------------
   THE GEOMETRY OF A RUN */

/* A piece's `d` is only ever `M` then `C`s (`thread-line.ts` emits nothing else), so its points are
   computed from the `d` itself rather than asked of the browser. `getPointAtLength` walks the whole
   path on every call, so sampling a 100-segment motif once per pixel is quadratic: measured at about
   a second of main thread for the page, in stalls of 25-85ms as the head reached each piece. Each
   cubic is cut into chords about this long (by its control polygon, which bounds its length) and the
   whole run is then walked once at one point per pixel of arc. A fixed number of chords per cubic
   was tried first and was off the true arc by 0.26px on a long connector, whose cubics are 50px. */
const CHORD_LENGTH = 1;
const MIN_CHORDS = 8;

const PATH_TOKEN = /[A-Za-z]|-?\d*\.?\d+(?:[eE][-+]?\d+)?/g;

/* `length` is the piece's own length from the model, the same one its dash is scaled by. The
   polyline's arc length is scaled onto it, so a sample at arc `s` lands where the ink's dash ends at
   `s` to well under a hundredth of a pixel, and the two agree at the piece's end exactly. */
export function samplePath(d: string, length: number): PieceSamples {
  const tokens = d.match(PATH_TOKEN) ?? [];
  const xs: number[] = [];
  const ys: number[] = [];
  const along: number[] = [];
  const lay = (x: number, y: number) => {
    const last = xs.length - 1;
    along.push(
      last < 0 ? 0 : along[last] + Math.hypot(x - xs[last], y - ys[last]),
    );
    xs.push(x);
    ys.push(y);
  };
  let command = "";
  let index = 0;
  const next = () => Number(tokens[index++]);
  while (index < tokens.length) {
    if (/^[A-Za-z]$/.test(tokens[index])) {
      command = tokens[index++];
      if (command !== "M" && command !== "C") {
        throw new Error(`samplePath: unsupported path command "${command}"`);
      }
      continue;
    }
    if (command === "M") {
      lay(next(), next());
      command = "";
    } else if (command === "C" && xs.length > 0) {
      const [x0, y0] = [xs[xs.length - 1], ys[ys.length - 1]];
      const [x1, y1, x2, y2, x3, y3] = [
        next(),
        next(),
        next(),
        next(),
        next(),
        next(),
      ];
      const controlLength =
        Math.hypot(x1 - x0, y1 - y0) +
        Math.hypot(x2 - x1, y2 - y1) +
        Math.hypot(x3 - x2, y3 - y2);
      const chords = Math.max(
        MIN_CHORDS,
        Math.ceil(controlLength / CHORD_LENGTH),
      );
      for (let chord = 1; chord <= chords; chord += 1) {
        const t = chord / chords;
        const u = 1 - t;
        const [a, b, c, e] = [
          u * u * u,
          3 * u * u * t,
          3 * u * t * t,
          t * t * t,
        ];
        lay(
          a * x0 + b * x1 + c * x2 + e * x3,
          a * y0 + b * y1 + c * y2 + e * y3,
        );
      }
    } else {
      throw new Error("samplePath: numbers with no command to read them");
    }
  }

  const count = Math.ceil(length) + 2;
  const xy = new Float32Array(count * 2);
  const scale = length > 0 ? along[along.length - 1] / length : 0;
  let segment = 1;
  for (let i = 0; i < count; i += 1) {
    const target = Math.min(length, i) * scale;
    while (segment < along.length - 1 && along[segment] < target) segment += 1;
    const span = along[segment] - along[segment - 1];
    const t = span > 0 ? (target - along[segment - 1]) / span : 0;
    xy[2 * i] = xs[segment - 1] + (xs[segment] - xs[segment - 1]) * t;
    xy[2 * i + 1] = ys[segment - 1] + (ys[segment] - ys[segment - 1]) * t;
  }
  return { xy, length };
}

/* A piece's points, one per pixel of arc, so a frame slices numbers instead of asking the browser
   for points: `getPointAtLength` walks the whole path on every call. The sampler leaves two extra
   points past the end so interpolating at the very end never reads beyond the array. */
export interface PieceSamples {
  readonly xy: Float32Array;
  readonly length: number;
}

/* A position past the path's end continues along the path's own last direction, and one before its
   start along the first. That is what lets a run cross into a piece that lives in another `<svg>`:
   this side has to overlap the far side, or this side's own round end cap of ink stands out past
   the join as a dark half-disc and the two runs' butt ends antialias into a hairline (both seen at
   12x). It is also what lets the taper's cut reach past a free end far enough to take the ink's cap
   and its bleed with it. */
export function polylineBetween(
  { xy, length }: PieceSamples,
  from: number,
  to: number,
): string {
  const lastIndex = xy.length / 2 - 2;
  const point = (position: number): [number, number] => {
    const clamped = Math.max(0, Math.min(length, position));
    const index = Math.min(Math.floor(clamped), lastIndex);
    const next = Math.min(length, index + 1);
    const t = next > index ? (clamped - index) / (next - index) : 0;
    return [
      xy[2 * index] * (1 - t) + xy[2 * index + 2] * t,
      xy[2 * index + 1] * (1 - t) + xy[2 * index + 3] * t,
    ];
  };
  const format = ([x, y]: [number, number]) =>
    `${x.toFixed(2)} ${y.toFixed(2)}`;
  /* `distance` beyond `end`, on the line `end` lies on running away from `inside`. */
  const beyond = (
    end: [number, number],
    inside: [number, number],
    distance: number,
  ): [number, number] => {
    const run = Math.hypot(end[0] - inside[0], end[1] - inside[1]) || 1;
    return [
      end[0] + ((end[0] - inside[0]) / run) * distance,
      end[1] + ((end[1] - inside[1]) / run) * distance,
    ];
  };
  let d =
    from < 0
      ? `M${format(beyond(point(0), point(1), -from))}L${format(point(0))}`
      : `M${format(point(from))}`;
  for (
    let i = Math.max(1, Math.floor(from) + 1);
    i < Math.min(to, length);
    i += 1
  ) {
    d += `L${xy[2 * i].toFixed(2)} ${xy[2 * i + 1].toFixed(2)}`;
  }
  if (to <= length) return `${d}L${format(point(to))}`;
  const end = point(length);
  return `${d}L${format(end)}L${format(beyond(end, point(length - 1), to - length))}`;
}
