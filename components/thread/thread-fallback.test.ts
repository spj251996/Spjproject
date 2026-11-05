import assert from "node:assert/strict";
import { test } from "node:test";
import { TALL_UPRIGHT_BOUNDARY, THREAD_BANDS } from "./thread-bands.ts";
import { normalise, PAGE_FALLBACKS } from "./thread-fallback.ts";

/* Evaluates the media queries the bands carry — a comma list of `and`-joined conditions on
   aspect-ratio, width in rem and orientation — against a window, so the bands can be checked at sample
   windows, their edges included. */
function matches(query: string, width: number, height: number): boolean {
  const aspect = width / height;
  const holds = (condition: string): boolean => {
    let m = condition.match(/^\(aspect-ratio < ([\d.]+)\)$/);
    if (m) return aspect < Number(m[1]);
    m = condition.match(/^\(([\d.]+) <= aspect-ratio\)$/);
    if (m) return aspect >= Number(m[1]);
    m = condition.match(/^\(width < ([\d.]+)rem\)$/);
    if (m) return width < Number(m[1]) * 16;
    m = condition.match(/^\(width >= ([\d.]+)rem\)$/);
    if (m) return width >= Number(m[1]) * 16;
    if (condition === "(orientation: landscape)") return width > height;
    if (condition === "(orientation: portrait)") return height >= width;
    throw new Error(`unrecognised condition ${condition}`);
  };
  return query
    .split(/,\s*/)
    .some((clause) => clause.split(/\s+and\s+/).every(holds));
}

/* The page lays its pairs out side by side from 64rem in landscape — the arrangement `wide` was
   drawn on; everywhere else they stack, and the window's aspect picks `tall` or `upright`. */
function bandFor(width: number, height: number): string {
  if (width >= 1024 && width > height) return "wide";
  return width / height < TALL_UPRIGHT_BOUNDARY ? "tall" : "upright";
}

test("every window matches exactly one band's query, the one drawn for its layout", () => {
  const queries = PAGE_FALLBACKS.map((fallback) => fallback.media);
  assert.equal(queries.length, THREAD_BANDS.length);
  const windows: [number, number][] = [];
  for (let width = 300; width <= 2600; width += 23)
    for (let height = 300; height <= 1600; height += 19)
      windows.push([width, height]);
  /* The edges themselves: either side of 64rem, square, and the tall/upright aspect. */
  for (const width of [1023, 1024, 1025])
    for (const height of [700, 800, 1000, 1023, 1024, 1025, 1400])
      windows.push([width, height]);
  windows.push(
    [1000, 1000],
    [700, Math.ceil(700 / TALL_UPRIGHT_BOUNDARY)],
    [700, Math.floor(700 / TALL_UPRIGHT_BOUNDARY)],
  );
  for (const [width, height] of windows) {
    const hits = PAGE_FALLBACKS.filter((fallback) =>
      matches(fallback.media, width, height),
    );
    assert.equal(
      hits.length,
      1,
      `${width}x${height} matches ${hits.length} bands`,
    );
    assert.equal(hits[0].band, bandFor(width, height), `${width}x${height}`);
  }
});

test("normalise is idempotent once its output is in the unit box", () => {
  const d = "M 10 20 C 30 40 50 60 70 80";
  const once = normalise(d, 100, 200);
  assert.equal(normalise(once, 1, 1), once);
});
