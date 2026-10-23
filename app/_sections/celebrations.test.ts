import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { withClasses } from "../../scripts/source-classes.ts";

const read = (path: string) => readFileSync(path, "utf8");
const source = readFileSync("app/_sections/celebrations.tsx", "utf8");

/* The composition site is a server component, so these are source assertions rather than render
   ones. Each pins a rule with a recorded failure behind it, not merely a line of markup. */

/* THE RITUAL LIST'S OWN SLICE, and it is load-bearing: the section's head sits forty lines above
   with an eyebrow, an ornament and a heading of its own, so an unscoped `indexOf` can read the head
   and pass every order assertion below against the wrong element. */
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

test("each ritual opens on one header line: sprig, English title, Malayalam", () => {
  /* The owner's order (2026-10-11): the sprig, then the English title, then its Malayalam, on one
     baseline. Source order is what sets it — a reversed row once rendered `മധുരംവെപ്പ് Wedding Eve
     [leaf]` — and the sprig is the mark ONCE, not the eyebrows' outward pair between rules. */
  const list = ritualList();
  const header = list.indexOf("data-ritual-header");
  const sprig = list.indexOf("<SprigIcon");
  const title = list.indexOf("{ritual.title}");
  const malayalam = list.indexOf("{ritual.malayalam}");
  assert.ok(header !== -1, "no header line in the ritual block");
  assert.ok(sprig !== -1 && title !== -1 && malayalam !== -1);
  assert.ok(
    header < sprig && sprig < title && title < malayalam,
    "the header line runs sprig, English title, Malayalam — in that order",
  );
  assert.ok(
    !list.includes("<SprigOrnament"),
    "the ritual takes one sprig, not the eyebrows' ornament",
  );
  /* Scoped to class values, not the slice: the prose above this markup names `type-heading-md`, so
     matching the slice passes while the title carries no role at all. Template-literal class names
     count, because the title composes the role with the module's own class. */
  assert.ok(
    (list.match(/className=(?:"[^"]*"|\{`[^`]*`\})/g) ?? []).some((value) =>
      value.includes("type-heading-md"),
    ),
    "the English title takes heading-md",
  );
  assert.ok(
    !/flex-row-reverse/.test(source),
    "a reversed row reverses the sprig too — never reverse the line",
  );
});

/* THE MALAYALAM TAKES heading-sm's SIZE AND NOT THE ROLE, and the distinction is the whole point:
   `--text-heading-sm--font-weight` is 700 and Noto Serif Malayalam ships no cut above 600, so
   `.type-heading-sm` would render SYNTHETIC bold on the conjuncts — a smeared outline rather than a
   heavier face. The size therefore comes from the role and the weight is stated on its own.
   THE WEIGHT IS 600, SETTLED BY THE OWNER ON A RENDER (2026-10-10), and it is asserted here rather
   than merely permitted: the utility and the one cut `app/layout.tsx` loads have to agree, and a
   `font-semibold` left behind after someone edits the loader back to 400 is a silent synthetic
   bold — the exact failure this role avoids by not using `.type-heading-sm`. */
test("the Malayalam takes heading-sm's size at the loaded weight, never the role", () => {
  /* `className` values only, never the whole slice: the prose beside this markup NAMES both
     `.type-heading-sm` and synthetic bold in order to say they are deliberately absent, and a
     plain substring search over the slice matched that comment and failed on correct code — the
     same trap the reading-measure test below already records. */
  const classNames = ritualList().match(/className="[^"]*"/g) ?? [];
  assert.ok(classNames.length > 0, "the slice must contain some className");
  const joined = classNames.join(" ");
  assert.match(
    joined,
    /text-\(length:--text-heading-sm\)/,
    "the Malayalam must take heading-sm's size explicitly",
  );
  assert.match(
    joined,
    /\bfont-semibold\b/,
    "the settled weight is 600 and must be stated, not inherited",
  );
  for (const value of classNames) {
    assert.ok(
      !value.includes("type-heading-sm"),
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

test("a photographed ritual closes to space-md from 64rem", () => {
  assert.match(
    read("app/_sections/celebrations.module.css"),
    /\.row:has\(\[data-photo-ready\]\)\s*\{\s*margin-block-end:\s*calc\(var\(--spacing-space-md\) - var\(--spacing-space-xl\)\)/,
  );
});

test("the ritual leaf shows from 64rem only; the phone Malayalam sits right", () => {
  const celebrations = read("app/_sections/celebrations.tsx");
  assert.equal(
    withClasses(celebrations, "text-accent-gold", "max-lg:hidden").length,
    1,
    "the ritual leaf, gold and hidden below 64rem",
  );
  assert.equal(withClasses(celebrations, "max-md:ms-auto").length, 1);
});
