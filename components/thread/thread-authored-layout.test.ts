import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  authoredCard,
  familyPortraitFractions,
} from "./thread-authored-layout.ts";
import { THREAD_BANDS } from "./thread-bands.ts";
import type { ThreadId } from "./thread-geometry.ts";

const SECTIONS: readonly ThreadId[] = [
  "invite",
  "event-info",
  "family",
  "celebrations",
  "wishes",
];

test("every band carries an authored card for all five sections", () => {
  for (const band of THREAD_BANDS) {
    for (const id of SECTIONS) {
      const card = authoredCard(id, band.id);
      assert.ok(card.cardWidth > 0, `${id}/${band.id} cardWidth`);
      assert.ok(card.cardLeft >= 0, `${id}/${band.id} cardLeft`);
      assert.ok(card.sectionHeight > 0, `${id}/${band.id} sectionHeight`);
    }
  }
});

test("tall band's authored cards, measured on the real render at 393x700", () => {
  assert.deepEqual(authoredCard("invite", "tall"), {
    cardWidth: 361,
    cardLeft: 16,
    sectionHeight: 700,
  });
  assert.deepEqual(authoredCard("event-info", "tall"), {
    cardWidth: 361,
    cardLeft: 16,
    sectionHeight: 1400,
  });
  assert.deepEqual(authoredCard("family", "tall"), {
    cardWidth: 361,
    cardLeft: 16,
    sectionHeight: 1400,
  });
  // Celebrations is "tall" mode (no fit), so its padding chain differs from every fitted card.
  assert.deepEqual(authoredCard("celebrations", "tall"), {
    cardWidth: 345,
    cardLeft: 24,
    sectionHeight: 1895,
  });
  assert.deepEqual(authoredCard("wishes", "tall"), {
    cardWidth: 361,
    cardLeft: 16,
    sectionHeight: 700,
  });
});

test("upright band's authored cards, measured on the real render at 820x1180", () => {
  for (const id of SECTIONS) {
    const card = authoredCard(id, "upright");
    assert.equal(card.cardWidth, 564, id);
    assert.equal(card.cardLeft, 128, id);
  }
  assert.equal(authoredCard("invite", "upright").sectionHeight, 1180);
  assert.equal(authoredCard("event-info", "upright").sectionHeight, 2360);
  assert.equal(authoredCard("family", "upright").sectionHeight, 2360);
  assert.equal(authoredCard("celebrations", "upright").sectionHeight, 1968);
  assert.equal(authoredCard("wishes", "upright").sectionHeight, 1180);
});

test("wide band's authored cards, measured on the real render at 1536x695", () => {
  for (const id of SECTIONS) {
    const card = authoredCard(id, "wide");
    assert.equal(card.cardWidth, 960, id);
    assert.equal(card.cardLeft, 288, id);
  }
  assert.equal(authoredCard("invite", "wide").sectionHeight, 695);
  assert.equal(authoredCard("event-info", "wide").sectionHeight, 695);
  assert.equal(authoredCard("family", "wide").sectionHeight, 695);
  assert.equal(authoredCard("celebrations", "wide").sectionHeight, 1339);
  assert.equal(authoredCard("wishes", "wide").sectionHeight, 695);
});

test("Flemy's and Sebastian's portrait centres are recorded for every band, as a fraction of the family card", () => {
  for (const band of THREAD_BANDS) {
    const { flemy, sebastian } = familyPortraitFractions(band.id);
    for (const point of [flemy, sebastian]) {
      assert.ok(point.x >= 0 && point.x <= 1, `${band.id} x in [0,1]`);
      assert.ok(point.y >= 0 && point.y <= 1, `${band.id} y in [0,1]`);
    }
  }
});

/* The fallback when a portrait cannot be found on the page: it must still put each ring on its own
   person. The drawn page lists its portraits in page order — the bride's family, the bride third, then
   the groom's, the groom last. */
test("the fallback portrait fractions land on Flemy's and Sebastian's own photos at the authored size", () => {
  for (const band of THREAD_BANDS) {
    const layout = JSON.parse(
      readFileSync(`assets/thread/${band.id}/photo-layout.json`, "utf8"),
    ) as {
      portraits: { x: number; y: number }[];
      sections: { id: string; top: number }[];
    };
    const top = layout.sections.find((s) => s.id === "family")?.top ?? 0;
    const card = authoredCard("family", band.id);
    const { flemy, sebastian } = familyPortraitFractions(band.id);
    const people = [
      [flemy, layout.portraits[2]],
      [sebastian, layout.portraits[layout.portraits.length - 1]],
    ] as const;
    for (const [fraction, photo] of people) {
      const x = card.cardLeft + fraction.x * card.cardWidth;
      const y = fraction.y * card.sectionHeight;
      assert.ok(
        Math.hypot(x - photo.x, y - (photo.y - top)) < 1,
        `${band.id}: the fallback lands at (${x.toFixed(1)}, ${y.toFixed(1)}), the photo is at (${photo.x}, ${(photo.y - top).toFixed(1)})`,
      );
    }
  }
});
