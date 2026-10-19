import assert from "node:assert/strict";
import { test } from "node:test";
import { THREAD_BANDS } from "./thread-bands.ts";
import {
  aspectQuery,
  authoredMeasuredSections,
  normalise,
  PAGE_FALLBACKS,
  splitSubpaths,
  subpathRange,
} from "./thread-fallback.ts";
import { threadLine } from "./thread-line.ts";
import { THREAD_IDS } from "./thread-paths.ts";

test("splitSubpaths returns one entry per M", () => {
  const parts = splitSubpaths("M 0 0 C 1 1 2 2 3 3 M 4 4 C 5 5 6 6 7 7 M 8 8");
  assert.equal(parts.length, 3);
  for (const part of parts) assert.match(part, /^M /);
});

test("each band emits one subpath per piece, and its section ranges are contiguous and cover them all", () => {
  for (const band of THREAD_BANDS) {
    const { d, pieces } = threadLine(
      band.id,
      authoredMeasuredSections(band.id),
    );
    const total = splitSubpaths(d).length;
    assert.equal(pieces.length, total, `${band.id}: one subpath per piece`);
    let next = 0;
    for (const id of THREAD_IDS) {
      const { start, end } = subpathRange(band.id, id);
      assert.equal(start, next, `${band.id}/${id} starts where the last ended`);
      assert.ok(end > start, `${band.id}/${id} owns at least one subpath`);
      next = end;
    }
    assert.equal(
      next,
      total,
      `${band.id}: the ranges cover all ${total} subpaths`,
    );
  }
});

/* Evaluates the three query shapes `aspectQuery` writes, so the bands' own media strings can be
   checked against sample aspects, the band edges themselves included. */
function matches(query: string, aspect: number): boolean {
  const below = query.match(/^\(aspect-ratio < ([\d.]+)\)$/);
  if (below) return aspect < Number(below[1]);
  const above = query.match(/^\(([\d.]+) <= aspect-ratio\)$/);
  if (above) return aspect >= Number(above[1]);
  const between = query.match(/^\(([\d.]+) <= aspect-ratio < ([\d.]+)\)$/);
  if (between)
    return aspect >= Number(between[1]) && aspect < Number(between[2]);
  throw new Error(`unrecognised query ${query}`);
}

test("the fallbacks' aspect queries match exactly one band at every aspect", () => {
  const queries = PAGE_FALLBACKS.map((fallback) => fallback.media);
  assert.equal(queries.length, THREAD_BANDS.length);
  const edges = queries.flatMap((query) =>
    [...query.matchAll(/[\d.]+/g)].map((m) => Number(m[0])),
  );
  const aspects = [0.2, 3, ...edges];
  for (let aspect = 0.3; aspect < 2.5; aspect += 0.01) aspects.push(aspect);
  for (const aspect of aspects) {
    const hits = queries.filter((query) => matches(query, aspect));
    assert.equal(
      hits.length,
      1,
      `aspect ${aspect} matches ${hits.length} bands`,
    );
  }
  assert.equal(aspectQuery(0, 1), "(aspect-ratio < 1)");
  assert.equal(aspectQuery(1, Number.POSITIVE_INFINITY), "(1 <= aspect-ratio)");
});

test("normalise is idempotent once its output is in the unit box", () => {
  const d = "M 10 20 C 30 40 50 60 70 80";
  const once = normalise(d, 100, 200);
  assert.equal(normalise(once, 1, 1), once);
});
