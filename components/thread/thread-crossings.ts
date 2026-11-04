/* WHERE THE THREAD CROSSES ITSELF, and which of the two passes lies on top (DESIGN.md -> Thread ->
   Crossings). Pure geometry over each piece's own samples: no DOM, no React.

   The later pass lies on top along the route, since the thread grows and each new stretch lands on
   what is already there. Only a crossing whose two passes both lie inside one motif is woven, from
   that motif's own order, so a motif's data never depends on the route around it. */
import type { MotifId, Over, WeaveCrossing } from "./thread-geometry.ts";
import type { PieceSpan } from "./thread-head.ts";
import type { ThreadPiece } from "./thread-line.ts";
import type { PieceSamples } from "./thread-samples.ts";

export interface StrandPass {
  /* Index into the whole chain's pieces. */
  readonly piece: number;
  /* Arc px along that piece. */
  readonly at: number;
}

export interface Crossing {
  readonly x: number;
  readonly y: number;
  /* `first` is the earlier pass in draw order. */
  readonly first: StrandPass;
  readonly second: StrandPass;
}

export interface OrderedCrossing extends Crossing {
  readonly over: Over;
  readonly woven: boolean;
}

/* x the cord's width: two passes closer than this along the line are one bend of the cord, and the
   segments either side of a join or a vertex touch without crossing. */
export const CROSSING_MIN_GAP = 6;

/* A grid cell of this many px holds few enough segments that a page-length chain is tested in linear
   time; testing every pair (about 9000 px of chain) is 40 million tests per measure. */
const CELL = 16;

interface Segment {
  readonly ax: number;
  readonly ay: number;
  readonly bx: number;
  readonly by: number;
  readonly piece: number;
  readonly from: number;
  readonly to: number;
  readonly chainFrom: number;
}

function segmentsOf(
  samples: readonly (PieceSamples | undefined)[],
  pieces: readonly PieceSpan[],
): Segment[] {
  const segments: Segment[] = [];
  samples.forEach((sampled, piece) => {
    if (sampled === undefined) return;
    const { xy, length } = sampled;
    const last = Math.ceil(length);
    for (let i = 0; i < last; i += 1) {
      const from = Math.min(i, length);
      const to = Math.min(i + 1, length);
      if (to - from <= 0) continue;
      segments.push({
        ax: xy[2 * i],
        ay: xy[2 * i + 1],
        bx: xy[2 * i + 2],
        by: xy[2 * i + 3],
        piece,
        from,
        to,
        chainFrom: pieces[piece].start + from,
      });
    }
  });
  return segments;
}

/* Where two segments cross, as the fraction along each, or nothing when they do not. */
function intersect(p: Segment, q: Segment): [number, number] | undefined {
  const rx = p.bx - p.ax;
  const ry = p.by - p.ay;
  const sx = q.bx - q.ax;
  const sy = q.by - q.ay;
  const denominator = rx * sy - ry * sx;
  if (Math.abs(denominator) < 1e-12) return undefined;
  const u = ((q.ax - p.ax) * sy - (q.ay - p.ay) * sx) / denominator;
  const v = ((q.ax - p.ax) * ry - (q.ay - p.ay) * rx) / denominator;
  if (u < 0 || u > 1 || v < 0 || v > 1) return undefined;
  return [u, v];
}

/* Every crossing of the chain with itself, sorted by its first pass along the chain. `minGap` is in
   px. A crossing found on more than one pair of segments (a pass through a vertex) is reported once. */
