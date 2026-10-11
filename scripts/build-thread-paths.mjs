/* Builds `components/thread/thread-paths.ts` from the owner's three drawn sheets.
 *
 * Ports the original `fit-motifs.mjs`'s rotation/centre fit, run fresh against each band's
 * CURRENT `connectors.json` (post type-relax), and additionally: converts every connector's drawn
 * polyline from page pixels into the section's own LOCAL pixel box (matching `thread-boxes.ts`'s
 * `sectionBox`), and fits a cubic-Bezier `d` string through it with `splinePath`, meeting a motif
 * on its own fitted heading.
 *
 * A connector that crosses a section boundary is fit ONCE, whole, in the page's global pixels —
 * never as two independently-fit halves meeting at a shared tangent, and never forced onto
 * `TERMINAL_TANGENT` (vertical), which belongs to the retired grid where independently-authored
 * sections had to be forced to agree at all. The owner draws one continuous stroke down the page,
 * so the fitted curve already agrees with itself at the boundary; it is SLICED there afterwards
 * (`sliceFittedPath`), never re-fit, so both halves stay exactly what one curve already was. A free
 * page-end (before the first motif, after the last) is left with no forced tangent at all, which
 * the drawn sheet leaves loose on purpose.
 *
 * RUN ONCE PER DRAWING UPDATE, and committed rather than kept as scratch (2026-10-11). It lived
 * in gitignored `tmp/` until then, alongside the only copy of the authored JSON it reads — which
 * meant `components/thread/thread-paths.ts` was a committed generated file that a fresh clone
 * COULD NOT REGENERATE. The three bands' sources are now `assets/thread/{wide,tall,upright}/`,
 * beside the other sources of record. The owner's drawn sheets themselves stay out of the repo:
 * they are ~18MB of PNG and the extracted JSON is what this reads.
 *
 *   node scripts/build-thread-paths.mjs    # -> components/thread/thread-paths.ts
 *
 * Regenerate into `tmp/` first, diff, then copy — `rules/generated-artifacts.md`. Diff the two
 * sides AFTER the formatter has run on both, or the raw output reads as hundreds of changed lines.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { MOTIFS } from "../components/thread/thread-motifs.ts";
import { boundSpans, MAX_SPAN, splinePath } from "./thread-spline.ts";

const SECTION_ORDER = [
  "invite",
  "event-info",
  "contact",
  "family",
  "celebrations",
  "wishes",
];

const DIRS = {
  wide: "assets/thread/wide",
  tall: "assets/thread/tall",
  upright: "assets/thread/upright",
};

/* The owner's own tuned value, per band — READ from `.claude/work/thread-wide-placements.md`'s
   confirmed routes, never derived. A first version of this script derived a motif's field size
   from the drawn ends' own separation instead of holding this fixed, which silently rescaled every
   motif by a different factor (heart 1.13x, rings 1.57x, bow 0.40x, …) — the drawn ends sit 4-30px
   off the authored attachment points, which is expected and fine for FITTING TURN AND CENTRE, but
   wrong for recovering a size that was never carried by that separation in the first place. `scale`
   is an INPUT to the fit, never an output of it.

   A motif/band cell with no `scale` in the source table takes its `?? 0.3` default — pinned here by
   `undefined` rather than by copying 0.3 in, so a future correction to that default only has to
   change one place. */
const SCALE = {
  tall: {
    heart: 0.2,
    rings: 0.25,
    knot: 0.25,
    phone: 0.2,
    portraitLoop: 0.35,
    wishesLoop: undefined,
    bow: undefined,
  },
  wide: {
    heart: 0.3,
    rings: 0.28,
    knot: 0.2,
    phone: 0.17,
    portraitLoop: 0.2,
    wishesLoop: undefined,
    bow: undefined,
  },
  upright: {
    heart: 0.2,
    rings: 0.25,
    knot: 0.25,
    phone: 0.2,
    portraitLoop: 0.25,
    wishesLoop: 0.2,
    bow: undefined,
  },
};

