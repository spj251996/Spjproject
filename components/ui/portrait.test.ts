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

/* `absolute inset-0` resolves against the nearest POSITIONED ancestor, so the overlay only covers
   the photo while it sits inside the clipping div. Moved up onto the `figure` -- which is not
   `relative` -- it would resolve against something further out and cover much of the card, and every
   other assertion in this file would still pass. The parent is part of the mechanism. */
test("the hit-test overlay's parent is the positioned clipping div", () => {
  const span = portrait.indexOf(OVERLAY_OPEN);
  assert.ok(span > -1, `no ${OVERLAY_OPEN} found`);
  const clipAttr = portrait.indexOf(
    'className="absolute inset-0 overflow-hidden',
  );
  assert.notStrictEqual(clipAttr, -1, "no clipping div found");
  /* Anchored on the `<div` that OWNS the attribute, not on the attribute: starting the walk inside
     the tag leaves the opening `<div` uncounted, so the first `</div>` takes the depth to -1 and it
     never returns to 0. */
  const clip = portrait.lastIndexOf("<div", clipAttr);
  assert.notStrictEqual(clip, -1, "the clipping attribute has no opening tag");

  /* CONTAINMENT, not "the nearest preceding `<div`". The first version of this test took
     `lastIndexOf("<div")` before the overlay and passed the mutation it was written for: moving the
     overlay out to the `figure` still leaves the clipping div as the nearest PRECEDING `<div`,
     because `figcaption` holds only spans. Walk the div depth from the clipping tag instead and
     require the overlay inside its span. */
  let depth = 0;
  let closesAt = -1;
  for (const match of portrait.slice(clip).matchAll(/<div\b|<\/div>/g)) {
    depth += match[0] === "</div>" ? -1 : 1;
    if (depth === 0) {
      closesAt = clip + (match.index ?? 0);
      break;
    }
  }
  assert.notStrictEqual(closesAt, -1, "the clipping div never closes");
  assert.ok(
    span > clip && span < closesAt,
    "the overlay must sit INSIDE the clipping div; outside it, `absolute inset-0` resolves against a further ancestor and covers the card instead of the photo",
  );
});

/* The overlay is transparent by construction -- it carries no background utility at all. An added
   one would paint over all ten faces while every assertion about position, order and pointer events
   still passed, so the class list is pinned EXACTLY rather than matched loosely. Change this string
   deliberately if the overlay ever legitimately gains a class. */
test("the hit-test overlay carries nothing but its position", () => {
  const quoted = overlay().match(/className="([^"]*)"/);
  assert.ok(
    quoted,
    "the overlay's className must be a plain string to be pinned",
  );
  assert.strictEqual(
    quoted[1],
    "absolute inset-0",
    "the overlay must stay transparent and positional -- a background would paint over every face",
  );
});