export function findCrossings(
  samples: readonly (PieceSamples | undefined)[],
  pieces: readonly PieceSpan[],
  minGap: number,
): Crossing[] {
  const segments = segmentsOf(samples, pieces);
  const grid = new Map<string, number[]>();
  segments.forEach((segment, index) => {
    const [left, right] = [
      Math.min(segment.ax, segment.bx),
      Math.max(segment.ax, segment.bx),
    ];
    const [top, bottom] = [
      Math.min(segment.ay, segment.by),
      Math.max(segment.ay, segment.by),
    ];
    for (
      let cx = Math.floor(left / CELL);
      cx <= Math.floor(right / CELL);
      cx += 1
    ) {
      for (
        let cy = Math.floor(top / CELL);
        cy <= Math.floor(bottom / CELL);
        cy += 1
      ) {
        const key = `${cx},${cy}`;
        const cell = grid.get(key);
        if (cell === undefined) grid.set(key, [index]);
        else cell.push(index);
      }
    }
  });

  const tested = new Set<number>();
  const hits: {
    crossing: Crossing;
    chainFirst: number;
    chainSecond: number;
  }[] = [];
  for (const cell of grid.values()) {
    for (let a = 0; a < cell.length; a += 1) {
      for (let b = a + 1; b < cell.length; b += 1) {
        const [i, j] =
          cell[a] < cell[b] ? [cell[a], cell[b]] : [cell[b], cell[a]];
        const pair = i * segments.length + j;
        if (tested.has(pair)) continue;
        tested.add(pair);
        const p = segments[i];
        const q = segments[j];
        const crossing = intersect(p, q);
        if (crossing === undefined) continue;
        const [u, v] = crossing;
        const atP = p.from + u * (p.to - p.from);
        const atQ = q.from + v * (q.to - q.from);
        const chainP = pieces[p.piece].start + atP;
        const chainQ = pieces[q.piece].start + atQ;
        if (Math.abs(chainP - chainQ) < minGap) continue;
        const [first, second, chainFirst, chainSecond] =
          chainP <= chainQ
            ? [
                { piece: p.piece, at: atP },
                { piece: q.piece, at: atQ },
                chainP,
                chainQ,
              ]
            : [
                { piece: q.piece, at: atQ },
                { piece: p.piece, at: atP },
                chainQ,
                chainP,
              ];
        hits.push({
          crossing: {
            x: p.ax + u * (p.bx - p.ax),
            y: p.ay + u * (p.by - p.ay),
            first,
            second,
          },
          chainFirst,
          chainSecond,
        });
      }
    }
  }

  hits.sort(
    (a, b) => a.chainFirst - b.chainFirst || a.chainSecond - b.chainSecond,
  );
  const kept: typeof hits = [];
  for (const hit of hits) {
    const same = kept.some(
      (other) =>
        Math.abs(other.chainFirst - hit.chainFirst) < minGap &&
        Math.abs(other.chainSecond - hit.chainSecond) < minGap,
    );
    if (!same) kept.push(hit);
  }
  return kept.map((hit) => hit.crossing);
}

/* How close, as a fraction of the motif's length on both passes, a crossing must lie to a weave entry
   to be that entry: a crossing moves by well under a pixel between bands, and the nearest two entries
   of the busiest motif lie further apart than this. */
export const WEAVE_TOLERANCE = 0.015;

/* Which pass lies on top at each crossing, in the order handed in. A crossing is woven only when both
   passes lie in one motif piece and that motif's weave has an entry at the same place along it;
   anything else, including a crossing the weave no longer names, lies later-over-earlier. */
export function orderCrossings(
  crossings: readonly Crossing[],
  pieces: readonly ThreadPiece[],
  weaveOf: (motif: MotifId) => readonly WeaveCrossing[] | undefined,
): OrderedCrossing[] {
  return crossings.map((crossing) => {
    const piece = pieces[crossing.first.piece];
    if (
      crossing.first.piece !== crossing.second.piece ||
      piece.kind === "connector"
    )
      return { ...crossing, over: "second", woven: false };
    const length = piece.end - piece.start;
    const first = crossing.first.at / length;
    const second = crossing.second.at / length;
    let best: WeaveCrossing | undefined;
    let bestDistance = WEAVE_TOLERANCE;
    for (const entry of weaveOf(piece.kind) ?? []) {
      const distance = Math.max(
        Math.abs(entry.first - first),
        Math.abs(entry.second - second),
      );
      if (distance <= bestDistance) {
        best = entry;
        bestDistance = distance;
      }
    }
    return best === undefined
      ? { ...crossing, over: "second", woven: false }
      : { ...crossing, over: best.over, woven: true };
  });
}
