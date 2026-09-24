import assert from "node:assert/strict";
import { test } from "node:test";
import { THREAD_BANDS } from "./thread-bands.ts";
import type { GridStop, SectionRoute } from "./thread-grid.ts";
import {
  motifAngle,
  routePoints,
  THREAD_IDS,
  THREAD_ROUTES,
} from "./thread-grid.ts";
import { splineDirection } from "./thread-spline.ts";

/* Offsets are tuned by the owner on the panel and no authored route carries one, so every offset
   under test is the test's own — on a route this file builds, never on a shipping one. */
function probeRoute(stops: readonly GridStop[], grid = 4): SectionRoute {
  return { id: "invite", band: "tall", cols: grid, rows: grid, stops };
}

/* A cell centre is a division and an offset is added to it, so the exact sum is a binary-float
   accident of the two — 0.375 + 0.1 is exact, 0.475 - 0.375 is not. The claim is the distance, not
   the last bit of it. */
function near(actual: number, expected: number, message?: string): void {
  assert.ok(
    Math.abs(actual - expected) < 1e-12,
    message ?? `${actual} is not ${expected}`,
  );
}

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
      /* The authored column is the law, but it is not what paints: the terminal inherits the
         RESOLVED x, offset included, so two matching columns with different offsets still jump.
         Asserted on the fraction as well as the column, because the offset is the newer way to
         break this and the column check cannot see it. */
      const exitX = routePoints(here)[here.stops.length - 1].x;
      const entryX = routePoints(next)[0].x;
      assert.equal(
        exitX,
        entryX,
        `${here.id} exits at x ${exitX} but ${next.id} enters at ${entryX} in band ${band.id}`,
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

/* ---- per-stop offsets ------------------------------------------------------------------------ */

test("a stop's offset moves its point by exactly that fraction of the section", () => {
  const route = probeRoute([{ col: 1, row: 2, offsetX: 0.1, offsetY: -0.2 }]);
  const [point] = routePoints(route);
  /* 4 x 4, so the cell centres are 0.375 and 0.625 — stated as the literals they are, because a
     test that recomputes the formula it is checking asserts only that the formula equals itself. */
  near(point.x, 0.475);
  near(point.y, 0.425);
});

test("each axis takes its own offset and neither reads the other's", () => {
  const base = probeRoute([{ col: 1, row: 2 }]);
  const onlyX = probeRoute([{ col: 1, row: 2, offsetX: 0.1 }]);
  const onlyY = probeRoute([{ col: 1, row: 2, offsetY: 0.1 }]);
  near(routePoints(onlyX)[0].x - routePoints(base)[0].x, 0.1);
  assert.equal(routePoints(onlyX)[0].y, routePoints(base)[0].y);
  near(routePoints(onlyY)[0].y - routePoints(base)[0].y, 0.1);
  assert.equal(routePoints(onlyY)[0].x, routePoints(base)[0].x);
});

/* An offset is measured against the SECTION, not the cell, so it keeps its absolute size when the
   panel changes granularity: the cell the stop sits in moves, the offset does not. */
test("an offset means the same distance at every granularity", () => {
  const coarse = routePoints(probeRoute([{ col: 1, row: 1, offsetX: 0.1 }], 4));
  const fine = routePoints(probeRoute([{ col: 2, row: 2, offsetX: 0.1 }], 8));
  near(coarse[0].x - (1 + 0.5) / 4, 0.1);
  near(fine[0].x - (2 + 0.5) / 8, 0.1);
});

/* The decision behind the fractions test above: an offset may NOT carry a point out of its own
   section. A point outside it has no cell, hands nothing to the next section's terminal and paints
   where the thread cannot be seen, so the offset stops at the edge. */
test("an offset clamps at the section's edge rather than leaving it", () => {
  const off = routePoints(
    probeRoute([
      { col: 0, row: 3, offsetX: -0.9, offsetY: 0.9 },
      { col: 3, row: 0, offsetX: 4, offsetY: -4 },
    ]),
  );
  assert.deepEqual(off, [
    { x: 0, y: 1 },
    { x: 1, y: 0 },
  ]);
});

test("every route's points stay fractions under any offset", () => {
  for (const route of THREAD_ROUTES) {
    for (const offset of [-5, -0.4, 0.4, 5]) {
      const shifted = {
        ...route,
        stops: route.stops.map((stop) => ({
          ...stop,
          offsetX: offset,
          offsetY: -offset,
        })),
      };
      for (const point of routePoints(shifted)) {
        assert.ok(
          point.x >= 0 && point.x <= 1,
          `${route.id}: x ${point.x} left the section at offset ${offset}`,
        );
        assert.ok(
          point.y >= 0 && point.y <= 1,
          `${route.id}: y ${point.y} left the section at offset ${offset}`,
        );
      }
    }
  }
});

/* Offsets are optional and the shipping table sets none — every number here is the owner's, tuned
   on the panel. Asserted rather than assumed, because it is what holds the emitted geometry
   identical to the pre-offset thread. */
test("no authored route sets an offset, and an unset offset moves nothing", () => {
  for (const route of THREAD_ROUTES) {
    const points = routePoints(route);
    route.stops.forEach((stop, at) => {
      assert.equal(stop.offsetX, undefined, `${route.id}/${route.band}`);
      assert.equal(stop.offsetY, undefined, `${route.id}/${route.band}`);
      assert.equal(points[at].x, (stop.col + 0.5) / route.cols);
      assert.equal(points[at].y, (stop.row + 0.5) / route.rows);
    });
  }
});

/* `motifAngle` is the spline's direction of travel plus the stop's `nudge`, and the spline is drawn
   through the OFFSET points — so moving a neighbouring stop sideways re-aims the motif, which is
   the whole reason the offset is a geometry change rather than a paint one. */
test("a motif's angle follows the offset points, and nudge still adds to it", () => {
  const straight = probeRoute([
    { col: 1, row: 0 },
    { col: 1, row: 1, motif: "heart" },
    { col: 1, row: 2 },
  ]);
  const bent = {
    ...straight,
    stops: straight.stops.map((stop, at) =>
      at === 2 ? { ...stop, offsetX: 0.25 } : stop,
    ),
  };
  assert.notEqual(motifAngle(bent, 1), motifAngle(straight, 1));
  assert.equal(motifAngle(bent, 1), splineDirection(routePoints(bent), 1));

  const nudged = {
    ...bent,
    stops: bent.stops.map((stop, at) =>
      at === 1 ? { ...stop, nudge: 15 } : stop,
    ),
  };
  assert.equal(motifAngle(nudged, 1) - motifAngle(bent, 1), 15);
});

/* Exactly three motifs wrap specific content — Flemy's portrait, Sebastian's, and the couple
   illustration — and a few percent off on those reads as a mistake rather than a placement. Every
   other motif sits on its cell, which is what naming the whole set here holds. */
test("exactly three stops anchor, and each names an element", () => {
  const anchored = THREAD_ROUTES.flatMap((r) =>
    r.stops
      .filter((s) => s.anchor !== undefined)
      .map((s) => `${r.id}/${s.anchor}`),
  );
  const distinct = new Set(anchored.map((a) => a.split("/")[1]));
  assert.deepEqual([...distinct].sort(), [
    "[data-portrait='flemy']",
    "[data-portrait='sebastian']",
    "[data-wishes-figure]",
  ]);
});

/* The grid cell is the fallback, so a motif whose anchor never resolves is slightly off, never
   missing. A stop that anchors without a cell has nothing to fall back to. */
test("every anchored stop still declares its own cell", () => {
  for (const route of THREAD_ROUTES) {
    for (const stop of route.stops) {
      if (stop.anchor === undefined) continue;
      assert.equal(typeof stop.col, "number");
      assert.equal(typeof stop.row, "number");
    }
  }
});

/* An anchor must not vary by band. A section's route is the same stops in every band, so an anchor
   missing from one is a motif that follows its content on two devices and drifts on the third —
   which the set assertion above cannot see, because the other bands still name the selector. */
test("every band anchors the same stops", () => {
  for (const id of THREAD_IDS) {
    const perBand = THREAD_BANDS.map((band) => {
      const route = THREAD_ROUTES.find(
        (r) => r.id === id && r.band === band.id,
      );
      assert.ok(route, `${id} has no route in band ${band.id}`);
      return route.stops.map((stop) => stop.anchor ?? null);
    });
    for (const anchors of perBand) {
      assert.deepEqual(
        anchors,
        perBand[0],
        `${id} does not anchor the same stops in every band`,
      );
    }
  }
});

/* `not-found` draws the invite's thread, not a copy of it. A second table would drift from the
   first — the generator resolves the id instead, which keeps the two identical by construction. */
test("not-found renders invite's own route, not a copy of it", () => {
  const invite = THREAD_ROUTES.filter((r) => r.id === "invite");
  const notFound = THREAD_ROUTES.filter((r) => r.id === "not-found");
  assert.equal(notFound.length, 0, "not-found must not declare its own stops");
  assert.ok(invite.length > 0);
});
