import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { FRAME_SHEETS, FRAMES_DIR, frameSheetFile } from "./frame-sheets.ts";

/* The committed sheets are generated (`npm run frames`), so a fit or generator change that is not
   regenerated would ship the old frame with every other gate green. */
test("every committed frame sheet equals a fresh generation", () => {
  assert.equal(
    FRAME_SHEETS.length,
    6,
    "the list of frame sheets changed size — update this count deliberately",
  );
  for (const sheet of FRAME_SHEETS) {
    const committed = readFileSync(`${FRAMES_DIR}/${sheet.name}.css`, "utf8");
    assert.ok(
      committed === frameSheetFile(sheet),
      `${FRAMES_DIR}/${sheet.name}.css is stale — run \`npm run frames\``,
    );
  }
});

test("the frames directory holds exactly the listed sheets", () => {
  assert.deepEqual(
    readdirSync(FRAMES_DIR).sort(),
    FRAME_SHEETS.map((sheet) => `${sheet.name}.css`).sort(),
  );
});
