/**
 * Bring the owner's pen marks on the retouch sheets into `assets/thread/<band>/pen.json`.
 *
 * usage: node scripts/thread/import-pen-marks.mjs --drawn=<dir> --sent=<dir>
 *          [--move=<crop.png>:<dy>]... [--refit-rings=<band>]... [--overlays=<dir>] [--out=assets/thread]
 *
 * `--sent` holds the crops as they were sent and their `crops.json` (each crop's band, section,
 * photo states and page rows); `--drawn` the same files as the owner drew on them. Only pixels that
 * differ from the sent crop are read: magenta becomes a stroke (its traced centreline), cyan a
 * smoothing zone. `--move` names a crop whose cyan is a move rather than a zone — its blob's box
 * carries the line down by `dy`. Every mark is stored on the drawn page (every ritual
 * photographed); marks that touch the same stretch share a group, so a photo state takes the one
 * drawn on it, else the nearest (`chooseMarks`). `--refit-rings` asks the generator to fit that band's
 * portrait rings to the strokes past them.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import { components, simplify } from "./import-thread-drawing.mjs";
import {
  checkPen,
  cornersOf,
  penMask,
  toDrawn,
  zonesOf,
} from "./pen-marks.mjs";
import { pruneSpurs, thin, walkThrough } from "./trace-motif.mjs";

/** @typedef {import("./pen-marks.mjs").Stroke} Stroke */
/** @typedef {import("./pen-marks.mjs").Zone} Zone */
/** @typedef {import("./pen-marks.mjs").Move} Move */
/** @typedef {{ file: string, band: string, section: string, states: string[], source: string, pageTop: number, pageBottom: number, dpr: number }} Crop */

/* A stroke's centreline keeps its drawn shape to within this much (page px). */
const TOLERANCE = 1;
/* A stroke broken where it crosses the red line (the crossing reads red, not pen) is one stroke
   again when its pieces' ends lie within this distance (crop px). */
const REJOIN = 40;
/* A stroke shorter than this (page px) is a fleck of the pen, not a mark. */
const FLECK = 40;
/* Marks within this distance of each other (page px) fix the same stretch. */
const SAME_STRETCH = 30;
const round = (/** @type {number} */ v) => Math.round(v * 100) / 100;

/** @param {string[]} args @param {string} name */
const flags = (args, name) =>
  args
    .filter((a) => a.startsWith(`--${name}=`))
    .map((a) => a.slice(name.length + 3));

/** @param {string} combination */
const removedIn = (combination) =>
  [...combination].flatMap((c, k) => (c === "0" ? [k] : []));

/**
 * Group marks whose boxes, grown by SAME_STRETCH, overlap.
 * @param {{ x0: number, y0: number, x1: number, y1: number }[]} boxes
 */
function groupsOf(boxes) {
  const parent = boxes.map((_, i) => i);
  const find = (/** @type {number} */ i) => {
    while (parent[i] !== i) i = parent[i];
    return i;
  };
  for (let i = 0; i < boxes.length; i += 1)
    for (let j = i + 1; j < boxes.length; j += 1) {
      const a = boxes[i];
      const b = boxes[j];
      if (
        a.x0 - SAME_STRETCH <= b.x1 &&
        b.x0 - SAME_STRETCH <= a.x1 &&
        a.y0 - SAME_STRETCH <= b.y1 &&
        b.y0 - SAME_STRETCH <= a.y1
      )
        parent[find(j)] = find(i);
    }
  const ids = [...new Set(boxes.map((_, i) => find(i)))];
  return boxes.map((_, i) => ids.indexOf(find(i)));
}

/** @param {{ x: number, y: number }[]} points */
const boxOf = (points) => ({
  x0: Math.min(...points.map((p) => p.x)),
  y0: Math.min(...points.map((p) => p.y)),
  x1: Math.max(...points.map((p) => p.x)),
  y1: Math.max(...points.map((p) => p.y)),
});

/**
 * Rejoin the pieces of one drawn stroke: repeatedly join the two pieces whose ends lie closest,
 * while that gap is under REJOIN.
 * @param {{ x: number, y: number }[][]} pieces
 */
function rejoin(pieces) {
  const out = pieces.map((p) => p.slice());
  for (;;) {
    let best = { d: REJOIN, i: -1, j: -1, flipI: false, flipJ: false };
    for (let i = 0; i < out.length; i += 1)
      for (let j = i + 1; j < out.length; j += 1)
        for (const flipI of [false, true])
          for (const flipJ of [false, true]) {
            const a = flipI
              ? out[i][0]
              : /** @type {{x:number,y:number}} */ (out[i].at(-1));
            const b = flipJ
              ? /** @type {{x:number,y:number}} */ (out[j].at(-1))
              : out[j][0];
            const d = Math.hypot(a.x - b.x, a.y - b.y);
            if (d < best.d) best = { d, i, j, flipI, flipJ };
          }
    if (best.i === -1) return out;
    const head = best.flipI ? out[best.i].slice().reverse() : out[best.i];
    const tail = best.flipJ ? out[best.j].slice().reverse() : out[best.j];
    out[best.i] = [...head, ...tail];
    out.splice(best.j, 1);
  }
}

