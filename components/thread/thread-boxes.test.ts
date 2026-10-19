import assert from "node:assert/strict";
import { test } from "node:test";
import { THREAD_BANDS } from "./thread-bands.ts";
import { sectionBox } from "./thread-boxes.ts";
import type { ThreadId } from "./thread-geometry.ts";

const SECTIONS: readonly ThreadId[] = [
  "invite",
  "event-info",
  "family",
  "celebrations",
  "wishes",
];

test("celebrations is measured taller than the band's own nominal box, at wide", () => {
  const box = sectionBox("celebrations", "wide");
  assert.equal(box.width, 1536);
  /* Re-measured three times: when the five-ritual section replaced the placeholder (1320 was the
     placeholder's), when the first two rituals gained their temporary photographs, and on
     2026-10-10 when each Malayalam moved onto its own line and the alternating band gave way to
     one full-width column at every tier, and again on 2026-10-11 when the rituals went left-aligned
     on one header line with a smaller title. The photo-free base is 1513 at this band and each
     ritual with photographs adds a constant +190 since a photographed ritual closes to 24px from
     64rem (2026-10-11). The test photographs came out on 2026-10-14, so this is the base; each
     ritual's first real upload adds 190.
     It is still the point of this test that it exceeds the band's 695. */
  assert.equal(box.height, 1513);
  assert.ok(box.height > 695);
});

test("invite keeps the wide band's own nominal height", () => {
  const box = sectionBox("invite", "wide");
  assert.equal(box.width, 1536);
  assert.equal(box.height, 695);
});

test("every band carries a measured box for all five sections", () => {
  for (const band of THREAD_BANDS) {
    for (const id of SECTIONS) {
      const box = sectionBox(id, band.id);
      assert.ok(box.width > 0, `${id}/${band.id} width`);
      assert.ok(box.height > 0, `${id}/${band.id} height`);
    }
  }
});

test("the measured heights match the render exactly", () => {
  assert.deepEqual(sectionBox("invite", "tall"), { width: 393, height: 700 });
  assert.deepEqual(sectionBox("event-info", "tall"), {
    width: 393,
    height: 1400,
  });
  assert.deepEqual(sectionBox("family", "tall"), { width: 393, height: 1400 });
  assert.deepEqual(sectionBox("celebrations", "tall"), {
    width: 393,
    height: 2173,
  });
  assert.deepEqual(sectionBox("wishes", "tall"), { width: 393, height: 700 });

  assert.deepEqual(sectionBox("invite", "upright"), {
    width: 820,
    height: 1180,
  });
  assert.deepEqual(sectionBox("event-info", "upright"), {
    width: 820,
    height: 2360,
  });
  assert.deepEqual(sectionBox("family", "upright"), {
    width: 820,
    height: 2360,
  });
  assert.deepEqual(sectionBox("celebrations", "upright"), {
    width: 820,
    height: 2262,
  });
  assert.deepEqual(sectionBox("wishes", "upright"), {
    width: 820,
    height: 1180,
  });

  assert.deepEqual(sectionBox("invite", "wide"), { width: 1536, height: 695 });
  assert.deepEqual(sectionBox("event-info", "wide"), {
    width: 1536,
    height: 695,
  });
  assert.deepEqual(sectionBox("family", "wide"), { width: 1536, height: 695 });
  assert.deepEqual(sectionBox("celebrations", "wide"), {
    width: 1536,
    height: 1513,
  });
  assert.deepEqual(sectionBox("wishes", "wide"), { width: 1536, height: 695 });
});

/* A one-screen section is exactly its band's nominal box, so `invite` and `wishes` tie each box's
   height here as the width does for every section. */
test("every section box is its band's width, and a one-screen section its band's height", () => {
  for (const band of THREAD_BANDS) {
    for (const id of [
      "invite",
      "event-info",
      "family",
      "celebrations",
      "wishes",
    ] as const) {
      assert.equal(
        sectionBox(id, band.id).width,
        band.box.width,
        `${id}/${band.id} width`,
      );
    }
    for (const id of ["invite", "wishes"] as const) {
      assert.equal(
        sectionBox(id, band.id).height,
        band.box.height,
        `${id}/${band.id} height`,
      );
    }
  }
});
