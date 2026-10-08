import assert from "node:assert/strict";
import { test } from "node:test";
import {
  authoredCard,
  familyPortraitFractions,
} from "./thread-authored-layout.ts";
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

test("every band carries an authored card for all six sections", () => {
  for (const band of THREAD_BANDS) {
    for (const id of SECTIONS) {
      const card = authoredCard(id, band.id);
      assert.ok(card.cardWidth > 0, `${id}/${band.id} cardWidth`);
      assert.ok(card.cardLeft >= 0, `${id}/${band.id} cardLeft`);
      assert.ok(card.sectionHeight > 0, `${id}/${band.id} sectionHeight`);
    }
  }
});

test("not-found resolves to the invite's authored card in every band", () => {
  for (const band of THREAD_BANDS) {
    assert.deepEqual(
      authoredCard("not-found", band.id),
      authoredCard("invite", band.id),
    );
  }
});

test("the recorded section heights reproduce thread-boxes.ts's sectionBox exactly", () => {
  for (const band of THREAD_BANDS) {
    for (const id of SECTIONS) {
      const recorded = authoredCard(id, band.id).sectionHeight;
      const box = sectionBox(id, band.id).height;
      assert.equal(
        recorded,
        box,
        `${id}/${band.id}: authored ${recorded} vs sectionBox ${box}`,
      );
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
  assert.deepEqual(authoredCard("contact", "tall"), {
    cardWidth: 361,
    cardLeft: 16,
    sectionHeight: 700,
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
    sectionHeight: 2668,
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
  assert.equal(authoredCard("event-info", "upright").sectionHeight, 2360);
  assert.equal(authoredCard("celebrations", "upright").sectionHeight, 2676);
});

test("wide band's authored cards, measured on the real render at 1536x695", () => {
  for (const id of SECTIONS) {
    const card = authoredCard(id, "wide");
    assert.equal(card.cardWidth, 960, id);
    assert.equal(card.cardLeft, 288, id);
  }
  assert.equal(authoredCard("celebrations", "wide").sectionHeight, 1948);
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
