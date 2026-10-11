import assert from "node:assert/strict";
import test from "node:test";
import { ritualPhotoProps } from "./ritual-photo-props.ts";

const photo = (name: string, width: number, height: number) => ({
  thumb: `/rituals/r/${name}-600.avif`,
  display: `/rituals/r/${name}-1000.avif`,
  width,
  height,
});

test("every ritual gets a set, empty where its folder holds nothing or is absent", () => {
  const { sets } = ritualPhotoProps([{ id: "a" }, { id: "b" }, { id: "c" }], {
    a: [photo("x", 1000, 562)],
    b: [],
  });
  assert.deepEqual(sets, { a: ["/rituals/r/x-1000.avif"], b: [], c: [] });
});

test("aspects and thumbnails are keyed on the display path, from the measured dimensions", () => {
  const { aspects, thumbs } = ritualPhotoProps([{ id: "a" }], {
    a: [photo("p", 512, 911)],
  });
  assert.deepEqual(aspects, { "/rituals/r/p-1000.avif": 512 / 911 });
  assert.deepEqual(thumbs, {
    "/rituals/r/p-1000.avif": "/rituals/r/p-600.avif",
  });
});

test("a manifest key for a ritual that no longer exists is ignored", () => {
  const { sets, aspects } = ritualPhotoProps([{ id: "a" }], {
    gone: [photo("g", 10, 10)],
  });
  assert.deepEqual(sets, { a: [] });
  assert.deepEqual(aspects, {});
});
