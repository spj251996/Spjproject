import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("./celebrations.tsx", import.meta.url),
  "utf8",
);
const rowSource = readFileSync(
  new URL("../../components/ui/gallery/photo-row.tsx", import.meta.url),
  "utf8",
);

test("the section reads its photographs from the generated manifest, not from content", () => {
  assert.match(source, /from "@\/content\/ritual-photos\.generated"/);
  assert.ok(
    !source.includes("ritual.images"),
    "`images` left the content layer in Phase 8; the manifest is the only source",
  );
});

test("every display path the strip is given has a thumbnail beside it", () => {
  /* The strip renders the 600px copy and the overlay the 1000px one. A display path with no thumb
     would fall back to the full file in a 150px tile — about 250KB where 50 was budgeted, and
     invisible on screen. The generator emits them in pairs, so this asserts the section does not
     lose one on the way through. */
  assert.match(source, /thumbs=\{photoThumbs\}/);
  /* And the viewer copy beside it: without it the full-screen view falls back to the grid's
     1000px file, soft once stretched to a phone's full height. */
  assert.match(source, /fulls=\{photoFulls\}/);
  /* The derivation is `ritualPhotoProps`'s, and its own tests carry the behaviour
     (`ritual-photo-props.test.ts`); this asserts only that the section uses it. */
  assert.match(source, /ritualPhotoProps\(rituals, ritualPhotos\)/);
  /* And the frame must actually PAINT the thumbnail: the section handing the map down proves
     nothing if the row's <img> still reads the display path it is keyed on. */
  assert.match(rowSource, /src=\{thumbs\[src\] \?\? src\}/);
});

test("a ritual with an empty set renders no strip, no cue and no action", () => {
  /* A STRUCTURAL claim, deliberately: the gate is JSX and cannot be exercised without rendering the
     section. The list it reads is behaviour-tested in `ritual-photo-props.test.ts`.

     A ritual directory can exist and hold nothing — the generator emits an empty array for it
     rather than omitting the key, so the trigger must read the LIST'S LENGTH and not the key's
     presence. `ritualPhotos[id] && ...` would render an empty strip with a gallery action that
     opens on nothing. */
  assert.match(source, /photoSets\[ritual\.id\]\.length > 0 && \(/);
  assert.ok(
    !source.includes("ritualPhotos[ritual.id] &&"),
    "the trigger is the list's length, never the manifest key's presence",
  );
});
