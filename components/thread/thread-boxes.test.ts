import assert from "node:assert/strict";
import { test } from "node:test";
import { THREAD_BANDS } from "./thread-bands.ts";
import { sectionBox } from "./thread-boxes.ts";
import type { ThreadId } from "./thread-geometry.ts";

const SECTIONS: readonly ThreadId[] = [
  "invite",
  "event-info",
  "contact",
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
     one full-width column at every tier. The photo-free base is 1666 at this band and each ritual
     with photographs adds a constant +214 — so 1666 + 2 x 214 = 2094, and dropping the
     photographs before main returns it to 1666.
     It is still the point of this test that it exceeds the band's 695. */
  assert.equal(box.height, 2094);
  assert.ok(box.height > 695);
  assert.ok(box.height > 695);
});

test("invite keeps the wide band's own nominal height", () => {
  const box = sectionBox("invite", "wide");
  assert.equal(box.width, 1536);
  assert.equal(box.height, 695);
});

test("every band carries a measured box for all six sections", () => {
  for (const band of THREAD_BANDS) {
    for (const id of SECTIONS) {
      const box = sectionBox(id, band.id);
      assert.ok(box.width > 0, `${id}/${band.id} width`);
      assert.ok(box.height > 0, `${id}/${band.id} height`);
    }
  }
});

test("not-found resolves to the invite's box in every band", () => {
  for (const band of THREAD_BANDS) {
    assert.deepEqual(
      sectionBox("not-found", band.id),
      sectionBox("invite", band.id),
    );
  }
});

test("the measured heights match the render exactly", () => {
  assert.deepEqual(sectionBox("invite", "tall"), { width: 393, height: 700 });
  assert.deepEqual(sectionBox("event-info", "tall"), {
    width: 393,
    height: 1400,
  });
  assert.deepEqual(sectionBox("contact", "tall"), { width: 393, height: 700 });
  assert.deepEqual(sectionBox("family", "tall"), { width: 393, height: 1400 });
  assert.deepEqual(sectionBox("celebrations", "tall"), {
    width: 393,
    height: 2764,
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
  assert.deepEqual(sectionBox("contact", "upright"), {
    width: 820,
    height: 1180,
  });
  assert.deepEqual(sectionBox("family", "upright"), {
    width: 820,
    height: 2360,
  });
  assert.deepEqual(sectionBox("celebrations", "upright"), {
    width: 820,
    height: 2791,
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
  assert.deepEqual(sectionBox("contact", "wide"), { width: 1536, height: 695 });
  assert.deepEqual(sectionBox("family", "wide"), { width: 1536, height: 695 });
  assert.deepEqual(sectionBox("celebrations", "wide"), {
    width: 1536,
    height: 2094,
  });
  assert.deepEqual(sectionBox("wishes", "wide"), { width: 1536, height: 695 });
});