/* `scale` multiplies `100svmin` of the band's OWN nominal viewport (`thread-bands.ts`'s `box`) —
   the field basis the drawn sheets were rendered against, in CSS px: `min(box.width, box.height)`.
   Confirmed against the coordinator's own expected renders (wide/heart 0.3 x 695 = 208.5,
   wide/rings 0.28 x 695 = 194.6, wide/phone 0.17 x 695 = 118.15). */
const SVMIN_BY_BAND = { tall: 393, wide: 695, upright: 820 };

/* Owner decision, in chat: the reflection that negates the motif's own internal turn is wanted for
   `portraitLoop` in `wide` and `tall`, where the drawn line turns the opposite sign from the
   motif's authored turn. `upright`'s two loops wind opposite ways in the drawing, so mirroring one
   is not this task's call — neither is mirrored here. */
function isMirrored(band, motifId) {
  return motifId === "portraitLoop" && (band === "wide" || band === "tall");
}

const deg = (r) => (r * 180) / Math.PI;
const rad = (d) => (d * Math.PI) / 180;
const round = (n, places = 2) => Math.round(n * 10 ** places) / 10 ** places;

/* A reflection about the drawing's own vertical axis: entry stays entry, but the direction of
   travel flips sign on x, which is `angle -> 180 - angle`, and the offset from the square's centre
   flips on x too. */
function mirrorTangent(t) {
  return { x: 1 - t.x, y: t.y, angle: 180 - t.angle };
}

function circularMeanDegrees(anglesRad) {
  const s = anglesRad.reduce((sum, a) => sum + Math.sin(a), 0);
  const c = anglesRad.reduce((sum, a) => sum + Math.cos(a), 0);
  return deg(Math.atan2(s, c));
}

/* The direction of travel over a fixed reach from a stroke's own terminal — never the last segment
   alone, which can be a few pixels of skeleton noise. Matches `import-thread-drawing.mjs`'s own
   `headingAt`. */
function headingAt(stroke, which, reach) {
  const anchor = which === "from" ? stroke[0] : stroke.at(-1);
  const order = which === "from" ? stroke : [...stroke].reverse();
  const away =
    order.find((p) => Math.hypot(p.x - anchor.x, p.y - anchor.y) >= reach) ??
    order.at(-1);
  return which === "from"
    ? deg(Math.atan2(away.y - anchor.y, away.x - anchor.x))
    : deg(Math.atan2(anchor.y - away.y, anchor.x - away.x));
}

function headingVector(degrees) {
  return { x: Math.cos(rad(degrees)), y: Math.sin(rad(degrees)) };
}

/* `p[i]` and `p[i+1]` bracket the boundary in y; linear interpolation is exact enough for a split
   point that then gets its own fitted spline either side of it. */
function splitAtY(points, boundaryY) {
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    const above = a.y - boundaryY;
    const below = b.y - boundaryY;
    if ((above <= 0 && below >= 0) || (above >= 0 && below <= 0)) {
      const span = b.y - a.y;
      const t = span === 0 ? 0 : (boundaryY - a.y) / span;
      const split = { x: a.x + t * (b.x - a.x), y: boundaryY };
      return {
        before: [...points.slice(0, i + 1), split],
        after: [split, ...points.slice(i + 1)],
      };
    }
  }
  throw new Error(
    `connector never reaches y=${boundaryY} (range ${points[0].y}..${points.at(-1).y})`,
  );
}

function formatPath(points, ends) {
  const rounded = points.map((p) => ({ x: round(p.x), y: round(p.y) }));
  return splinePath(rounded, { ends });
}

/* `d`'s own numbers, in order: `M x y (C c1x c1y c2x c2y x y)*`. */
function numbersOf(d) {
  return [...d.matchAll(/-?\d+(?:\.\d+)?(?:e-?\d+)?/g)].map((m) =>
    Number(m[0]),
  );
}

