#!/usr/bin/env node
/* The centreline tracer (Phase 5b): an outline SVG in, one continuous open `d` out.
 *
 * WHY THIS EXISTS. The owner's motif references are Pinterest rasters run through an online
 * tracer (picsvg.com), and every such tracer emits an OUTLINE — `fill="#000000" stroke="none"`,
 * one closed contour drawn AROUND the stroke. The thread is a stroke the scrub travels along, so
 * it needs the line down the middle of that contour, as a single open path. Filling the outline
 * and re-stroking it is not the same drawing: the contour doubles back on itself, so a scrub run
 * along it would draw the shape twice, out and back.
 *
 * FIVE STAGES, each exported so none is a black box and each can be falsified on its own:
 *   1. `rasterise` — sharp renders the SVG at a stated width, flattened onto white and thresholded
 *      to a binary field. Feeding PNG rather than JPEG upstream matters here: JPEG ringing around
 *      a hairline puts wobble into the contour that survives every later stage.
 *   2. `thin` — Zhang-Suen to a one-pixel skeleton, capped at THINNING_PASSES and throwing when
 *      the cap is reached. An unbounded convergence loop is what this project's rules forbid.
 *   3. `pruneSpurs` — thinning always sprouts short branches at a stroke's blunt ends. A branch is
 *      a spur only when it is terminal at one end and meets a junction at the other, so a drawing
 *      that is one open curve with no junctions can never have its whole self pruned away.
 *   4. `walk` — orders the skeleton into one polyline, choosing at each junction the branch that
 *      best CONTINUES the incoming direction, then splicing every circuit that rule leaves behind
 *      back in at a junction the trail already crosses. `knot` and `rings` cross themselves; a walk
 *      that turns at a crossing emits one rope as two loops meeting, which is the wrong drawing and
 *      not a wrong-looking one.
 *   5. `fitPath` — resamples by arc length, converts a Catmull-Rom spline to cubics, and scales
 *      the ink uniformly into a 0-100 square, matching `thread-motifs.ts`'s format. Two things
 *      that format does NOT pin, so a retrace will differ from a hand-authored record by them:
 *      the ink is centred on its shorter axis (the authored records are not — `heart`'s ink
 *      centres at y 44.8), and a Catmull-Rom control point may sit a hundredth of a unit outside
 *      the 0-100 box, which holds for the anchors rather than for the curve.
 *
 * COVERAGE, and why it is printed. A skeleton whose loose ends number more than two cannot be one
 * open path at all, so part of it is necessarily left undrawn and the emitted `d` is a FRAGMENT
 * whose aspect is that fragment's. The run reports how much of the skeleton it walked so a partial
 * trace cannot be read as a measurement of the motif, and the aspect is labelled as the fragment's
 * whenever it is one.
 *
 * CAPS: every loop here states its maximum. Thinning 100 passes, spur pruning 20 rounds, and
 * every skeleton traversal is bounded by the pixel count it walks.
 *
 * USAGE:
 *   npm run trace:motif -- "tmp/aaa/thread paths/heart.svg"
 *   npm run trace:motif -- <file.svg> --width=1600 --spur=0.06 --segments=64 --bridge=5
 */

import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import process from "node:process";
import sharp from "sharp";

/* Wide enough that a hairline in the source survives thresholding as several pixels, which is what
   Zhang-Suen needs to thin to a stable midline rather than a dotted one. */
const RASTER_WIDTH = 1200;
const INK_THRESHOLD = 128;
const THINNING_PASSES = 100;
const PRUNE_ROUNDS = 20;
const SPUR_FRACTION = 0.04;
const SEGMENTS = 48;
/* A junction's outgoing directions are measured over this many pixels, not over the first one: a
   single 8-connected step quantises to 45 degrees, which cannot tell two arms of an X apart. */
const LOOKAHEAD = 8;
/* In stroke widths: how far apart the two halves of a thinned crossing may sit and still be read as
   one crossing. Measured on the five sources, the artifact stubs run 3-17px against strokes of
   3-18px, and the shortest REAL stroke between two crossings is 82px against a 7.9px stroke — so 2
   covers a clean crossing with headroom. A drawing whose crossings are TIGHT needs more, because
   two strokes meeting at a shallow angle thin into a longer shared stub: `final knot`'s bow loops
   need 5, which raises its coverage from 33% to 94%. `--bridge` is that number, and the run prints
   the coverage it bought, so raising it is never a silent change to the drawing. */
