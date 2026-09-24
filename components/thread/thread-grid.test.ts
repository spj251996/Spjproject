import assert from "node:assert/strict";
import { test } from "node:test";
import { THREAD_BANDS } from "./thread-bands.ts";
import {
  motifAngle,
  routePoints,
  THREAD_IDS,
  THREAD_ROUTES,
} from "./thread-grid.ts";

/* THREAD_IDS is imported, never restated here: a second copy of the page order would drift from the
   first, and the handoff law below is exactly what a drifted order breaks silently. */

test("the page order is the six sections, invite to wishes", () => {
  assert.deepEqual(THREAD_IDS, [
    "invite",
    "event-info",
    "contact",
    "family",
    "celebrations",
    "wishes",
  ]);
});

test("every band is reachable and no two overlap", () => {
  for (const band of THREAD_BANDS) {
    assert.ok(band.max > band.min, `${band.id} is an empty range`);
  }
  for (const a of THREAD_BANDS) {
    for (const b of THREAD_BANDS) {
      if (a.id === b.id) continue;
      const overlaps = a.min < b.max && b.min < a.max;
      assert.equal(
        overlaps,
        false,
        `${a.id} and ${b.id} both match some aspect`,
      );
    }
  }
});

/* The handoff law: a section's exit column IS the next section's entry column. A mismatch makes the
   thread visibly jump at a section boundary, so it is enforced rather than watched for. */
test("every section's exit column equals the next section's entry column", () => {
  for (const band of THREAD_BANDS) {
    const routes = THREAD_IDS.map((id) => {
      const route = THREAD_ROUTES.find(
        (r) => r.id === id && r.band === band.id,
      );
      assert.ok(route, `${id} has no route in band ${band.id}`);
      return route;
    });
    for (let i = 0; i < routes.length - 1; i += 1) {
      const here = routes[i];
      const next = routes[i + 1];
      const exit = here.stops[here.stops.length - 1];
      const entry = next.stops[0];
      assert.equal(
        exit.col,
        entry.col,
        `${here.id} exits at column ${exit.col} but ${next.id} enters at ${entry.col} in band ${band.id}`,
      );
    }
  }
});

test("every route's stops are inside its own grid", () => {
  for (const route of THREAD_ROUTES) {
    for (const stop of route.stops) {
      assert.ok(
        stop.col >= 0 && stop.col < route.cols,
        `${route.id}/${route.band}: column ${stop.col} is outside 0..${route.cols - 1}`,
      );
      assert.ok(
        stop.row >= 0 && stop.row < route.rows,
        `${route.id}/${route.band}: row ${stop.row} is outside 0..${route.rows - 1}`,
      );
    }
  }
});

test("a motif's angle follows the route and its nudge adds to it", () => {
  const route = THREAD_ROUTES.find((r) =>
    r.stops.some((s) => s.motif !== undefined),
  );
  assert.ok(route, "no route places a motif");
  const index = route.stops.findIndex((s) => s.motif !== undefined);
  const nudged = {
    ...route,
    stops: route.stops.map((s, i) => (i === index ? { ...s, nudge: 15 } : s)),
  };
  assert.equal(
    Math.round(motifAngle(nudged, index) - motifAngle(route, index)),
    15,
  );
});

test("route points are fractions of the section, never pixels", () => {
  for (const route of THREAD_ROUTES) {
    for (const point of routePoints(route)) {
      assert.ok(
        point.x >= 0 && point.x <= 1,
        `${route.id}: x ${point.x} is not a fraction`,
      );
      assert.ok(
        point.y >= 0 && point.y <= 1,
        `${route.id}: y ${point.y} is not a fraction`,
      );
    }
  }
});
