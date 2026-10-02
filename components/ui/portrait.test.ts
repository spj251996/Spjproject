import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/* Comments are stripped defensively, so a future comment that names one of these mechanisms cannot
   satisfy an assertion looking for it. No comment in the file does so today -- every test below
   passes identically without the strip. */
const portrait = readFileSync("components/ui/portrait.tsx", "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  "",
);

/* Located by the OPENING TAG rather than the bare attribute: `image-placeholder.tsx` already
   carries `aria-hidden="true"` in its own source, so inlining that component would otherwise point
   every assertion below at the wrong element. */
const OVERLAY_OPEN = '<span aria-hidden="true"';

/* Bounded at the tag's own `>`, not at `/>`: a `<span ...></span>` overlay is behaviourally
   identical, and an earlier version of this file failed that correct rewrite while reporting a
   misleading message about the wrong property. */
function openingTag(from: number, what: string) {
  assert.notStrictEqual(from, -1, `no ${what} found`);
  const end = portrait.indexOf(">", from);
  assert.notStrictEqual(end, -1, `${what} has an unclosed opening tag`);
  return portrait.slice(from, end + 1);
}

const overlay = () =>
  openingTag(portrait.indexOf(OVERLAY_OPEN), "hit-test overlay");

/* `<Image` alone also matches `<ImagePlaceholder`, which sits above the image in this component --
   an index taken that way is always before the overlay, which made the ordering test below pass
   wherever the overlay went. */
const imageStart = () => portrait.search(/<Image\s/);

test("the hit-test overlay paints after the image", () => {
  const image = imageStart();
  const span = portrait.indexOf(OVERLAY_OPEN);
  assert.ok(image > -1, "no <Image> element found");
  assert.ok(span > -1, `no ${OVERLAY_OPEN} found`);
  assert.ok(
    span > image,
    "the overlay must come after the image, or the image stays the hit target",
  );
});

/* Asserted FILE-WIDE, not on the overlay alone. `DESIGN.md` names `pointer-events: none` as the
   single edit that restores the browser's save-image menu with nothing changing on screen -- and
   putting it on the clipping div does that just as effectively as putting it on the overlay, which
   is the likelier place for someone tidying a layer. Nothing in this component has any reason to
   suppress pointer events, so the whole file is the correct scope. */
test("nothing in the portrait suppresses pointer events", () => {
  assert.doesNotMatch(portrait, /pointer-events/);
});

test("the hit-test overlay covers the photo and is not a tab stop", () => {
  const element = overlay();
  assert.match(element, /absolute inset-0/);
  assert.doesNotMatch(element, /tabIndex/);
});

/* Both halves, and both ON THE IMAGE: `draggable={false}` is the standards-track suppression and
   `-webkit-user-drag` is Safari's. Scoped to the element because either one sitting on the overlay
   instead does nothing, and unscoped assertions passed that mutation. The webkit half matters most
   here -- iOS is the one platform no harness in this project can drive, so nothing else would
   catch its removal. */
test("the portrait image suppresses dragging by both mechanisms", () => {
  const element = openingTag(imageStart(), "<Image> element");
  assert.match(element, /draggable=\{false\}/);
  assert.match(element, /-webkit-user-drag:\s*none/);
});

/* The overlay must sit OUTSIDE the `src === null` ternary, or a member with no photo loses it.
   Parentheses are BALANCED rather than matched against a `)}` shape: any `)}`-shaped expression in
   the image's own props -- `className={clsx(...)}` -- satisfies a shape check while the overlay
   sits inside the branch. */
test("the hit-test overlay is outside the src-null branch", () => {
  const ternary = portrait.indexOf("src === null");
  const span = portrait.indexOf(OVERLAY_OPEN);
  assert.ok(ternary > -1, "no src === null branch found");
  assert.ok(span > ternary, "the overlay must come after the null check");
  const between = portrait.slice(ternary, span);
  const opens = (between.match(/\(/g) ?? []).length;
  const closes = (between.match(/\)/g) ?? []).length;
  assert.strictEqual(
    closes,
    opens,
    `the ternary must close before the overlay (${opens} opened, ${closes} closed)`,
  );
});
