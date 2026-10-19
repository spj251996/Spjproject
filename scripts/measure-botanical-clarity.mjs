/* Raster clarity: delivered pixels ÷ rendered CSS pixels, per piece per tier. 2x is the bar (a
   retina screen at the size the piece actually renders). A shortfall is named with the source
   ceiling that caused it, never rounded away — a source cannot be upscaled past itself.
 *
 * Run it when new botanical art arrives — it is what decides whether a piece clears the bar, and
 * it prints which pieces sit AT SOURCE CEILING (`DESIGN.md` → Iteration Notes → Known Gaps): no code
 * change lifts those, only larger source art.
 *
 *   node scripts/measure-botanical-clarity.mjs
 *
 * Reads the sources in `assets/botanical/` against the delivered rasters in `public/botanical/`,
 * at the sizes `components/background/botanical-tuning.ts` renders each piece. */

import { existsSync } from "node:fs";
import sharp from "sharp";
import { TUNING } from "../components/background/botanical-tuning.ts";
import { FILE_TIER } from "./generate-images.mjs";

/**
 * @typedef {{ piece: string, file: string, note: "NO FILE" }} MissingRow
 * @typedef {{
 *   piece: string,
 *   file: string,
 *   note?: undefined,
 *   sourceWidth: number | null | undefined,
 *   delivered: number | undefined,
 *   rendered: number,
 *   ratio: number,
 *   capped: boolean,
 * }} MeasuredRow
 */
/** @type {(MissingRow | MeasuredRow)[]} */
const rows = [];
for (const [piece, tiers] of Object.entries(TUNING)) {
  const source = ["png", "webp"]
    .map((ext) => `assets/botanical/${piece}.${ext}`)
    .find((path) => existsSync(path));
  const sourceWidth = source ? (await sharp(source).metadata()).width : null;
  for (const [file, { widest, tuning }] of Object.entries(FILE_TIER)) {
    const path = `public/botanical/${piece}-${file}.avif`;
    if (!existsSync(path)) {
      rows.push({ piece, file, note: "NO FILE" });
      continue;
    }
    const delivered = (await sharp(path).metadata()).width;
    const size = tiers[tuning].size;
    const rendered = (size / 100) * widest;
    const ratio = delivered / rendered;
    rows.push({
      piece,
      file,
      sourceWidth,
      delivered,
      rendered: Math.round(rendered),
      ratio,
      capped: sourceWidth !== null && delivered >= sourceWidth,
    });
  }
}

/** @type {Map<string, MeasuredRow>} */
const worst = new Map();
for (const r of rows) {
  if (r.note) continue;
  const at = worst.get(r.piece);
  if (at === undefined || r.ratio < at.ratio) worst.set(r.piece, r);
}
console.log(
  "piece                 source   worst tier   delivered  rendered  ratio   note",
);
for (const [piece, r] of [...worst].sort((a, b) => a[1].ratio - b[1].ratio)) {
  const note =
    r.ratio >= 1.995 ? "" : r.capped ? "AT SOURCE CEILING" : "regenerate";
  console.log(
    `${piece.padEnd(21)} ${String(r.sourceWidth).padStart(5)}   ${r.file.padEnd(11)} ${String(r.delivered).padStart(8)}  ${String(r.rendered).padStart(8)}  ${r.ratio.toFixed(2)}x  ${note}`,
  );
}