const BRIDGE_STROKES = 2;

const NEIGHBOURS = [
  [0, -1],
  [1, -1],
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
];

/** Render the SVG at `width` and threshold it to a binary ink field (1 = ink). */
export async function rasterise(
  svg,
  { width = RASTER_WIDTH, threshold = INK_THRESHOLD } = {},
) {
  const source = Buffer.isBuffer(svg) ? svg : Buffer.from(svg);
  const { data, info } = await sharp(source)
    .resize({ width })
    .flatten({ background: "#ffffff" })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const ink = new Uint8Array(info.width * info.height);
  for (let i = 0; i < ink.length; i += 1)
    ink[i] = data[i * info.channels] < threshold ? 1 : 0;
  return { ink, width: info.width, height: info.height };
}

function transitions(n) {
  let count = 0;
  for (let i = 0; i < 8; i += 1)
    if (n[i] === 0 && n[(i + 1) % 8] === 1) count += 1;
  return count;
}

/** Zhang-Suen thinning to a one-pixel skeleton. Throws if it has not converged in THINNING_PASSES. */
export function thin(field, { passes = THINNING_PASSES } = {}) {
  const { width, height } = field;
  const ink = Uint8Array.from(field.ink);
  const doomed = [];
  const n = new Uint8Array(8);

  for (let pass = 0; pass < passes; pass += 1) {
    let changed = false;
    for (const half of [0, 1]) {
      doomed.length = 0;
      for (let y = 1; y < height - 1; y += 1) {
        for (let x = 1; x < width - 1; x += 1) {
          const at = y * width + x;
          if (ink[at] === 0) continue;
          let filled = 0;
          for (let i = 0; i < 8; i += 1) {
            const [dx, dy] = NEIGHBOURS[i];
            n[i] = ink[(y + dy) * width + (x + dx)];
            filled += n[i];
          }
          if (filled < 2 || filled > 6) continue;
          if (transitions(n) !== 1) continue;
          /* n is ordered N, NE, E, SE, S, SW, W, NW — the two halves erode opposite corners, which
             is what keeps the surviving skeleton on the medial line rather than shaved to one side. */
          const [north, east, south, west] = [n[0], n[2], n[4], n[6]];
          if (half === 0) {
            if (north * east * south !== 0 || east * south * west !== 0)
              continue;
          } else {
            if (north * east * west !== 0 || north * south * west !== 0)
              continue;
          }
          doomed.push(at);
        }
      }
      for (const at of doomed) ink[at] = 0;
      if (doomed.length > 0) changed = true;
    }
    if (!changed) return { ink, width, height };
  }
  throw new Error(`thinning did not converge in ${passes} passes`);
}

/**
 * The skeleton's graph neighbours. A diagonal neighbour is dropped when the two pixels already
 * share an ink orthogonal neighbour, because the connection it would add is one the staircase
 * already carries. Without this every step of a 1px diagonal counts three or four neighbours and
 * reads as a junction: `heart` measured 393 of them where the drawing has two crossings.
 */
export function neighboursOf(field, at) {
  const { ink, width, height } = field;
  const x = at % width;
  const y = (at - x) / width;
  const inside = (nx, ny) => nx >= 0 && ny >= 0 && nx < width && ny < height;
  const inkAt = (nx, ny) =>
    inside(nx, ny) && ink[ny * width + nx] === 1 ? 1 : 0;

  const found = [];
  for (const [dx, dy] of NEIGHBOURS) {
    const nx = x + dx;
    const ny = y + dy;
    if (!inside(nx, ny) || ink[ny * width + nx] !== 1) continue;
    if (
      dx !== 0 &&
      dy !== 0 &&
      (inkAt(x + dx, y) === 1 || inkAt(x, y + dy) === 1)
    )
      continue;
    found.push(ny * width + nx);
  }
  return found;
}