/** @param {{ x: number, y: number }[]} points */
const lengthOf = (points) =>
  points.reduce(
    (t, p, i) =>
      i === 0
        ? 0
        : t + Math.hypot(p.x - points[i - 1].x, p.y - points[i - 1].y),
    0,
  );

/**
 * The box a drawn ring encloses: the cyan's rows, less any narrow rows above the ring — the shaft of
 * an arrow drawn off it — so the box is the ring's own.
 * @param {Uint8Array} mask @param {number} width @param {number} height
 */
function ringedBox(mask, width, height) {
  /** @type {{ y: number, x0: number, x1: number }[]} */
  const rows = [];
  for (let y = 0; y < height; y += 1) {
    let x0 = -1;
    let x1 = -1;
    for (let x = 0; x < width; x += 1)
      if (mask[y * width + x] === 1) {
        if (x0 < 0) x0 = x;
        x1 = x;
      }
    if (x0 >= 0) rows.push({ y, x0, x1 });
  }
  const widest = Math.max(...rows.map((r) => r.x1 - r.x0));
  const ring = rows.slice(rows.findIndex((r) => r.x1 - r.x0 >= widest / 4));
  return {
    x0: Math.min(...ring.map((r) => r.x0)),
    y0: ring[0].y,
    x1: Math.max(...ring.map((r) => r.x1)),
    y1: /** @type {{ y: number }} */ (ring.at(-1)).y,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const [drawnDir] = flags(args, "drawn");
  const [sentDir] = flags(args, "sent");
  const [out = "assets/thread"] = flags(args, "out");
  const [overlays] = flags(args, "overlays");
  const refit = flags(args, "refit-rings");
  const moves = new Map(
    flags(args, "move").map((m) => {
      const [file, dy] = m.split(":");
      return [file, Number(dy)];
    }),
  );
  if (!drawnDir || !sentDir)
    throw new Error(
      "usage: node scripts/thread/import-pen-marks.mjs --drawn=<dir> --sent=<dir> [--move=<crop.png>:<dy>]... [--overlays=<dir>] [--out=assets/thread]",
    );
  /** @type {Crop[]} */
  const crops = JSON.parse(readFileSync(`${sentDir}/crops.json`, "utf8"));
  if (overlays) mkdirSync(overlays, { recursive: true });

  /* A Celebrations mark spreads to every photo state (the owner drew a repeated mistake on one or
     two only). Any other section's mark holds for the states its crop shows, plus each state no
     crop of that section shows, which takes the crop nearest in strip count. */
  const all = Array.from({ length: 16 }, (_, n) =>
    n.toString(2).padStart(4, "0"),
  );
  const strips = (/** @type {string} */ c) =>
    [...c].filter((x) => x === "1").length;
  /** @type {Map<Crop, string[]>} */
  const statesOf = new Map(crops.map((c) => [c, c.states.slice()]));
  for (const crop of crops) {
    if (crop.section === "celebrations") continue;
    const siblings = crops.filter(
      (c) => c.band === crop.band && c.section === crop.section,
    );
    for (const c of all) {
      if (siblings.some((s) => s.states.includes(c))) continue;
      const rank = (/** @type {Crop} */ s) =>
        Math.min(
          ...s.states.map(
            (x) =>
              Math.abs(strips(x) - strips(c)) * 10 +
              (strips(x) > strips(c) ? 1 : 0),
          ),
        );
      const nearest = siblings.reduce((a, b) => (rank(b) < rank(a) ? b : a));
      if (nearest === crop)
        /** @type {string[]} */ (statesOf.get(crop)).push(c);
    }
  }

  /** @type {Record<string, { strokes: Stroke[], zones: Zone[], moves: Move[] }>} */
  const pens = {};
  for (const crop of crops) {
    const name = crop.file.split("/").at(-1) ?? crop.file;
    const layout = JSON.parse(
      readFileSync(`${out}/${crop.band}/photo-layout.json`, "utf8"),
    );
    const removed = removedIn(crop.source);
    const sent = await sharp(`${sentDir}/${name}`)
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const drawn = await sharp(`${drawnDir}/${name}`)
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const { width, height } = sent.info;
    if (drawn.info.width !== width || drawn.info.height !== height)
      throw new Error(
        `${name}: drawn ${drawn.info.width}x${drawn.info.height}, sent ${width}x${height}`,
      );
    const { magenta, cyan } = penMask(sent.data, drawn.data, 3);
    /** crop px → this crop's state page → the drawn page */
    const toPage = (/** @type {number} */ x, /** @type {number} */ y) =>
      toDrawn(
        { x: x / crop.dpr, y: y / crop.dpr + crop.pageTop },
        layout,
        removed,
      );
    pens[crop.band] ??= { strokes: [], zones: [], moves: [] };
    const pen = pens[crop.band];

    /** @type {{ x: number, y: number }[][]} crop-px centrelines, for the overlay */
    const traced = [];
    const pieces = components({ ink: magenta, width, height })
      .map((piece) => walkThrough(pruneSpurs(thin(piece), { fraction: 0.04 })))
      .filter((trail) => trail.length >= 2);
    let flecks = 0;
    for (const trail of rejoin(pieces)) {
      const points = simplify(
        trail.map((p) => toPage(p.x, p.y)),
        TOLERANCE,
      ).map((p) => ({ x: round(p.x), y: round(p.y) }));
      const corners = cornersOf(points);
      if (lengthOf(points) < FLECK) {
        flecks += 1;
        continue;
      }
      traced.push(trail);
      pen.strokes.push({
        group: -1,
        states: /** @type {string[]} */ (statesOf.get(crop)),
        ...(crop.section === "celebrations" ? { spread: true } : {}),
        points,
        ...(corners.length > 0 ? { corners } : {}),
      });
    }
    const blobs = zonesOf(cyan, width, height);
    const zonesHere = [];
    if (moves.has(name)) {
      const box = ringedBox(cyan, width, height);
      const a = toPage(box.x0, box.y0);
      const b = toPage(box.x1, box.y1);
      pen.moves.push({
        box: { x0: round(a.x), y0: round(a.y), x1: round(b.x), y1: round(b.y) },
        dy: /** @type {number} */ (moves.get(name)),
        ease: 60,
      });
    } else
      for (const blob of blobs) {
        const c = toPage(blob.x, blob.y);
        const zone = {
          group: -1,
          states: /** @type {string[]} */ (statesOf.get(crop)),
          ...(crop.section === "celebrations" ? { spread: true } : {}),
          x: round(c.x),
          y: round(c.y),
          r: round(blob.r / crop.dpr),
        };
        pen.zones.push(zone);
        zonesHere.push(blob);
      }
    console.log(
      `${name}: ${traced.length} stroke(s)${flecks ? ` (+${flecks} fleck(s) dropped)` : ""}, ${zonesHere.length} zone(s)${moves.has(name) ? ", 1 move" : ""} — states ${crop.states.join(" ")}`,
    );

    if (overlays && (traced.length > 0 || blobs.length > 0)) {
      const lines = traced
        .map(
          (t) =>
            `<polyline points="${t.map((p) => `${p.x},${p.y}`).join(" ")}" fill="none" stroke="#0b1d6b" stroke-width="3"/>`,
        )
        .join("");
      const rings = blobs
        .map(
          (b) =>
            `<circle cx="${b.x}" cy="${b.y}" r="${b.r}" fill="none" stroke="#0b1d6b" stroke-width="3" stroke-dasharray="10 6"/>`,
        )
        .join("");
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${lines}${rings}</svg>`;
      await sharp(`${drawnDir}/${name}`)
        .composite([{ input: Buffer.from(svg) }])
        .png()
        .toFile(`${overlays}/${name}`);
    }
  }

  for (const [band, pen] of Object.entries(pens)) {
    const sGroups = groupsOf(pen.strokes.map((s) => boxOf(s.points)));
    pen.strokes.forEach((s, i) => {
      s.group = sGroups[i];
    });
    const zGroups = groupsOf(
      pen.zones.map((z) => ({
        x0: z.x - z.r,
        y0: z.y - z.r,
        x1: z.x + z.r,
        y1: z.y + z.r,
      })),
    );
    pen.zones.forEach((z, i) => {
      z.group = zGroups[i];
    });
    if (refit.includes(band)) Object.assign(pen, { refitRings: true });
    checkPen(band, pen);
    writeFileSync(
      `${out}/${band}/pen.json`,
      `${JSON.stringify(pen, null, 2)}\n`,
    );
    console.log(
      `${band}: ${pen.strokes.length} strokes in ${new Set(sGroups).size} groups, ${pen.zones.length} zones in ${new Set(zGroups).size} groups, ${pen.moves.length} moves`,
    );
  }
}

await main();
