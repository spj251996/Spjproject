import assert from "node:assert/strict";
import { test } from "node:test";
import { withoutSection } from "./thread-without-section.mjs";

const order = ["a", "gone", "b"];
const sections = [
  { top: 0, height: 100 },
  { top: 100, height: 50 },
  { top: 150, height: 100 },
];
const attachments = [
  { section: "a", motif: "m", which: "entry", x: 10, y: 40 },
  { section: "a", motif: "m", which: "exit", x: 10, y: 60 },
  { section: "gone", motif: "p", which: "entry", x: 20, y: 120 },
  { section: "gone", motif: "p", which: "exit", x: 20, y: 130 },
  { section: "b", motif: "n", which: "entry", x: 30, y: 200 },
  { section: "b", motif: "n", which: "exit", x: 30, y: 220 },
];
const connectors = [
  {
    connector: 0,
    points: [
      { x: 10, y: 0 },
      { x: 10, y: 40 },
    ],
  },
  {
    connector: 1,
    points: [
      { x: 10, y: 60 },
      { x: 15, y: 90 },
      { x: 20, y: 120 },
    ],
  },
  {
    connector: 2,
    points: [
      { x: 20, y: 130 },
      { x: 25, y: 170 },
      { x: 30, y: 200 },
    ],
  },
  {
    connector: 3,
    points: [
      { x: 30, y: 220 },
      { x: 30, y: 250 },
    ],
  },
];

test("drops the section's motifs and joins the connectors around it into one", () => {
  const out = withoutSection({
    sections,
    attachments,
    connectors,
    order,
    id: "gone",
  });
  assert.deepEqual(out.order, ["a", "b"]);
  assert.deepEqual(out.sections, [
    { top: 0, height: 100 },
    { top: 100, height: 100 },
  ]);
  assert.equal(out.attachments.length, 4);
  assert.ok(out.attachments.every((a) => a.section !== "gone"));
  assert.equal(out.connectors.length, 3);
  assert.deepEqual(out.connectors[1].points, [
    { x: 10, y: 60 },
    { x: 15, y: 90 },
    { x: 25, y: 120 },
    { x: 30, y: 150 },
  ]);
});

test("moves everything below the section up by its height", () => {
  const out = withoutSection({
    sections,
    attachments,
    connectors,
    order,
    id: "gone",
  });
  assert.deepEqual(out.attachments[2], {
    section: "b",
    motif: "n",
    which: "entry",
    x: 30,
    y: 150,
  });
  assert.deepEqual(out.connectors[2].points, [
    { x: 30, y: 170 },
    { x: 30, y: 200 },
  ]);
});

/* The wide band's attachments carry their section's own `top` beside their point, so it must move
   with the section — a stale `top` would place every later motif against the old boundary. */
test("an attachment's own section top moves with its section", () => {
  const withTops = attachments.map((a) => ({
    ...a,
    top: sections[order.indexOf(a.section)].top,
  }));
  const out = withoutSection({
    sections,
    attachments: withTops,
    connectors,
    order,
    id: "gone",
  });
  assert.deepEqual(
    out.attachments.map((a) => a.top),
    [0, 0, 100, 100],
  );
});

test("a margin drops the drawn points nearest the seam on both sides", () => {
  const out = withoutSection({
    sections,
    attachments,
    connectors,
    order,
    id: "gone",
    margin: 15,
  });
  assert.deepEqual(out.connectors[1].points, [
    { x: 10, y: 60 },
    { x: 25, y: 120 },
    { x: 30, y: 150 },
  ]);
});

test("refuses a join with no drawn points on one side", () => {
  const bare = connectors.map((c, i) =>
    i === 2 ? { ...c, points: [{ x: 20, y: 130 }] } : c,
  );
  assert.throws(
    () =>
      withoutSection({
        sections,
        attachments,
        connectors: bare,
        order,
        id: "gone",
      }),
    /no drawn points below/,
  );
});