/**
 * Decompose a skeleton into branches running between junctions, where a junction is the whole
 * CLUSTER of touching non-degree-2 pixels and not one pixel of it. A clean crossing thins to a 2x2
 * block of T-junctions; reading each of those as a junction in its own right puts one-pixel
 * branches between them, and a direction measured over one pixel cannot tell an X's arms apart —
 * the walk then turns at exactly the crossing it exists to pass through.
 */
function branchesOf(field, bridge = 0) {
  const { ink } = field;
  const degree = new Map();
  for (let at = 0; at < ink.length; at += 1) {
    if (ink[at] === 1) degree.set(at, neighboursOf(field, at).length);
  }

  const nodePixels = [...degree.keys()].filter((at) => degree.get(at) !== 2);
  const clusterOf = new Map();
  for (const seed of nodePixels) {
    if (clusterOf.has(seed)) continue;
    const id = clusterOf.size;
    const queue = [seed];
    clusterOf.set(seed, id);
    /* Bounded by the node-pixel count: the queue admits only node pixels, and only ones no cluster
       has claimed yet, so it can never grow past them. Exceeding it would mean that invariant had
       broken, and silently stopping there would split one junction into two. */
    for (let head = 0; head < queue.length; head += 1) {
      if (head >= nodePixels.length)
        throw new Error(
          `a junction cluster grew past ${nodePixels.length} node pixels`,
        );
      for (const next of neighboursOf(field, queue[head])) {
        if (degree.get(next) === 2 || clusterOf.has(next)) continue;
        clusterOf.set(next, id);
        queue.push(next);
      }
    }
  }

  const branches = [];
  const seen = new Set();
  const cap = degree.size + 1;
  for (const node of nodePixels) {
    for (const first of neighboursOf(field, node)) {
      if (clusterOf.get(first) === clusterOf.get(node)) continue;
      if (seen.has(`${node}:${first}`)) continue;
      const pixels = [node, first];
      let previous = node;
      let current = first;
      for (let step = 0; step < cap && !clusterOf.has(current); step += 1) {
        const next = neighboursOf(field, current).find((p) => p !== previous);
        if (next === undefined) break;
        pixels.push(next);
        previous = current;
        current = next;
      }
      seen.add(`${node}:${first}`);
      seen.add(`${current}:${pixels[pixels.length - 2]}`);
      /* Every degree-2 run ends on a non-degree-2 pixel, and every one of those is clustered — so
         falling out of the follow above means the skeleton's degrees and clusters disagree.
         Dropping the branch there would delete a real stroke from the drawing without a word. */
      if (!clusterOf.has(current))
        throw new Error(
          `a branch left a junction and reached no junction within ${cap} pixels`,
        );
      branches.push({
        from: clusterOf.get(node),
        to: clusterOf.get(current),
        pixels,
      });
    }
  }

  const clusters = new Map();
  for (const [at, id] of clusterOf) {
    if (!clusters.has(id)) clusters.set(id, { pixels: [], incident: 0 });
    clusters.get(id).pixels.push(at);
  }
  for (const branch of branches) {
    clusters.get(branch.from).incident += 1;
    clusters.get(branch.to).incident += 1;
  }
  return bridge > 0
    ? mergeBridges({ branches, clusters, clusterOf }, bridge)
    : { branches, clusters, clusterOf };
}

/**
 * Thinning rarely leaves a crossing as one cluster of touching pixels: an X of stroke width w comes
 * out as two T-nodes about w apart, joined by a stub of skeleton. Each T is then degree 3 — odd —
 * and a drawing whose crossings are all odd has no route that covers it, so the whole lobe beyond
 * one is unreachable however the walk chooses. Merging the two back into one crossing is what makes
 * the degrees even again; `bridge` is the longest stub that counts as one, in pixels.
 *
 * Only a stub between two junctions merges. A short branch reaching a loose end is a spur, which
 * `pruneSpurs` owns and judges on quite different grounds.
 */
