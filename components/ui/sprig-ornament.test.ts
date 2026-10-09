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

test("the default mark clears the iconography floor on its RENDERED height", () => {
  const fallback = /size\s*=\s*([A-Z_]+|\d+)/.exec(SOURCE);
  assert.notStrictEqual(fallback, null, "the mark's size has no default");
  const literal = /FLOOR_DIAGONAL\s*=\s*(\d+)/.exec(SOURCE);
  assert.notStrictEqual(literal, null, "no named default to read");
  const diagonal = Number((literal as RegExpExecArray)[1]);
  assert.ok(
    renderedHeight(diagonal) >= 16,
    `a ${diagonal}px diagonal renders ${renderedHeight(diagonal).toFixed(2)}px tall — under the 16px floor where this mark's lines grey out`,
  );
});

/* `ornamental-divider` renders the mark PLAIN, and it is the only other place the mark stands on
   its own, so it is what sets the mark's canonical direction. Both of the ornament's marks face
   that way: a flip on the trailing one reads as symmetry and ships a sprig pointing the wrong
   way, which is exactly what a later consistency pass would "restore". */
test("neither mark is mirrored, so both face the divider's direction", () => {
  assert.doesNotMatch(
    SOURCE,
    /scaleX|scale-x|-scale-x/,
    "a mirrored mark points the opposite way to ornamental-divider's own",
  );
  assert.doesNotMatch(
    readFileSync("components/layout/ornamental-divider.tsx", "utf8"),
    /scaleX|scale-x|-scale-x/,
    "the divider's mark is what sets the direction — if it gains a flip, this pair's claim is void",
  );
});

test("every section-head eyebrow is wrapped", () => {
  for (const site of SITES) {
    assert.match(
      readFileSync(site, "utf8"),
      /<SprigOrnament>/,
      `${site} has an unwrapped section-head eyebrow`,
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
