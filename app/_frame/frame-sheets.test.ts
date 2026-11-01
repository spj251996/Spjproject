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

/* Below 20rem only browser zoom (or a screen narrower than 320px) lays the page out, so the frame
   narrows its ground and padding there in one block appended last — last, so it wins every regime
   rule of equal specificity by order. */
const REFLOW_MEDIA = "@media (width < 20rem) {";

test("each sheet ends with exactly one reflow block", () => {
  for (const sheet of FRAME_SHEETS) {
    const committed = readFileSync(`${FRAMES_DIR}/${sheet.name}.css`, "utf8");
    const at = committed.indexOf(REFLOW_MEDIA);
    assert.ok(at > 0, `${sheet.name}.css has no reflow block`);
    assert.equal(
      committed.indexOf(REFLOW_MEDIA, at + 1),
      -1,
      `${sheet.name}.css has more than one reflow block`,
    );
    const block = committed.slice(at);
    assert.match(
      block,
      /^@media \(width < 20rem\) \{\n[^@]*\n\}\n$/,
      `${sheet.name}.css's reflow block is not the last thing in the file`,
    );
  }
});