function mergeBridges({ branches, clusters, clusterOf }, bridge) {
  const parent = new Map([...clusters.keys()].map((id) => [id, id]));
  const find = (id) => {
    /* Bounded by the cluster count: every hop moves strictly closer to a root. */
    for (let hop = 0; hop <= clusters.size; hop += 1) {
      if (parent.get(id) === id) return id;
      id = parent.get(id);
    }
    throw new Error("a junction merge left a cycle in its union-find");
  };

  const merged = new Set();
  for (const branch of branches) {
    if (branch.pixels.length > bridge) continue;
    if (clusters.get(branch.from).incident < 3) continue;
    if (clusters.get(branch.to).incident < 3) continue;
    const from = find(branch.from);
    const to = find(branch.to);
    merged.add(branch);
    if (from !== to) parent.set(to, from);
  }
  if (merged.size === 0) return { branches, clusters, clusterOf };

  const grown = new Map();
  const at = (id) => {
    const root = find(id);
    if (!grown.has(root)) grown.set(root, { pixels: [], incident: 0 });
    return grown.get(root);
  };
  const owner = new Map();
  for (const [pixel, id] of clusterOf) {
    at(id).pixels.push(pixel);
    owner.set(pixel, find(id));
  }
  /* A merged stub's own pixels become part of the crossing, so they are neither walked nor lost:
     the walk steps across them exactly as it steps across a multi-pixel junction. */
  for (const branch of merged) {
    const root = find(branch.from);
    for (const pixel of branch.pixels) {
      if (owner.has(pixel)) continue;
      grown.get(root).pixels.push(pixel);
      owner.set(pixel, root);
    }
  }

  const kept = branches
    .filter((b) => !merged.has(b))
    .map((b) => ({ from: find(b.from), to: find(b.to), pixels: b.pixels }));
  for (const branch of kept) {
    at(branch.from).incident += 1;
    at(branch.to).incident += 1;
  }
  return { branches: kept, clusters: grown, clusterOf: owner };
}

/**
 * Drop terminal branches shorter than `fraction` of the longest branch. A branch qualifies only
 * when one end is a loose end and the other is a junction — so a single open curve, whose one
 * branch is terminal at BOTH ends, is never a spur however short it is.
 */
export function pruneSpurs(
  field,
  { fraction = SPUR_FRACTION, rounds = PRUNE_ROUNDS } = {},
) {
  const ink = Uint8Array.from(field.ink);
  const working = { ink, width: field.width, height: field.height };

  for (let round = 0; round < rounds; round += 1) {
    const { branches, clusters, clusterOf } = branchesOf(working);
    if (branches.length < 2) return working;
    const longest = Math.max(...branches.map((b) => b.pixels.length));
    const spurs = branches.filter((b) => {
      const ends = [clusters.get(b.from).incident, clusters.get(b.to).incident];
      const terminal = ends.filter((n) => n === 1).length;
      const junction = ends.filter((n) => n >= 3).length;
      return (
        terminal === 1 && junction === 1 && b.pixels.length < fraction * longest
      );
    });
    if (spurs.length === 0) return working;
    for (const spur of spurs) {
      /* The junction's own pixels stay — they belong to the branches that survive. */
      for (const at of spur.pixels) {
        const id = clusterOf.get(at);
        if (id !== undefined && clusters.get(id).incident >= 3) continue;
        ink[at] = 0;
      }
    }
  }
  throw new Error(`spur pruning did not settle in ${rounds} rounds`);
}

function directionAlong(field, pixels, span) {
  const { width } = field;
  const last = pixels[Math.min(span, pixels.length - 1)];
  const dx = (last % width) - (pixels[0] % width);
  const dy = Math.floor(last / width) - Math.floor(pixels[0] / width);
  const length = Math.hypot(dx, dy) || 1;
  return { x: dx / length, y: dy / length };
}

/**
 * At a junction, the branch that best continues the incoming direction. This is the whole reason a
 * self-crossing motif comes out as one rope: the nearest branch at an X is whichever arm the scan
 * order reaches first, and taking it turns the corner.
 */