/* Cuts a fitted `d` string into two, at the boundary between cubic segment `beforeCount - 1` and
   the next — WITHOUT re-fitting either half. This is what makes the two halves agree exactly: they
   are the same curve `splinePath` already produced for the FULL boundary-crossing stroke, merely
   split into two `<path>`s at a point that was already one of its own fitted vertices. Re-fitting
   each half on its own (the first version of this script did) gives each side its own Catmull-Rom
   arm length, sized from that side's OWN adjacent span — so even with an identical tangent forced
   at the shared point, the two curves peel away from it at different rates and the join still
   reads as a small kink a few pixels in. Slicing one curve has no such seam to begin with. */
function sliceFittedPath(d, beforeCount) {
  const n = numbersOf(d);
  const beforeNumbers = n.slice(0, 2 + beforeCount * 6);
  const afterNumbers = [
    n[2 + beforeCount * 6 - 2],
    n[2 + beforeCount * 6 - 1],
    ...n.slice(2 + beforeCount * 6),
  ];
  const toPath = (nums) => {
    const segments = [`M ${nums[0]} ${nums[1]}`];
    for (let i = 2; i + 5 < nums.length; i += 6) {
      segments.push(
        `C ${nums[i]} ${nums[i + 1]} ${nums[i + 2]} ${nums[i + 3]} ${nums[i + 4]} ${nums[i + 5]}`,
      );
    }
    return segments.join(" ");
  };
  return { before: toPath(beforeNumbers), after: toPath(afterNumbers) };
}

/* Every Y number in a `d` string (the odd-indexed ones, `x y` pairs throughout) shifted by a
   constant — converting a curve fit in GLOBAL page pixels into a section's own LOCAL box, which
   only ever differs from the page by how far down it starts. X needs no such shift: every
   section's box shares the page's own left edge and full width. */
function shiftPathY(d, dy) {
  const n = numbersOf(d);
  const shifted = n.map((v, i) => (i % 2 === 1 ? round(v + dy) : round(v)));
  const segments = [`M ${shifted[0]} ${shifted[1]}`];
  for (let i = 2; i + 5 < shifted.length; i += 6) {
    segments.push(
      `C ${shifted[i]} ${shifted[i + 1]} ${shifted[i + 2]} ${shifted[i + 3]} ${shifted[i + 4]} ${shifted[i + 5]}`,
    );
  }
  return segments.join(" ");
}

