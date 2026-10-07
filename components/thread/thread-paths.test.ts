import assert from "node:assert/strict";
import { test } from "node:test";
import type { BandId } from "./thread-bands.ts";
import { THREAD_BANDS } from "./thread-bands.ts";
import type { MotifId, ThreadId } from "./thread-geometry.ts";
import { MOTIF_PLACEMENTS, THREAD_PATHS } from "./thread-paths.ts";

/* The page order, restated here rather than imported: `THREAD_IDS` lived in the grid this file
   replaces, and this table is what a fresh reader needs to know which section owns how many
   motifs — the shape every other assertion below checks against. */
const SECTION_MOTIF_COUNT: Record<Exclude<ThreadId, "not-found">, number> = {
  invite: 1,
  "event-info": 2,
  contact: 1,
  family: 2,
  celebrations: 1,
  wishes: 1,
};

const SECTION_IDS = Object.keys(SECTION_MOTIF_COUNT) as Exclude<
  ThreadId,
  "not-found"
>[];

function numbers(d: string): number[] {
  return [...d.matchAll(/-?\d+(?:\.\d+)?(?:e-?\d+)?/g)].map((m) =>
    Number(m[0]),
  );
}

test("every band declares every section, and no section declares 'not-found'", () => {
  for (const band of THREAD_BANDS) {
    const paths = THREAD_PATHS[band.id];
    const placements = MOTIF_PLACEMENTS[band.id];
    assert.deepEqual(Object.keys(paths).sort(), [...SECTION_IDS].sort());
    assert.deepEqual(Object.keys(placements).sort(), [...SECTION_IDS].sort());
    assert.equal(
      "not-found" in paths,
      false,
      `${band.id} must not declare not-found — it resolves to invite by construction`,
    );
  }
});

test("a section's connector count is exactly its motif count plus one", () => {
  for (const band of THREAD_BANDS) {
    for (const id of SECTION_IDS) {
      const connectors = THREAD_PATHS[band.id][id];
      const placements = MOTIF_PLACEMENTS[band.id][id];
      assert.equal(
        placements.length,
        SECTION_MOTIF_COUNT[id],
        `${band.id}/${id} motif count`,
      );
      assert.equal(
        connectors.length,
        SECTION_MOTIF_COUNT[id] + 1,
        `${band.id}/${id} connector count`,
      );
    }
  }
});

test("every connector's d starts with an absolute moveto and parses to finite numbers", () => {
  for (const band of THREAD_BANDS) {
    for (const id of SECTION_IDS) {
      for (const { d } of THREAD_PATHS[band.id][id]) {
        assert.match(d, /^M\s/, `${band.id}/${id}: ${d.slice(0, 20)}`);
        const values = numbers(d);
        assert.ok(values.length > 0, `${band.id}/${id} has no numbers`);
        assert.ok(
          values.every((n) => Number.isFinite(n)),
          `${band.id}/${id} has a non-finite number`,
        );
        assert.equal(d.includes("NaN"), false, `${band.id}/${id}`);
      }
    }
  }
});

test("every placement names a real motif and carries finite geometry", () => {
  const knownMotifs = new Set<MotifId>([
    "heart",
    "rings",
    "knot",
    "phone",
    "portraitLoop",
    "wishesLoop",
    "bow",
  ]);
  for (const band of THREAD_BANDS) {
    for (const id of SECTION_IDS) {
      for (const placement of MOTIF_PLACEMENTS[band.id][id]) {
        assert.ok(
          knownMotifs.has(placement.motif),
          `${band.id}/${id}: unknown motif`,
        );
        for (const key of ["x", "y", "scale", "turn"] as const) {
          assert.ok(
            Number.isFinite(placement[key]),
            `${band.id}/${id}/${placement.motif}: ${key} is not finite`,
          );
        }
        assert.ok(
          placement.scale > 0,
          `${band.id}/${id}/${placement.motif}: scale must be positive`,
        );
      }
    }
  }
});

/* Owner decision, in chat: the reflection that negates portraitLoop's internal turn is wanted in
   `wide` and `tall`, where the drawn line turns the opposite sign from the motif's own authored
   turn; `upright`'s two loops wind opposite ways, so mirroring one would only fix the other, and
   that choice is not this task's to make. */
