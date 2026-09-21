import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
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

/* The clip box added for the sideways-scroll fix is one `overflow-x` away from being the bug it
   fixes: `contain: paint` clips identically and creates a stacking context, which isolates
   `mix-blend-mode: multiply` so every piece composites its opaque white ground as a visible
   rectangle — with no error, and lint, types, tests and the build all green. Only a rendered pixel
   shows it, so the property choice is asserted here instead. */
test("the botanical clip box clips by overflow alone and creates no stacking context", () => {
  const css = readFileSync(
    path.join(import.meta.dirname, "botanical.module.css"),
    "utf8",
  );
  const body = /\.clip \{([^}]*)\}/.exec(css)?.[1];
  assert.ok(body, "no .clip rule found in botanical.module.css");
  assert.match(body, /overflow-x:\s*clip/);
  /* Paired with an explicit `visible`, so the block axis stays unclipped and a piece may still
     straddle a section boundary. */
  assert.match(body, /overflow-y:\s*visible/);
  for (const property of [
    /isolation\s*:/,
    /contain\s*:/,
    /transform\s*:/,
    /opacity\s*:/,
    /filter\s*:/,
    /content-visibility\s*:/,
    /z-index\s*:/,
    /overflow(-x|-y)?\s*:\s*hidden/,
  ]) {
    assert.ok(
      !property.test(body),
      `.clip carries a blend-isolating or both-axis-clipping property (${property}): ${body}`,
    );
  }
});