function chooseContinuation(incoming, candidates, field) {
  let best = candidates[0];
  let bestScore = -Infinity;
  for (const candidate of candidates) {
    const direction = directionAlong(field, candidate.pixels, LOOKAHEAD);
    const score = incoming.x * direction.x + incoming.y * direction.y;
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  return best;
}

/** Present each candidate branch pixel-ordered away from `junction`, so its direction is outgoing. */
function oriented(candidates, junction) {
  return candidates.map((b) =>
    b.from === junction
      ? { ...b, source: b }
      : {
          ...b,
          pixels: [...b.pixels].reverse(),
          from: b.to,
          to: b.from,
          source: b,
        },
  );
}

/** The direction of travel the pen arrives at a branch's far junction on. */
function arrivalDirection(field, branch) {
  const leaving = directionAlong(
    field,
    [...branch.pixels].reverse(),
    LOOKAHEAD,
  );
  return { x: -leaving.x, y: -leaving.y };
}

/**
 * One greedy trail from `junction`, taking the best continuation at every junction and stopping
 * when nothing unused leaves the one it has reached. `incoming` is the direction the pen arrives
 * on, or null at a loose end where there is nothing to continue.
 */
function greedyTrail(field, incident, used, junction, incoming) {
  const total = [...incident.values()].reduce((n, list) => n + list.length, 0);
  const trail = [];
  let at = junction;
  let direction = incoming;
  /* Bounded by the incidence count, which every step consumes one of. */
  for (let step = 0; step < total; step += 1) {
    const candidates = (incident.get(at) ?? []).filter((b) => !used.has(b));
    if (candidates.length === 0) break;
    const facing = oriented(candidates, at);
    const chosen =
      direction === null
        ? facing[0]
        : chooseContinuation(direction, facing, field);
    used.add(chosen.source);
    trail.push(chosen);
    direction = arrivalDirection(field, chosen);
    at = chosen.to;
  }
  return trail;
}

/** Order a pruned skeleton into a single polyline, from one loose end through to the far one. */
export function walk(field, { bridge = 0 } = {}) {
  const { width } = field;
  const { branches, clusters } = branchesOf(field, bridge);
  if (branches.length === 0)
    throw new Error("the skeleton holds no traceable branch");

  const ends = [...clusters.entries()].filter(([, c]) => c.incident === 1);
  if (ends.length === 0) {
    throw new Error(
      "the skeleton is a closed loop, so it has no end to start a centreline from",
    );
  }
  /* Start at the leftmost loose end, so a motif drawn across the page runs left to right — the
     direction of travel `thread-motifs.ts` measures most of its entry and exit tangents in. It
     settles nothing for a motif drawn on the vertical axis (`bow` enters and exits at 90 degrees):
     there the two ends are level and scan order picks, so such a trace may need reversing by hand. */
  const start = ends.reduce((a, b) =>
    Math.min(...a[1].pixels.map((p) => p % width)) <=
    Math.min(...b[1].pixels.map((p) => p % width))
      ? a
      : b,
  )[0];

  const incident = new Map();
  for (const branch of branches) {
    for (const end of [branch.from, branch.to]) {
      if (!incident.has(end)) incident.set(end, []);
      incident.get(end).push(branch);
    }
  }

  const used = new Set();
  const trail = greedyTrail(field, incident, used, start, null);

  /* The junction rule says WHICH arm continues a rope through a crossing; it says nothing about
     which of a crossing's two through-routes the pen should take FIRST. So the greedy trail can
     reach the far loose end with a whole lobe still untouched — `heart` is a long line with the
     heart hanging off one crossing, and straight on IS the right choice there, which left 65% of
     the skeleton undrawn.

     Splicing each remaining circuit back in at a junction the trail already passes through is
     Hierholzer's construction, and it adds no join the drawing does not have: the pen arrives at
     the crossing, runs the lobe, and returns to that same point to carry on — which is what a rope
     crossing its own body does. It stays ONE continuous stroke because only a trail that ENDS where
     it began is spliced; a detour that runs off to a loose end instead would tear the path, so it
     is unwound and the search moves on. A skeleton with more than two loose ends has such detours
     and cannot be covered — `coverageOf` is what reports the shortfall. */
  for (let round = 0; round < branches.length; round += 1) {
    if (used.size === branches.length) break;
    let spliced = false;
    /* Position -1 is the start itself, before the first branch. */
    for (let i = -1; i < trail.length; i += 1) {
      const node = i === -1 ? start : trail[i].to;
      if (!(incident.get(node) ?? []).some((b) => !used.has(b))) continue;
      const incoming = i === -1 ? null : arrivalDirection(field, trail[i]);
      const detour = greedyTrail(field, incident, used, node, incoming);
      if (detour.length > 0 && detour[detour.length - 1].to === node) {
        trail.splice(i + 1, 0, ...detour);
        spliced = true;
        break;
      }
      for (const branch of detour) used.delete(branch.source);
    }
    if (!spliced) break;
  }

  const ordered = [];
  for (const branch of trail) {
    for (const at of branch.pixels) {
      if (ordered.length > 0 && ordered[ordered.length - 1] === at) continue;
      ordered.push(at);
    }
  }
  return ordered.map((at) => ({ x: at % width, y: Math.floor(at / width) }));
}

/**
 * How much of the skeleton the walk actually covered. The emitted `d` is one open path, so on a
 * drawing with more than two loose ends it is a fragment — and `fitPath`'s aspect is then that
 * fragment's bounding box, not the motif's. This is the figure that tells the two apart without a
 * render, and the aspect is the number a later task pastes into `thread-motifs.ts`.
 */
export function coverageOf(field, points) {
  const { ink } = field;
  let skeleton = 0;
  for (const at of ink) skeleton += at;
  const walked = new Set(points.map((p) => `${p.x},${p.y}`)).size;

  /* A component with no non-degree-2 pixel is a closed loop. `branchesOf` starts every branch at a
     non-degree-2 pixel, so such a component yields no branch and disappears from the skeleton with
     nothing raised; counting its pixels here is what keeps that visible. */
  const visited = new Set();
  let closedLoop = 0;
  for (let at = 0; at < ink.length; at += 1) {
    if (ink[at] !== 1 || visited.has(at)) continue;
    const queue = [at];
    visited.add(at);
    let loose = false;
    /* Bounded by the component's own size: a pixel is queued once, the first time it is seen. */
    for (let head = 0; head < queue.length; head += 1) {
      const neighbours = neighboursOf(field, queue[head]);
      if (neighbours.length !== 2) loose = true;
      for (const next of neighbours) {
        if (visited.has(next)) continue;
        visited.add(next);
        queue.push(next);
      }
    }
    if (!loose) closedLoop += queue.length;
  }

  return { skeleton, walked, closedLoop, fraction: walked / skeleton };
}

function resample(points, segments) {
  const cumulative = [0];
  for (let i = 1; i < points.length; i += 1) {
    cumulative.push(
      cumulative[i - 1] +
        Math.hypot(
          points[i].x - points[i - 1].x,
          points[i].y - points[i - 1].y,
        ),
    );
  }
  const total = cumulative[cumulative.length - 1];
  if (total === 0) return [points[0], points[points.length - 1]];

  const out = [];
  let cursor = 0;
  for (let s = 0; s <= segments; s += 1) {
    const target = (total * s) / segments;
    /* The cursor only ever advances, so the whole resample crosses the polyline once. */
    for (
      let advance = 0;
      advance < cumulative.length &&
      cursor < cumulative.length - 2 &&
      cumulative[cursor + 1] < target;
      advance += 1
    ) {
      cursor += 1;
    }
    const span = cumulative[cursor + 1] - cumulative[cursor];
    const t = span === 0 ? 0 : (target - cumulative[cursor]) / span;
    out.push({
      x: points[cursor].x + (points[cursor + 1].x - points[cursor].x) * t,
      y: points[cursor].y + (points[cursor + 1].y - points[cursor].y) * t,
    });
  }
  return out;
}

const round = (n) => Number(n.toFixed(2));

/**
 * Fit cubics to the polyline and scale the ink uniformly into a 0-100 square, centred on the
 * shorter axis. Uniform, because a motif is composed as a square and a non-uniform fit would make
 * the heart an egg at every tier but one.
 */
export function fitPath(points, { segments = SEGMENTS } = {}) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const box = {
    x: Math.min(...xs),
    y: Math.min(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  };
  const scale = 100 / Math.max(box.width, box.height);
  const offsetX = (100 - box.width * scale) / 2;
  const offsetY = (100 - box.height * scale) / 2;
  const unit = resample(points, segments).map((p) => ({
    x: (p.x - box.x) * scale + offsetX,
    y: (p.y - box.y) * scale + offsetY,
  }));

  /* Catmull-Rom through every resampled point, converted to the cubic that passes through the same
     two anchors — so the emitted `d` interpolates the skeleton rather than approximating it. */
  let d = `M ${round(unit[0].x)} ${round(unit[0].y)}`;
  for (let i = 0; i < unit.length - 1; i += 1) {
    const p0 = unit[Math.max(0, i - 1)];
    const p1 = unit[i];
    const p2 = unit[i + 1];
    const p3 = unit[Math.min(unit.length - 1, i + 2)];
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C ${round(c1.x)} ${round(c1.y)}, ${round(c2.x)} ${round(c2.y)}, ${round(p2.x)} ${round(p2.y)}`;
  }

  return { d, aspect: Number((box.width / box.height).toFixed(3)) };
}

/** The whole pipeline: outline SVG in, one continuous open centreline, its aspect and its coverage. */
export async function centreline(svg, options = {}) {
  const raster = await rasterise(svg, options);
  const skeleton = pruneSpurs(thin(raster, options), options);
  const points = walk(skeleton, {
    bridge: bridgeSpan(raster, skeleton, options),
  });
  const { d, aspect } = fitPath(points, options);
  return { points, d, aspect, coverage: coverageOf(skeleton, points) };
}

/**
 * The longest skeleton stub that counts as part of one crossing, measured from the drawing rather
 * than assumed: ink pixels over skeleton pixels is the mean stroke width, and thinning an X of
 * width w separates its two T-nodes by about w. BRIDGE_STROKES gives that headroom.
 */
function bridgeSpan(raster, skeleton, { strokes = BRIDGE_STROKES } = {}) {
  let ink = 0;
  for (const pixel of raster.ink) ink += pixel;
  let bone = 0;
  for (const pixel of skeleton.ink) bone += pixel;
  return bone === 0 ? 0 : strokes * (ink / bone);
}

/** A numeric CLI flag. An unreadable value stops the run rather than reaching sharp as NaN. */
function flag(argv, name, fallback, minimum) {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  if (hit === undefined) return fallback;
  const raw = hit.slice(name.length + 3);
  const value = Number(raw);
  if (!Number.isFinite(value) || value < minimum)
    throw new Error(
      `--${name} needs a number of at least ${minimum}, not "${raw}"`,
    );
  return value;
}

async function main(argv) {
  const file = argv.find((a) => !a.startsWith("--"));
  if (file === undefined) {
    console.error(
      "usage: npm run trace:motif -- <file.svg> [--width=1200] [--spur=0.04] [--segments=48] [--bridge=2]",
    );
    process.exitCode = 1;
    return;
  }
  let options;
  try {
    options = {
      width: flag(argv, "width", RASTER_WIDTH, 1),
      fraction: flag(argv, "spur", SPUR_FRACTION, 0),
      segments: flag(argv, "segments", SEGMENTS, 1),
      strokes: flag(argv, "bridge", BRIDGE_STROKES, 0),
    };
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
    return;
  }

  const { d, aspect, coverage } = await centreline(
    await readFile(file),
    options,
  );
  const percent = (coverage.fraction * 100).toFixed(1);
  console.log(d);
  console.log(
    `covered: ${coverage.walked} of ${coverage.skeleton} skeleton pixels (${percent}%)`,
  );
  if (coverage.closedLoop > 0) {
    console.log(
      `dropped: ${coverage.closedLoop} of those pixels form closed loops with no loose end, which one open path cannot reach`,
    );
  }
  console.log(
    coverage.walked === coverage.skeleton
      ? `aspect: ${aspect}`
      : `aspect: ${aspect} — of the traced FRAGMENT, not of the motif: ${percent}% of the skeleton was walked`,
  );
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  await main(process.argv.slice(2));
}
