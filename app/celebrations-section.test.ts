import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync("app/_sections/celebrations.tsx", "utf8");

/* The composition site is a server component, so these are source assertions rather than render
   ones. Each pins a rule with a recorded failure behind it, not merely a line of markup. */

// `images: []` on every ritual is WHAT SHIPS. The section must render no photo row, no
// action, and no client island at all.
test("with no photographs the section renders no preview row and no gallery action", () => {
  assert.ok(
    source.includes("data-thread-row"),
    "the thread's per-row hook must survive",
  );
  assert.ok(
    /ritual\.images\.length\s*>\s*0/.test(source),
    "the photo row must be gated on images being non-empty, not on a status field",
  );
  assert.ok(
    !/RitualStatus|ritual\.status/.test(source),
    "status is gone from the model and must not be read here",
  );
});

test("the leaf precedes both titles in source order", () => {
  /* The owner's rule, and it was broken once: reversing the row to mirror it rendered
     `മധുരംവെപ്പ് Wedding Eve [leaf]`. Source order is what guarantees it, so source order is what
     is asserted — a mirrored row is pushed and aligned by its parent, never reversed. */
  const leaf = source.indexOf("<SprigIcon");
  const english = source.indexOf("{ritual.title}");
  const malayalam = source.indexOf("{ritual.malayalam}");
  assert.ok(leaf !== -1 && english !== -1 && malayalam !== -1);
  assert.ok(leaf < english, "the leaf must come before the English title");
  assert.ok(
    english < malayalam,
    "the English title must come before the Malayalam one",
  );
  assert.ok(
    !/flex-row-reverse/.test(source),
    "a reversed row reverses the leaf too — mirror by justification, never by reversal",
  );
});

test("the Malayalam title takes the Malayalam family, which nothing else does", () => {
  /* A Latin face has no Malayalam glyphs, so a title that misses this token renders as boxes —
     and no gate but this one would see it. */
  const uses = source.match(/font-\(family-name:--font-malayalam\)/g) ?? [];
  assert.equal(
    uses.length,
    1,
    "exactly one element takes the Malayalam family",
  );
  const span = source.indexOf("font-(family-name:--font-malayalam)");
  const malayalam = source.indexOf("{ritual.malayalam}");
  assert.ok(
    span < malayalam && malayalam - span < 400,
    "the family must be on the element that renders the Malayalam string",
  );
});

test("the ritual description takes no reading-measure cap", () => {
  /* The block's own width IS the measure (owner). `max-w-text` on the paragraph held every block
     width above about 65% at an identical 600px paragraph, which made the width decision dead. */
  const list = source.indexOf("CELEBRATIONS_LIST_CLASS}");
  const listEnd = source.indexOf("</ol>", list);
  assert.ok(list !== -1 && listEnd > list);
  /* Only `className` values are read, not the whole slice: the prose beside this markup names
     `max-w-text` to say it is deliberately absent, and a plain substring search matched that
     comment and failed on correct code. */
  const classNames =
    source.slice(list, listEnd).match(/className="[^"]*"/g) ?? [];
  assert.ok(classNames.length > 0, "the slice must contain some className");
  for (const value of classNames) {
    assert.ok(
      !value.includes("max-w-text"),
      `no reading-measure cap inside the ritual list: ${value}`,
    );
  }
});