test("portraitLoop is mirrored in wide and tall, and not in upright", () => {
  for (const band of THREAD_BANDS) {
    const placements = [
      ...MOTIF_PLACEMENTS[band.id].family,
      ...(MOTIF_PLACEMENTS[band.id].celebrations ?? []),
    ].filter((p) => p.motif === "portraitLoop");
    assert.ok(
      placements.length > 0,
      `${band.id} has no portraitLoop placement`,
    );
    for (const placement of placements) {
      if (band.id === "upright") {
        assert.equal(
          placement.mirror,
          undefined,
          `upright's portraitLoop must not carry mirror`,
        );
      } else {
        assert.equal(
          placement.mirror,
          true,
          `${band.id}'s portraitLoop must carry mirror: true`,
        );
      }
    }
  }
});

/* No other motif is mirrored — the reflection is a fitted correction for portraitLoop's two winding
   directions specifically, not a general-purpose flag any placement happens to carry. */
test("no motif other than portraitLoop carries mirror", () => {
  for (const band of THREAD_BANDS) {
    for (const id of SECTION_IDS) {
      for (const placement of MOTIF_PLACEMENTS[band.id][id]) {
        if (placement.motif === "portraitLoop") continue;
        assert.equal(
          placement.mirror,
          undefined,
          `${band.id}/${id}/${placement.motif} must not carry mirror`,
        );
      }
    }
  }
});

/* ---- the handoff, restated as a geometric fact rather than a grid-cell one -------------------

   The retired `thread-grid.test.ts` asserted that a section's exit column equalled the next
   section's entry column, because two independently-authored routes needed a rule to make them
   agree. There is no such rule now: the owner draws one continuous stroke down the whole page, and
   a section boundary is just where that ONE drawn curve gets cut in two. So the property worth
   guarding is no longer "the authored cells match" — it is "the two cut halves still read as one
   line where they meet": the same x, and the same direction of travel, on both sides of the cut. */

/** Every number in a `d` string, in order: `M x y (C c1x c1y c2x c2y x y)*`. */
function numbersIn(d: string): number[] {
  return [...d.matchAll(/-?\d+(?:\.\d+)?(?:e-?\d+)?/g)].map((m) =>
    Number(m[0]),
  );
}

/** Flattens a `splinePath` output into a dense polyline, for measuring direction of travel. */
function flatten(d: string): { x: number; y: number }[] {
  const n = numbersIn(d);
  const points: { x: number; y: number }[] = [{ x: n[0], y: n[1] }];
  for (let i = 2; i + 5 < n.length + 1; i += 6) {
    const p0 = points[points.length - 1];
    const c1 = { x: n[i], y: n[i + 1] };
    const c2 = { x: n[i + 2], y: n[i + 3] };
    const p1 = { x: n[i + 4], y: n[i + 5] };
    for (let k = 1; k <= 60; k += 1) {
      const t = k / 60;
      const u = 1 - t;
      points.push({
        x:
          u ** 3 * p0.x +
          3 * u * u * t * c1.x +
          3 * u * t * t * c2.x +
          t ** 3 * p1.x,
        y:
          u ** 3 * p0.y +
          3 * u * u * t * c1.y +
          3 * u * t * t * c2.y +
          t ** 3 * p1.y,
      });
    }
  }
  return points;
}

/* Direction of travel over a fixed arc length from a polyline's own end — never the last segment
   alone, which can be a few pixels of curve noise this close to a join.

   10px, not the 20-45px this project's drawn-thread tooling samples a MOTIF join over. That reach
   assumes both sides are free to carry a generous, evenly-spaced arm; a few of these 15 boundaries
   sit right after a genuinely short polyline span (one measured 1.37px), and `splinePath`'s own
   arm-length rule (`thread-spline.ts`, a THIRD of a span's own length at most) then holds a forced
   direction only a few px before the curve resumes bending toward its own next point — a property
   of point spacing, not of which direction was forced. Measured empirically: at reach 10 the WORST
   of these 15 boundaries is 6.8 degrees once the boundary is left unforced (see the test below);
   at reach 20 it is 19.9. A smaller reach stays inside more boundaries' own short arms. */
