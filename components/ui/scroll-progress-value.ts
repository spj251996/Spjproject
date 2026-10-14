/* The fill's share of the page already scrolled, 0 to 1. Clamped because iOS overscroll reports a
   negative `scrollY` at the top and one past the range at the bottom. A page with no scrollable
   range reads as wholly seen: there is nothing further down to announce. */
export function scrollProgress(
  scrollY: number,
  scrollHeight: number,
  viewportHeight: number,
): number {
  const range = scrollHeight - viewportHeight;
  if (range <= 0) return 1;
  return Math.min(1, Math.max(0, scrollY / range));
}
