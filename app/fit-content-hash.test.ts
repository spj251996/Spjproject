import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";
import {
  CONTENT_HASH_PATTERN,
  contentHash,
  FIT_CONTENT,
} from "../scripts/fit-content.ts";

const FIT_SUFFIX = "-fit.ts";

const fitSections = readdirSync("app")
  .filter((name) => name.endsWith(FIT_SUFFIX))
  .map((name) => name.slice(0, -FIT_SUFFIX.length))
  .sort();

test("FIT_CONTENT covers exactly the measured fits", () => {
  assert.equal(
    fitSections.length,
    5,
    "the number of measured fits changed — update this count deliberately",
  );
  assert.deepEqual(Object.keys(FIT_CONTENT).sort(), fitSections);
});

for (const section of fitSections) {
  test(`${section}-fit.ts was measured against the content it renders now`, () => {
    const file = readFileSync(`app/${section}${FIT_SUFFIX}`, "utf8");
    const recorded = file.match(CONTENT_HASH_PATTERN)?.[1];
    assert.ok(
      recorded !== undefined,
      `app/${section}${FIT_SUFFIX} records no content hash — re-run \`npm run measure:fit\` for it`,
    );
    const values = FIT_CONTENT[section];
    assert.ok(values !== undefined, `no FIT_CONTENT entry for "${section}"`);
    assert.equal(
      recorded,
      contentHash(values),
      `the content app/${section}${FIT_SUFFIX} renders has changed since it was measured — re-run \`npm run measure:fit\` for it, then \`npm run frames\``,
    );
  });
}
