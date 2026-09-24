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
 *      best CONTINUES the incoming direction. `knot` and `rings` cross themselves; a walk that
 *      turns at a crossing emits one rope as two loops meeting, which is the wrong drawing and not
 *      a wrong-looking one.
 *   5. `fitPath` — resamples by arc length, converts a Catmull-Rom spline to cubics, and scales
 *      the ink uniformly into a 0-100 square, centred, matching `thread-motifs.ts`.
 *
 * CAPS: every loop here states its maximum. Thinning 100 passes, spur pruning 20 rounds, and
 * every skeleton traversal is bounded by the pixel count it walks.
 *
 * USAGE:
 *   npm run trace:motif -- "tmp/aaa/thread paths/heart.svg"
 *   npm run trace:motif -- <file.svg> --width=1600 --spur=0.06 --segments=64
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
function neighboursOf(ink, width, height, at) {
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
function branchesOf(field) {
  const { ink, width, height } = field;
  const degree = new Map();
  for (let at = 0; at < ink.length; at += 1) {
    if (ink[at] === 1)
      degree.set(at, neighboursOf(ink, width, height, at).length);
  }

  const nodePixels = [...degree.keys()].filter((at) => degree.get(at) !== 2);
  const clusterOf = new Map();
  for (const seed of nodePixels) {
    if (clusterOf.has(seed)) continue;
    const id = clusterOf.size;
    const queue = [seed];
    clusterOf.set(seed, id);
    for (
      let head = 0;
      head < queue.length && head < nodePixels.length;
      head += 1
    ) {
      for (const next of neighboursOf(ink, width, height, queue[head])) {
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
    for (const first of neighboursOf(ink, width, height, node)) {
      if (clusterOf.get(first) === clusterOf.get(node)) continue;
      if (seen.has(`${node}:${first}`)) continue;
      const pixels = [node, first];
      let previous = node;
      let current = first;
      for (let step = 0; step < cap && !clusterOf.has(current); step += 1) {
        const next = neighboursOf(ink, width, height, current).find(
          (p) => p !== previous,
        );
        if (next === undefined) break;
        pixels.push(next);
        previous = current;
        current = next;
      }
      seen.add(`${node}:${first}`);
      seen.add(`${current}:${pixels[pixels.length - 2]}`);
      if (!clusterOf.has(current)) continue;
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
  return { branches, clusters, clusterOf };
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
      ? b
      : { ...b, pixels: [...b.pixels].reverse(), from: b.to, to: b.from },
  );
}

/** Order a pruned skeleton into a single polyline, from one loose end through to the far one. */
export function walk(field) {
  const { width } = field;
  const { branches, clusters } = branchesOf(field);
  if (branches.length === 0)
    throw new Error("the skeleton holds no traceable branch");

  const ends = [...clusters.entries()].filter(([, c]) => c.incident === 1);
  if (ends.length === 0) {
    throw new Error(
      "the skeleton is a closed loop, so it has no end to start a centreline from",
    );
  }
  /* Start at the leftmost loose end so a traced motif runs left to right, the direction of travel
     `thread-motifs.ts` measures its entry and exit tangents in. */
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
  const ordered = [];
  let junction = start;
  let incoming = null;

  for (let step = 0; step < branches.length; step += 1) {
    const candidates = (incident.get(junction) ?? []).filter(
      (b) => !used.has(b),
    );
    if (candidates.length === 0) break;
    const facing = oriented(candidates, junction);
    const chosen =
      incoming === null
        ? facing[0]
        : chooseContinuation(incoming, facing, field);
    used.add(candidates[facing.indexOf(chosen)]);
    for (const at of chosen.pixels) {
      if (ordered.length > 0 && ordered[ordered.length - 1] === at) continue;
      ordered.push(at);
    }
    const leaving = directionAlong(
      field,
      [...chosen.pixels].reverse(),
      LOOKAHEAD,
    );
    incoming = { x: -leaving.x, y: -leaving.y };
    junction = chosen.to;
  }

  return ordered.map((at) => ({ x: at % width, y: Math.floor(at / width) }));
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

/** The whole pipeline: outline SVG in, one continuous open centreline and its aspect out. */
export async function centreline(svg, options = {}) {
  const raster = await rasterise(svg, options);
  const skeleton = pruneSpurs(thin(raster, options), options);
  const points = walk(skeleton);
  const { d, aspect } = fitPath(points, options);
  return { points, d, aspect, width: raster.width, height: raster.height };
}

function flag(argv, name, fallback) {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit === undefined ? fallback : Number(hit.slice(name.length + 3));
}

async function main(argv) {
  const file = argv.find((a) => !a.startsWith("--"));
  if (file === undefined) {
    console.error(
      "usage: npm run trace:motif -- <file.svg> [--width=1200] [--spur=0.04] [--segments=48]",
    );
    process.exitCode = 1;
    return;
  }
  const { d, aspect } = await centreline(await readFile(file), {
    width: flag(argv, "width", RASTER_WIDTH),
    fraction: flag(argv, "spur", SPUR_FRACTION),
    segments: flag(argv, "segments", SEGMENTS),
  });
  console.log(d);
  console.log(`aspect: ${aspect}`);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  await main(process.argv.slice(2));
}
