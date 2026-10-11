/* Raster clarity: delivered pixels ÷ rendered CSS pixels, per piece per tier. 2x is the bar (a
   retina screen at the size the piece actually renders). A shortfall is named with the source
   ceiling that caused it, never rounded away — a source cannot be upscaled past itself.
 *
 * Run it when new botanical art arrives — it is what decides whether a piece clears the bar, and
 * three pieces currently do not (`DESIGN.md` → Iteration Notes → Known Gaps, recorded as AT THEIR
 * SOURCE CEILING: no code change lifts them, only larger source art).
 *
 *   node scripts/measure-botanical-clarity.mjs
 *
 * Reads the sources in `assets/botanical/` against the delivered rasters in `public/botanical/`,
 * at the sizes `components/background/botanical-tuning.ts` renders each piece. Committed on
 * 2026-10-11; it lived in gitignored `tmp/` while being the cited way to re-derive those figures,
 * which made the citation a dangling pointer for anyone who cloned. */

import { existsSync } from "node:fs";
import sharp from "sharp";
import { TUNING } from "../components/background/botanical-tuning.ts";

/* Each file tier, the widest viewport it has to cover, and the tuning tier whose size decides
   what it renders at. `phoneTablet` covers two tuning tiers, so it is measured against the larger
   of the two. */
const FILE_TIER = {
  phone: { widest: 767, tuning: ["phone"] },
  tablet: { widest: 1366, tuning: ["tablet"] },
  laptop: { widest: 1599, tuning: ["laptop"] },
  desktop: { widest: 1920, tuning: ["desktop"] },
};

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
    const size = Math.max(...tuning.map((t) => tiers[t].size));
    const rendered = piece === "meadow-band" ? widest : (size / 100) * widest;
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
