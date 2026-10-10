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

/* THE RITUAL LIST'S OWN SLICE, and it is load-bearing: `<SprigOrnament>` also wraps the SECTION's
   eyebrow forty lines above, so an unscoped `indexOf` reads the head's ornament and every order
   assertion below passes against the wrong element. */
function ritualList(): string {
  const start = source.indexOf("CELEBRATIONS_LIST_CLASS}");
  assert.notStrictEqual(
    start,
    -1,
    "no ritual list in app/_sections/celebrations.tsx",
  );
  const end = source.indexOf("</ol>", start);
  assert.ok(
    end > start,
    "the ritual list is not closed — the slice would run to EOF",
  );
  return source.slice(start, end);
}

test("each ritual leads with its Malayalam above a larger English title", () => {
  /* The hierarchy inverted on 2026-10-09 (owner): the Malayalam and the sprig move into the
     eyebrow position ABOVE, and the English title grows beneath them. Source order is what
     guarantees it, because a mirrored row is pushed and aligned by its parent and never reversed
     — reversing it once rendered `മധുരംവെപ്പ് Wedding Eve [leaf]`. */
  const list = ritualList();
  const ornament = list.indexOf("<SprigOrnament>");
  const malayalam = list.indexOf("{ritual.malayalam}");
  const title = list.indexOf("{ritual.title}");
  assert.notStrictEqual(
    ornament,
    -1,
    "the ritual's Malayalam carries no sprig ornament",
  );
  assert.ok(malayalam !== -1 && title !== -1);
  assert.ok(
    ornament < malayalam,
    "the sprig brackets the Malayalam, so the ornament opens that line",
  );
  assert.ok(
    malayalam < title,
    "the Malayalam must sit ABOVE the English title, not beside it",
  );
  /* Scoped to `className` values, not the slice: the prose above this markup names
     `type-heading-md`, so matching the slice passes while the title carries no role at all —
     proven by mutation, and it is the third face of this file's own comment-matching trap. */
  assert.ok(
    (list.match(/className="[^"]*"/g) ?? []).some((value) =>
      value.includes("type-heading-md"),
    ),
    "the freed English title takes the new role",
  );
  assert.ok(
    !/flex-row-reverse/.test(source),
    "a reversed row reverses the ornament too — mirror by justification, never by reversal",
  );
});

/* THE MALAYALAM TAKES heading-lg's SIZE AND NOT THE ROLE, and the distinction is the whole point:
   `--text-heading-lg--font-weight` is 700 and Noto Serif Malayalam ships no cut above 600, so
   `.type-heading-lg` would render SYNTHETIC bold on the conjuncts — a smeared outline rather than a
   heavier face. The size therefore comes from the role and the weight is stated on its own.
   THE WEIGHT IS 600, SETTLED BY THE OWNER ON A RENDER (2026-10-10), and it is asserted here rather
   than merely permitted: the utility and the one cut `app/layout.tsx` loads have to agree, and a
   `font-semibold` left behind after someone edits the loader back to 400 is a silent synthetic
   bold — the exact failure this role avoids by not using `.type-heading-lg`. */
test("the Malayalam takes heading-lg's size at the loaded weight, never the role", () => {
  /* `className` values only, never the whole slice: the prose beside this markup NAMES both
     `.type-heading-lg` and synthetic bold in order to say they are deliberately absent, and a
     plain substring search over the slice matched that comment and failed on correct code — the
     same trap the reading-measure test below already records. */
  const classNames = ritualList().match(/className="[^"]*"/g) ?? [];
  assert.ok(classNames.length > 0, "the slice must contain some className");
  const joined = classNames.join(" ");
  assert.match(
    joined,
    /text-\(length:--text-heading-lg\)/,
    "the Malayalam must take heading-lg's size explicitly",
  );
  assert.match(
    joined,
    /\bfont-semibold\b/,
    "the settled weight is 600 and must be stated, not inherited",
  );
  for (const value of classNames) {
    assert.ok(
      !value.includes("type-heading-lg"),
      `the role carries weight 700 — synthetic bold on Malayalam conjuncts: ${value}`,
    );
    assert.ok(
      !/\bfont-(bold|black|extrabold)\b/.test(value),
      `no cut above 600 exists in this family, so a heavier utility is synthetic: ${value}`,
    );
  }
  /* THE TWO HAVE TO AGREE. A `font-semibold` here against a loader asking for 400 is a synthetic
     bold that no other gate can see — it renders, it builds, and only a conjunct looks wrong. */
  const loader = readFileSync("app/layout.tsx", "utf8");
  const requested =
    loader.match(/Noto_Serif_Malayalam\(\{[\s\S]*?\}\)/)?.[0] ?? "";
  assert.ok(
    requested.length > 0,
    "no Noto_Serif_Malayalam call in app/layout.tsx",
  );
  assert.match(
    requested,
    /weight:\s*"600"/,
    "the ritual asks for 600; the loader must ship exactly that cut",
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
  /* Only `className` values are read, not the whole slice: the prose beside this markup names
     `max-w-text` to say it is deliberately absent, and a plain substring search matched that
     comment and failed on correct code. */
  const classNames = ritualList().match(/className="[^"]*"/g) ?? [];
  assert.ok(classNames.length > 0, "the slice must contain some className");
  for (const value of classNames) {
    assert.ok(
      !value.includes("max-w-text"),
      `no reading-measure cap inside the ritual list: ${value}`,
    );
  }
});
