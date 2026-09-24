export type Point = { x: number; y: number };

const CONTROL_DIVISOR = 6;

/** `points[i]`, clamped to the array's ends — every span and every tangent reads through this. */
function at(points: readonly Point[], i: number): Point {
  const clamped = Math.min(Math.max(i, 0), points.length - 1);
  return points[clamped];
}

/**
 * Catmull-Rom, converted to one cubic Bézier per span. For span `p1 -> p2` with neighbours `p0`
 * and `p3`, the control points are `p1 + (p2 - p0) / 6` and `p2 - (p3 - p1) / 6`; an end point
 * duplicates its neighbour, which is what `at` clamping gives for free.
 */
export function splinePath(points: readonly Point[]): string {
  if (points.length === 0) return "";
  const first = points[0];
  const segments = [`M ${first.x} ${first.y}`];
  const spanCount = points.length - 1;
  for (let i = 0; i < spanCount; i++) {
    const p0 = at(points, i - 1);
    const p1 = at(points, i);
    const p2 = at(points, i + 1);
    const p3 = at(points, i + 2);
    const c1x = p1.x + (p2.x - p0.x) / CONTROL_DIVISOR;
    const c1y = p1.y + (p2.y - p0.y) / CONTROL_DIVISOR;
    const c2x = p2.x - (p3.x - p1.x) / CONTROL_DIVISOR;
    const c2y = p2.y - (p3.y - p1.y) / CONTROL_DIVISOR;
    segments.push(`C ${c1x} ${c1y} ${c2x} ${c2y} ${p2.x} ${p2.y}`);
  }
  return segments.join(" ");
}

/**
 * The direction of travel at `points[index]`, in degrees. Interior points use the central
 * difference `p[i+1] - p[i-1]`; the ends fall back to their one-sided neighbour via `at`'s
 * clamping, which makes the difference one-sided automatically.
 */
export function splineDirection(
  points: readonly Point[],
  index: number,
): number {
  const before = at(points, index - 1);
  const after = at(points, index + 1);
  const dx = after.x - before.x;
  const dy = after.y - before.y;
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}