const REACH = 10;
/* 10, not the 1 degree a perfectly continuous join would read as measured AT the exact point
   (confirmed separately, by reading each side's own control-point tangent directly: under this
   fix the worst of the 15 is 0.09 degrees). Widened here to absorb the arm-length noise above
   without losing the separation that matters: forcing `TERMINAL_TANGENT` measured 13-80 degrees
   off at this SAME reach on at least one boundary in every band, comfortably outside this floor. */
const TOLERANCE = 10;

function headingAt(
  points: { x: number; y: number }[],
  which: "from" | "to",
): number {
  const anchor = which === "from" ? points[0] : points[points.length - 1];
  const order = which === "from" ? points : [...points].reverse();
  let acc = 0;
  let prev = order[0];
  for (const p of order) {
    acc += Math.hypot(p.x - prev.x, p.y - prev.y);
    prev = p;
    if (acc >= REACH) break;
  }
  return which === "from"
    ? (Math.atan2(prev.y - anchor.y, prev.x - anchor.x) * 180) / Math.PI
    : (Math.atan2(anchor.y - prev.y, anchor.x - prev.x) * 180) / Math.PI;
}

function angleDiff(a: number, b: number): number {
  return Math.abs(((a - b + 540) % 360) - 180);
}

const SECTION_ORDER: Exclude<ThreadId, "not-found">[] = [
  "invite",
  "event-info",
  "contact",
  "family",
  "celebrations",
  "wishes",
];

test("every section boundary reads as one line: same x and same heading on both sides", () => {
  for (const band of THREAD_BANDS) {
    for (let i = 0; i < SECTION_ORDER.length - 1; i += 1) {
      const upper = THREAD_PATHS[band.id][SECTION_ORDER[i]].at(-1);
      const lower = THREAD_PATHS[band.id][SECTION_ORDER[i + 1]][0];
      assert.ok(
        upper && lower,
        `${band.id}: ${SECTION_ORDER[i]}/${SECTION_ORDER[i + 1]} missing`,
      );

      const upperPoints = flatten(upper.d);
      const lowerPoints = flatten(lower.d);
      const upperEnd = upperPoints[upperPoints.length - 1];
      const lowerStart = lowerPoints[0];

      assert.ok(
        Math.abs(upperEnd.x - lowerStart.x) <= 0.5,
        `${band.id}: ${SECTION_ORDER[i]}/${SECTION_ORDER[i + 1]} x mismatch ` +
          `${upperEnd.x.toFixed(2)} vs ${lowerStart.x.toFixed(2)}`,
      );

      const upperHeading = headingAt(upperPoints, "to");
      const lowerHeading = headingAt(lowerPoints, "from");
      assert.ok(
        angleDiff(upperHeading, lowerHeading) <= TOLERANCE,
        `${band.id}: ${SECTION_ORDER[i]}/${SECTION_ORDER[i + 1]} heading mismatch ` +
          `${upperHeading.toFixed(1)} vs ${lowerHeading.toFixed(1)} ` +
          `(${angleDiff(upperHeading, lowerHeading).toFixed(1)} deg off)`,
      );
    }
  }
});

/* The reach-sampled test above absorbs `splinePath`'s own arm-length asymmetry (see `TOLERANCE`'s
   comment); this one checks the mathematically exact property the fix actually guarantees — the
   INSTANTANEOUS derivative at the shared point, read directly off each side's own control points,
   with no sampling to blur it. A join built by fitting the whole crossing stroke once and slicing
   it (rather than fitting each half separately toward an agreed convention) puts this at a
   fraction of a degree; forcing an unrelated convention like `TERMINAL_TANGENT` would not — both
   sides would still agree with EACH OTHER (they were forced to the same value), which is exactly
   why the reach-sampled test above, not this one, is what catches that class of defect. */
function exactTangent(d: string, which: "start" | "end"): number {
  const n = numbersIn(d);
  const last = n.length - 1;
  return which === "start"
    ? (Math.atan2(n[3] - n[1], n[2] - n[0]) * 180) / Math.PI
    : (Math.atan2(n[last] - n[last - 2], n[last - 1] - n[last - 3]) * 180) /
        Math.PI;
}

