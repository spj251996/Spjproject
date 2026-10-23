import assert from "node:assert/strict";
import { test } from "node:test";
import { aspectQuery, THREAD_BANDS } from "./thread-bands.ts";
import { normalise, PAGE_FALLBACKS } from "./thread-fallback.ts";

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
