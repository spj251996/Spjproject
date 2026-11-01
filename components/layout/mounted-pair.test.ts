import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/* Comments are stripped so a constant's own comment cannot satisfy a match against its value. */
const pairSource = readFileSync(
  "components/layout/mounted-pair.tsx",
  "utf8",
).replace(/\/\*[\s\S]*?\*\//g, "");
const gallerySource = readFileSync(
  "app/design-system/_sections/domain.tsx",
  "utf8",
);

function constantValue(name: string): string {
  const match = pairSource.match(
    new RegExp(`const ${name} =\\s*(?:\`([^\`]*)\`|"([^"]*)");`),
  );
  assert.ok(match, `mounted-pair.tsx no longer defines ${name} as a string`);
  const value = match[1] ?? match[2] ?? "";
  return name === "CARD_CORNERS"
    ? value
    : value.replace(/\$\{CARD_CORNERS\}/g, constantValue("CARD_CORNERS"));
}

function classes(value: string): string[] {
  return value.split(/\s+/).filter(Boolean);
}

/* The Family specimen's sheet is a hand-typed copy of the unfitted pair's sheet, because the gallery
   shows the stacked form only. The classes the copy keeps must be the ones the pair has, and the
   ones it drops are named, so a class added to or changed in either file fails here. */
test("the Family specimen's sheet carries the classes of the pair's unfitted sheet", () => {
  const pairClasses = [
    ...classes(constantValue("UNFITTED_SHEET")),
    ...classes(constantValue("UNFITTED_SHEET_PAINT")),
  ];

  const specimen = gallerySource.match(
    /<div\s+className="([^"]*)"\s+key=\{group\.id\}\s*>\s*<Family/,
  );
  assert.ok(specimen, "the Family specimen's sheet wrapper was not found");
  const specimenClasses = classes(specimen[1] ?? "");

  const matched = specimenClasses.filter((name) => pairClasses.includes(name));
  assert.ok(matched.length > 0, "no specimen class matched the pair's classes");
  assert.deepEqual(
    specimenClasses.filter((name) => !pairClasses.includes(name)),
    [],
    "the specimen carries a class the pair's unfitted sheet does not",
  );

  const dropped = pairClasses.filter((name) => !specimenClasses.includes(name));
  assert.deepEqual(
    dropped.sort(),
    ["flex-1", "md:shadow-stock", "relative"],
    "the specimen drops the flex slot, the crease stacking and the side-by-side cast, and nothing else",
  );
});