test("the exact tangent at a boundary is continuous to a fraction of a degree", () => {
  for (const band of THREAD_BANDS) {
    for (let i = 0; i < SECTION_ORDER.length - 1; i += 1) {
      const connectors = THREAD_PATHS[band.id][SECTION_ORDER[i]];
      const upper = connectors[connectors.length - 1];
      const lower = THREAD_PATHS[band.id][SECTION_ORDER[i + 1]][0];
      const diff = angleDiff(
        exactTangent(upper.d, "end"),
        exactTangent(lower.d, "start"),
      );
      assert.ok(
        diff <= 0.5,
        `${band.id}: ${SECTION_ORDER[i]}/${SECTION_ORDER[i + 1]} exact tangent off by ${diff.toFixed(3)} deg`,
      );
    }
  }
});

/* ---- scale is an INPUT to the fit, never an output of it -------------------------------------

   The owner tuned `scale` on a render (`.claude/work/thread-wide-placements.md`'s confirmed
   routes) and nothing in the fit is entitled to move it. An earlier version of the generator
   derived a motif's field size from the drawn ends' own separation instead — the drawn ends sit
   4-30px off the authored attachment points, which is fine for fitting TURN and CENTRE but wrong
   for recovering a size that was never carried by that separation, and it silently rescaled every
   motif by a different factor (heart 1.13x, rings 1.57x, bow 0.40x…), which is why
   `check:thread-joins` then reported the thread in pieces almost everywhere. This is the authored
   table itself, duplicated from the source doc rather than imported from it, because
   `thread-wide-placements.md` is prose the generator reads by eye, not a module either file can
   share. */
const AUTHORED_SCALE: Record<BandId, Partial<Record<MotifId, number>>> = {
  tall: { heart: 0.2, rings: 0.25, knot: 0.25, phone: 0.2, portraitLoop: 0.35 },
  wide: { heart: 0.3, rings: 0.28, knot: 0.2, phone: 0.17, portraitLoop: 0.2 },
  upright: {
    heart: 0.2,
    rings: 0.25,
    knot: 0.25,
    phone: 0.2,
    portraitLoop: 0.25,
    wishesLoop: 0.2,
  },
};
/* Every cell the table above leaves out — `wishesLoop` and `bow` in every band except
   `upright`/`wishesLoop` — carries no `scale` in the source and takes this default. */
const DEFAULT_SCALE = 0.3;

test("every placement's scale is the owner's authored value, never derived from the drawn geometry", () => {
  for (const band of THREAD_BANDS) {
    for (const id of SECTION_IDS) {
      for (const placement of MOTIF_PLACEMENTS[band.id][id]) {
        const authored =
          AUTHORED_SCALE[band.id][placement.motif] ?? DEFAULT_SCALE;
        assert.equal(
          placement.scale,
          authored,
          `${band.id}/${id}/${placement.motif}: scale ${placement.scale} does not match the ` +
            `authored ${authored}`,
        );
      }
    }
  }
});

/* `wide`'s authored source is GONE — `tmp/thread-draw/wide/` is empty and `tmp/` is gitignored, so
   nothing recovers it. This file is the ONLY surviving record of those routes, and the generator
   writes all three bands in one pass, so a plain run would emit nothing for `wide` and
   `output: "export"` would ship a desktop page with no thread at all. Any regeneration must MERGE,
   carrying a band with no source through unchanged.

   This pins the shape rather than the content, which is what makes it survive the coming full redraw:
   the routes will change, but no band may ever go empty. */
test("every band has a route for every section", () => {
  for (const band of THREAD_BANDS) {
    for (const id of SECTION_ORDER) {
      const routes = THREAD_PATHS[band.id]?.[id];
      assert.ok(
        Array.isArray(routes) && routes.length > 0,
        `${band.id}/${id} has no route — a wholesale regeneration may have dropped a band`,
      );
      for (const route of routes) {
        assert.ok(
          typeof route.d === "string" && route.d.startsWith("M "),
          `${band.id}/${id} has a malformed d`,
        );
      }
    }
  }
});