function buildBand(band, dir) {
  const geometry = JSON.parse(readFileSync(`${dir}/geometry.json`, "utf8"));
  const attachments = JSON.parse(
    readFileSync(`${dir}/attachments.json`, "utf8"),
  );
  const connectors = JSON.parse(readFileSync(`${dir}/connectors.json`, "utf8"));
  const sections = geometry.sections;
  const reach = Math.max(20, Math.round(geometry.width / 34));

  /* Each motif INSTANCE, in page order — family's two `portraitLoop`s are two separate instances,
     not two readings of one. */
  const motifs = [];
  for (let i = 0; i < attachments.length; i += 2) {
    const entry = attachments[i];
    const exit = attachments[i + 1];
    if (
      entry.which !== "entry" ||
      exit.which !== "exit" ||
      entry.motif !== exit.motif
    ) {
      throw new Error(`attachments.json is not entry/exit pairs at index ${i}`);
    }
    motifs.push({ entry, exit, section: entry.section, motifId: entry.motif });
  }

  const fitted = motifs.map((m, index) => {
    const motif = MOTIFS[m.motifId];
    const mirror = isMirrored(band, m.motifId);
    const entryTangent = mirror ? mirrorTangent(motif.entry) : motif.entry;
    const exitTangent = mirror ? mirrorTangent(motif.exit) : motif.exit;

    const arriving = connectors[index]?.points;
    const leaving = connectors[index + 1]?.points;
    if (!arriving || !leaving) {
      throw new Error(
        `${band}/${m.section}/${m.motifId}: missing adjoining connector`,
      );
    }

    const drawnEntryHeading = headingAt(arriving, "to", reach);
    const drawnExitHeading = headingAt(leaving, "from", reach);
    const turn = circularMeanDegrees([
      rad(drawnEntryHeading - entryTangent.angle),
      rad(drawnExitHeading - exitTangent.angle),
    ]);

    /* HELD FIXED — an input to the fit, never solved for. See `SCALE`'s own comment for why
       deriving it from the drawn ends' separation was wrong. */
    const size = (SCALE[band][m.motifId] ?? 0.3) * SVMIN_BY_BAND[band];

    const place = (tangent) => {
      const dx = tangent.x - 0.5;
      const dy = tangent.y - 0.5;
      const c = Math.cos(rad(turn));
      const s = Math.sin(rad(turn));
      return { x: (dx * c - dy * s) * size, y: (dx * s + dy * c) * size };
    };
    const offEntry = place(entryTangent);
    const offExit = place(exitTangent);
    const endA = arriving.at(-1);
    const endB = leaving[0];
    const globalCx = (endA.x - offEntry.x + (endB.x - offExit.x)) / 2;
    const globalCy = (endA.y - offEntry.y + (endB.y - offExit.y)) / 2;

    const sectionIndex = SECTION_ORDER.indexOf(m.section);
    const localCy = globalCy - sections[sectionIndex].top;

    const newEntryHeading = entryTangent.angle + turn;
    const newExitHeading = exitTangent.angle + turn;

    return {
      section: m.section,
      motifId: m.motifId,
      mirror,
      turn,
      x: globalCx,
      y: localCy,
      entryHeadingVector: headingVector(newEntryHeading),
      exitHeadingVector: headingVector(newExitHeading),
      drawnEntryHeading,
      drawnExitHeading,
      /* The point the fit actually solved for, at the AUTHORED size — not `endA`/`endB`, which sit
         4-30px off it (the drawn stroke's own imprecision). A connector's end is snapped onto this
         before it is fit, which is what closes that residual. */
      entryPointGlobal: { x: globalCx + offEntry.x, y: globalCy + offEntry.y },
      exitPointGlobal: { x: globalCx + offExit.x, y: globalCy + offExit.y },
    };
  });

  /* One global chain of `motifs.length + 1` connectors: a free run before the first motif, one
     between every consecutive pair, and a free run after the last — matching
     `assignConnectors`'s own `links`. A connector whose two motifs sit in different sections is the
     SAME drawn stroke crossing the boundary, so it is split at that boundary's exact y rather than
     assigned wholesale to either side. */
  const bySectionConnectors = {};
  for (const id of SECTION_ORDER) bySectionConnectors[id] = [];

  const pushLocal = (sectionId, points, ends) => {
    const top = sections[SECTION_ORDER.indexOf(sectionId)].top;
    const local = points.map((p) => ({ x: p.x, y: p.y - top }));
    bySectionConnectors[sectionId].push({ d: formatPath(local, ends) });
  };

  for (let k = 0; k < connectors.length; k += 1) {
    const before = k > 0 ? fitted[k - 1] : null;
    const after = k < fitted.length ? fitted[k] : null;

    /* Snapped onto the fit's own attachment point, not the raw drawn end — closing the 4-30px the
       drawn stroke misses the authored motif by, per the coordinator's fix. A free page-end has
       nothing to snap to and keeps its raw point. */
    const points = connectors[k].points.map((p, i, arr) => {
      if (i === 0 && before) return before.exitPointGlobal;
      if (i === arr.length - 1 && after) return after.entryPointGlobal;
      return p;
    });

    if (before && after && before.section !== after.section) {
      const boundaryY = sections[SECTION_ORDER.indexOf(after.section)].top;
      const { before: firstHalf, after: secondHalf } = splitAtY(
        points,
        boundaryY,
      );

      /* The owner draws ONE continuous stroke down the whole page, so the two halves must not be
         fit as two independent curves that merely SHARE a tangent at the join — even a shared
         tangent direction still lets each side peel away from it at its own rate (each side's
         Catmull-Rom arm is sized from that side's own adjacent span), which reads as a small kink
         a few pixels in. `TERMINAL_TANGENT` (vertical) belonged to the retired grid, where
         independently-authored sections had to be forced to agree at all — forcing it here bent a
         curve that already agrees with itself, by up to ~80 degrees against the drawn crossing.
         Fitting the WHOLE crossing stroke once, in the page's global pixels, and slicing the
         result at the join it already passes through, removes the seam instead of narrowing it:
         both halves are subpaths of one curve, not two curves aimed at the same point. */
      const combined = [...firstHalf, ...secondHalf.slice(1)];
      const combinedD = formatPath(combined, {
        start: before.exitHeadingVector,
        end: after.entryHeadingVector,
      });
      /* The slice index counts CUBICS in the fitted path, and `splinePath` emits one cubic per span
         of the BOUNDED point list, not of the authored one -- `boundSpans` subdivides any span wider
         than `MAX_SPAN`, so the authored count stopped being the cubic count the day that rule
         landed. Taking it from the authored count sliced the combined curve at the wrong cubic,
         leaving part of each section's half on the other's `<path>`; `thread-paths.test.ts`'s
         boundary test caught it as a 19.5 degree heading mismatch at tall's celebrations/wishes join.
         Bounding is per-span and purely local, and the split point is itself a vertex of both halves,
         so the bounded combined list is exactly the two bounded halves concatenated -- which is what
         makes this count exact rather than approximate. */
      const { before: beforeD, after: afterD } = sliceFittedPath(
        combinedD,
        boundSpans(firstHalf, MAX_SPAN).length - 1,
      );

      const beforeTop = sections[SECTION_ORDER.indexOf(before.section)].top;
      const afterTop = sections[SECTION_ORDER.indexOf(after.section)].top;
      bySectionConnectors[before.section].push({
        d: shiftPathY(beforeD, -beforeTop),
      });
      bySectionConnectors[after.section].push({
        d: shiftPathY(afterD, -afterTop),
      });
      continue;
    }

    const sectionId = before?.section ?? after?.section;
    pushLocal(sectionId, points, {
      start: before ? before.exitHeadingVector : undefined,
      end: after ? after.entryHeadingVector : undefined,
    });
  }

  const paths = {};
  const placements = {};
  for (const id of SECTION_ORDER) {
    paths[id] = bySectionConnectors[id];
    placements[id] = fitted
      .filter((f) => f.section === id)
      .map((f) => ({
        motif: f.motifId,
        x: round(f.x),
        y: round(f.y),
        scale: SCALE[band][f.motifId] ?? 0.3,
        turn: round(f.turn),
        ...(f.mirror ? { mirror: true } : {}),
      }));
  }

  return { paths, placements, fitted };
}

