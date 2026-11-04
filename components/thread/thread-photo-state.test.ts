import assert from "node:assert/strict";
import { test } from "node:test";
import { ritualPhotos } from "../../content/ritual-photos.generated.ts";
import { rituals } from "../../content/rituals.ts";
import { authoredCard } from "./thread-authored-layout.ts";
import {
  PHOTO_STATE_PATHS,
  PHOTO_STRIP,
  THREAD_PATHS,
} from "./thread-paths.ts";
import {
  PHOTO_COMBINATION,
  photographedCount,
  threadPaths,
} from "./thread-photo-state.ts";

test("the combination reads each ritual's photographs, in page order", () => {
  const expected = rituals
    .map((r) => ((ritualPhotos[r.id]?.length ?? 0) > 0 ? "1" : "0"))
    .join("");
  assert.equal(PHOTO_COMBINATION, expected);
  assert.equal(PHOTO_COMBINATION.length, 4);
});

test("a combination takes its own Celebrations and Wishes, and the drawn route elsewhere", () => {
  assert.deepEqual(
    threadPaths("tall", "celebrations", "0000"),
    PHOTO_STATE_PATHS.tall["0000"].celebrations,
  );
  assert.notDeepEqual(
    threadPaths("tall", "celebrations", "0000"),
    THREAD_PATHS.tall.celebrations,
  );
  assert.deepEqual(
    threadPaths("tall", "family", "0000"),
    THREAD_PATHS.tall.family,
  );
  assert.deepEqual(
    threadPaths("wide", "celebrations", "1111"),
    THREAD_PATHS.wide.celebrations,
  );
});

test("Celebrations is authored as tall as its photographed rituals make it", () => {
  assert.equal(photographedCount("1010"), 2);
  const base = authoredCard("celebrations", "upright", "0000").sectionHeight;
  assert.equal(
    authoredCard("celebrations", "upright", "1011").sectionHeight,
    base + 3 * PHOTO_STRIP.upright,
  );
  assert.equal(
    authoredCard("family", "upright", "1111").sectionHeight,
    authoredCard("family", "upright", "0000").sectionHeight,
  );
});
