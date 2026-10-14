/** A computed CSS `<time>` in milliseconds. The build minifies `400ms` to `.4s`, so the unit cannot
    be assumed — reading the number alone turned a 400ms fade into a 0.4ms one. */
export function cssTimeMs(value: string, fallback = 0) {
  const match = /^\s*(-?\d*\.?\d+)(ms|s)\s*$/.exec(value);
  if (match === null) return fallback;
  const amount = Number(match[1]);
  return match[2] === "s" ? amount * 1000 : amount;
}