function emit(results) {
  const bandOrder = ["tall", "upright", "wide"];
  const jsonPath = (v) => JSON.stringify(v);

  const connectorEntry = (id, list) =>
    `      ${jsonPath(id)}: [\n${list.map((c) => `        { d: ${jsonPath(c.d)} },`).join("\n")}\n      ],`;
  const placementEntry = (id, list) =>
    `      ${jsonPath(id)}: [\n${list
      .map(
        (p) =>
          `        { motif: ${jsonPath(p.motif)}, x: ${p.x}, y: ${p.y}, scale: ${p.scale}, turn: ${p.turn}${
            p.mirror ? ", mirror: true" : ""
          } },`,
      )
      .join("\n")}\n      ],`;

  const pathsBody = bandOrder
    .map(
      (band) =>
        `    ${band}: {\n${SECTION_ORDER.map((id) => connectorEntry(id, results[band].paths[id])).join("\n")}\n    },`,
    )
    .join("\n");
  const placementsBody = bandOrder
    .map(
      (band) =>
        `    ${band}: {\n${SECTION_ORDER.map((id) => placementEntry(id, results[band].placements[id])).join("\n")}\n    },`,
    )
    .join("\n");

  return `/* Generated by \`scripts/build-thread-paths.mjs\` from the authored geometry in
   \`assets/thread/{wide,tall,upright}/\` — see that script for the fit and the boundary split.
   That JSON was extracted from the owner's three drawn sheets, which are ~18MB of PNG and are
   held outside the repo; the JSON is the source of record here. Re-run the generator after any
   re-drawing; do not hand-edit the numbers below.

   Every connector's \`d\` and every placement's \`x\`/\`y\` are in the SAME per-section pixel box
   \`thread-boxes.ts\`'s \`sectionBox\` describes: x from the section's left edge, y from the
   section's own top. A motif is met on its own tangent turned by \`turn\`, the fitted absolute
   angle described below. A SECTION BOUNDARY is not met on any authored tangent at all — never
   \`TERMINAL_TANGENT\` (vertical), which belonged to the retired grid where independently-authored
   sections had to be forced to agree. The owner draws one continuous stroke down the page, so a
   boundary-crossing connector is fit ONCE, whole, then sliced at the join it already passes
   through; both halves below are exactly what one curve already was, never two curves independently
   aimed at the same point. A free page-end (before the very first motif, after the very last)
   carries no forced tangent either — the drawn sheet leaves it loose, not resting on the page's own
   top or bottom edge.

   \`turn\` is an ABSOLUTE authored angle in the section's own pixels, not \`nudge + splineDirection\`
   — deriving it from the route drifted the moment a section's own layout changed under it, which is
   the drift the owner reported. It and the motif's centre are FITTED to the drawing: a motif's two
   attachment points are fixed offsets from its centre and each carries a tangent, so turning the
   motif turns both together, and the turn that fits is the circular mean of (drawn heading minus
   the motif's own declared angle) at both ends. Scale is NOT fitted — it is the owner's own tuned
   value, carried forward unchanged.

   \`portraitLoop\` carries \`mirror: true\` in \`wide\` and \`tall\` only (owner decision, in chat):
   the motif turns the thread -29 degrees passing through it, and the drawn line there turns the
   same magnitude the OPPOSITE sign, which no rotation alone can fix. A reflection about the
   drawing's own vertical axis (entry stays entry; every tangent \`t -> 180-t\`) negates the internal
   turn instead. \`upright\`'s two loops wind opposite ways in the drawing, so mirroring one would
   only fix that one — the owner has not made that call, and this file does not make it for them. */
import type { BandId } from "./thread-bands.ts";
import type { MotifId, ThreadId } from "./thread-geometry.ts";

/* The six real sections, in page order — \`not-found\` is excluded here for the same reason it is
   excluded from \`BySection\`: it draws the invite's own paths rather than owning a row. Composition
   (\`thread-css.ts\`) resolves \`not-found\` -> \`invite\` and reads this list for section adjacency
   (which id hands the thread to which). */
export const THREAD_IDS: readonly Exclude<ThreadId, "not-found">[] = [
${SECTION_ORDER.map((id) => `  ${JSON.stringify(id)},`).join("\n")}
];

export type Connector = { d: string };

export type Placement = {
  motif: MotifId;
  x: number;
  y: number;
  scale: number;
  turn: number;
  mirror?: boolean;
};

type BySection<T> = Record<Exclude<ThreadId, "not-found">, T>;

export const THREAD_PATHS: Record<BandId, BySection<Connector[]>> = {
${pathsBody}
};

export const MOTIF_PLACEMENTS: Record<BandId, BySection<Placement[]>> = {
${placementsBody}
};
`;
}

const results = {};
for (const [band, dir] of Object.entries(DIRS)) {
  results[band] = buildBand(band, dir);
}

writeFileSync("components/thread/thread-paths.ts", emit(results));

console.log("\n=== fitted turn, all 8 motifs x 3 bands ===");
for (const band of Object.keys(DIRS)) {
  console.log(`\n-- ${band} --`);
  for (const f of results[band].fitted) {
    console.log(
      `  ${f.section.padEnd(13)} ${f.motifId.padEnd(13)} turn ${f.turn.toFixed(2).padStart(8)}` +
        `${f.mirror ? "  (mirrored)" : ""}`,
    );
  }
}
