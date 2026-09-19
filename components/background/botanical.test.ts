import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import sharp from "sharp";
import {
  MEADOW_NATURAL_HEIGHT,
  MEADOW_NATURAL_WIDTH,
} from "./botanical-meadow.ts";

/* `MEADOW_NATURAL_WIDTH`/`MEADOW_NATURAL_HEIGHT` feed the meadow band's CSS crop
   (`botanical.module.css` → `.meadow-band`'s `aspect-ratio`), read once from the shipped file rather
   than typed as a bare fraction. This re-reads every shipped tier's own file and asserts they still
   agree, so a regenerated file that changes the crop fails here instead of silently mis-cropping the
   page — `lessons.md`, 2026-09-18: "DERIVE or ASSERT... so a regenerated file cannot silently break
   it." */

const BOTANICAL_DIR = path.join(
  import.meta.dirname,
  "..",
  "..",
  "public",
  "botanical",
);
const TOLERANCE = 0.01;

test("every shipped meadow-band tier matches the natural aspect ratio the CSS crop assumes", async () => {
  const expected = MEADOW_NATURAL_WIDTH / MEADOW_NATURAL_HEIGHT;
  const files = readdirSync(BOTANICAL_DIR).filter((file) =>
    file.startsWith("meadow-band-"),
  );
  assert.ok(
    files.length > 0,
    `no meadow-band files found in ${BOTANICAL_DIR} — has npm run images been run?`,
  );
  for (const file of files) {
    const metadata = await sharp(path.join(BOTANICAL_DIR, file)).metadata();
    assert.ok(
      metadata.width !== undefined && metadata.height !== undefined,
      `${file}: sharp returned no dimensions`,
    );
    const actual = (metadata.width as number) / (metadata.height as number);
    const deviation = Math.abs(actual - expected) / expected;
    assert.ok(
      deviation <= TOLERANCE,
      `${file}: aspect ratio ${actual.toFixed(4)} deviates from the assumed ${expected.toFixed(4)} ` +
        `(${MEADOW_NATURAL_WIDTH}/${MEADOW_NATURAL_HEIGHT}) by ${(deviation * 100).toFixed(2)}% — ` +
        "update MEADOW_NATURAL_WIDTH/MEADOW_NATURAL_HEIGHT in botanical-meadow.ts to match the regenerated file",
    );
  }
});
