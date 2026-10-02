import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/* Comments are stripped so the assertions read the code alone -- the same approach as
   `button-action.test.ts`, and necessary here because this file's own comments name the mechanism
   and would otherwise satisfy the assertions that look for it. */
const portrait = readFileSync("components/ui/portrait.tsx", "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  "",
);

/* The overlay only takes the hit test if it PAINTS over the image, and at equal z-index that is
   decided by document order: the image is absolutely positioned, so a later absolutely positioned
   sibling wins. Order is the mechanism, not a style preference. */
test("the hit-test overlay paints after the image", () => {
  /* `<Image` on its own also matches `<ImagePlaceholder`, which sits above both and would make
     this assertion vacuous -- it would then pass wherever the overlay went. The trailing
     whitespace is what separates the image from the placeholder. */
  const image = portrait.search(/<Image\s/);
  const overlay = portrait.indexOf('aria-hidden="true"');
  assert.ok(image > -1, "no <Image> found");
  assert.ok(overlay > -1, "no aria-hidden overlay found");
  assert.ok(
    overlay > image,
    "the overlay must come after the image or the image stays the hit target",
  );
});

/* `pointer-events-none` on this element is the single edit that silently restores the browser's
   "Save image as" menu, with nothing changing on screen. Owner decision, 2026-10-02. */
test("the hit-test overlay keeps its pointer events", () => {
  const overlay = portrait.slice(portrait.indexOf('aria-hidden="true"'));
  const element = overlay.slice(0, overlay.indexOf("/>") + 2);
  assert.doesNotMatch(element, /pointer-events-none/);
  assert.match(element, /absolute inset-0/);
});

/* Drag is a separate affordance from the context menu: the overlay stops the drag starting on the
   image, and `draggable={false}` is the standards-track belt for it. */
test("the portrait image is not draggable", () => {
  assert.match(portrait, /draggable=\{false\}/);
});

/* A member with no photo renders no image at all, so the overlay must sit outside that branch --
   inside it, the overlay either disappears with the image or wraps a null. */
test("the overlay is not inside the src-null branch", () => {
  const ternary = portrait.indexOf("src === null");
  const overlay = portrait.indexOf('aria-hidden="true"');
  assert.ok(ternary > -1 && overlay > ternary);
  const between = portrait.slice(ternary, overlay);
  assert.match(
    between,
    /\)\}/,
    "the null-check ternary must close before the overlay",
  );
});
