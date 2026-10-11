import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/* The ornament brackets whatever it is given with the sprig mark. Three things can go wrong here
   and none of them reports itself:

   - `.type-eyebrow` declares its own gold inside `@layer components`, so ANY colour utility on this
     wrapper beats the role it wraps and the eyebrow silently stops being gold. Every call site
     already carries a comment saying so; this is the gate behind the comment.
   - The mark's `size` prop is a DIAGONAL, and the 16px floor below which its lines grey out is a
     RENDERED HEIGHT. For this mark those are different numbers — its viewBox is not square — so a
     literal 16 would ship a mark under the floor while reading as if it honoured it. The floor is
     asserted as a derivation from the mark's own viewBox rather than as a remembered constant.
   - Two eyebrows deliberately take no ornament. An absence is indistinguishable from an oversight,
     so both are asserted with their reason, or a later consistency pass "fixes" them back. */

const SOURCE = readFileSync("components/ui/sprig-ornament.tsx", "utf8");
const SPRIG = readFileSync("components/icons/sprig.tsx", "utf8");

/* The five section-head eyebrows. Each file is one call site; Event Info and Family each render
   theirs twice, per sheet and per side. */
const SITES = [
  "app/_sections/event-info.tsx",
  "components/family/family.tsx",
  "app/_sections/celebrations.tsx",
  "app/_sections/wishes.tsx",
  "app/not-found.tsx",
];

function renderedHeight(diagonal: number): number {
  const viewBox = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(SPRIG);
  assert.notStrictEqual(viewBox, null, "no viewBox on the sprig mark");
  const [, w, h] = viewBox as RegExpExecArray;
  return (Number(h) * diagonal) / Math.hypot(Number(w), Number(h));
}

test("the ornament sets no colour of its own", () => {
  assert.doesNotMatch(
    SOURCE,
    /\btext-(ink|ink-muted|accent-gold|surface-[a-z-]+)\b/,
    "a colour utility here beats .type-eyebrow's own colour, which is declared in @layer components",
  );
});

test("the mark clears the iconography floor on its RENDERED height", () => {
  /* The size is FIXED rather than a prop as of 2026-10-11 — eight call sites, none ever passed
     one — so what this has to assert is that both marks are given the named constant, not that a
     default exists. A literal here would be the drift this file exists to catch. */
  assert.doesNotMatch(
    SOURCE,
    /size\?:\s*number/,
    "the size is fixed; a prop here is the speculative API that was removed",
  );
  const given = SOURCE.match(/<SprigIcon[^/]*size=\{FLOOR_DIAGONAL\}/g) ?? [];
  assert.strictEqual(
    given.length,
    2,
    "both marks must take the named floor constant, never a literal",
  );
  const literal = /FLOOR_DIAGONAL\s*=\s*(\d+)/.exec(SOURCE);
  assert.notStrictEqual(literal, null, "no named default to read");
  const diagonal = Number((literal as RegExpExecArray)[1]);
  assert.ok(
    renderedHeight(diagonal) >= 16,
    `a ${diagonal}px diagonal renders ${renderedHeight(diagonal).toFixed(2)}px tall — under the 16px floor where this mark's lines grey out`,
  );
});

/* `ornamental-divider` renders the mark PLAIN, and it is the only other place the mark stands on
   its own, so it is what sets the mark's canonical direction. In the PLAIN form both of the
   ornament's marks face that way: a flip on the trailing one reads as symmetry and ships a sprig
   pointing the wrong way, which is exactly what a later consistency pass would "restore". The
   EYEBROW form flips the LEADING mark only — outward, the owner's pick (2026-10-11) — so the one
   flip is asserted to be the eyebrow's and the leading mark's, and nothing else. */
test("only the eyebrow form mirrors, and only its leading mark", () => {
  const flips = SOURCE.match(/scaleX|scale-x/g) ?? [];
  assert.strictEqual(
    flips.length,
    1,
    "exactly one flip, the eyebrow's leading mark",
  );
  assert.match(
    SOURCE,
    /className=\{eyebrow \? "shrink-0 -scale-x-100" : "shrink-0"\}/,
    "the flip must be conditional on the eyebrow form, or the ritual's plain pair points the wrong way",
  );
  const marks = [...SOURCE.matchAll(/<SprigIcon\b/g)].map((m) => m.index ?? -1);
  assert.strictEqual(marks.length, 2, "two marks");
  assert.ok(
    SOURCE.indexOf("-scale-x-100") > marks[0] &&
      SOURCE.indexOf("-scale-x-100") < SOURCE.indexOf("{children}"),
    "the flip belongs to the LEADING mark — the trailing one already points away from the words",
  );
  assert.doesNotMatch(
    readFileSync("components/layout/ornamental-divider.tsx", "utf8"),
    /scaleX|scale-x|-scale-x/,
    "the divider's mark is what sets the direction — if it gains a flip, this pair's claim is void",
  );
});

test("the eyebrow form's rules are the hairline token, in the wrapper's own colour", () => {
  assert.match(
    SOURCE,
    /h-\(--stroke-hairline\)/,
    "the rule must take --stroke-hairline",
  );
  assert.match(
    SOURCE,
    /\bbg-current\b/,
    "the rule takes currentColor, so an eyebrow's rules are its gold",
  );
  const rules =
    SOURCE.match(/\{eyebrow && <span aria-hidden className=\{RULE\} \/>\}/g) ??
    [];
  assert.strictEqual(
    rules.length,
    2,
    "one rule outside each mark, and only in the eyebrow form",
  );
  const tokens = readFileSync("app/styles/tokens.css", "utf8");
  assert.match(
    tokens,
    /--stroke-hairline:\s*0\.5px;/,
    "the hairline token is gone or has moved",
  );
});

test("every section-head eyebrow takes the eyebrow form", () => {
  for (const site of SITES) {
    assert.match(
      readFileSync(site, "utf8"),
      /<SprigOrnament eyebrow>/,
      `${site} has a section-head eyebrow not in the eyebrow form`,
    );
  }
});

test("the two deliberate exceptions stay unwrapped", () => {
  assert.doesNotMatch(
    readFileSync("app/_sections/invite.tsx", "utf8"),
    /SprigOrnament/,
    "the invite's eyebrow leads the hero and takes no ornament",
  );
  assert.doesNotMatch(
    readFileSync("app/_sections/contact.tsx", "utf8"),
    /SprigOrnament/,
    "Contact is off the published page and its files go in Phase 9 — do not ornament a file with a deletion date",
  );
});
