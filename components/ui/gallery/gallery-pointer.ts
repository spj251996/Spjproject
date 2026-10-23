export type Point = { x: number; y: number };
export type Rect = { left: number; top: number; width: number; height: number };
export type Size = { width: number; height: number };

const TAP_SLOP = 10;

/** Where an `object-contain` image actually draws inside its element's box. */
export function containedRect(box: Rect, natural: Size): Rect {
  if (natural.width <= 0 || natural.height <= 0) {
    return { left: box.left, top: box.top, width: 0, height: 0 };
  }
  const scale = Math.min(
    box.width / natural.width,
    box.height / natural.height,
  );
  const width = natural.width * scale;
  const height = natural.height * scale;
  return {
    left: box.left + (box.width - width) / 2,
    top: box.top + (box.height - height) / 2,
    width,
    height,
  };
}

/** A press and release less than `slop` apart is a tap; anything further is a swipe or a drag. */
export function isDeliberateTap(down: Point, up: Point, slop = TAP_SLOP) {
  return Math.hypot(up.x - down.x, up.y - down.y) < slop;
}

export function insideRect(point: Point, rect: Rect) {
  return (
    point.x >= rect.left &&
    point.x <= rect.left + rect.width &&
    point.y >= rect.top &&
    point.y <= rect.top + rect.height
  );
}
