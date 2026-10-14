import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/* STRUCTURAL claims, deliberately: these are JSX and cannot be exercised without rendering. The
   layer logic they wire up is behaviour-tested in `gallery-state.test.ts`, and the render-backed
   proof of every tap route, history step and save cover is a Playwright check against the page. */

const read = (name: string) =>
  readFileSync(new URL(`./${name}`, import.meta.url), "utf8");
const viewer = read("photo-viewer.tsx");
const row = read("photo-row.tsx");
const panel = read("gallery-modal-panel.tsx");
const modal = read("gallery-modal.tsx");

const COVER = '<span aria-hidden="true" className="absolute inset-0" />';

test("the viewer photograph sits under a save cover and cannot be dragged", () => {
  assert.ok(viewer.includes(COVER), "the viewer's cover span is missing");
  assert.ok(viewer.includes("draggable={false}"));
});

test("a viewer photograph that fails to load says so", () => {
  assert.ok(viewer.includes("This photo couldn&apos;t load"));
});

test("previous and next are shown only where there is somewhere to go", () => {
  assert.match(viewer, /\{index > 0 && \(/);
  assert.match(viewer, /\{index < count - 1 && \(/);
});

test("the counter reads the photograph's position in the set", () => {
  assert.match(viewer, /\{index \+ 1\} \/ \{count\}/);
});

test("the frame carrying +N opens the grid, every other frame its own photograph", () => {
  assert.match(
    row,
    /const cue = index === frames\.length - 1 && remaining > 0;/,
  );
  assert.match(row, /onClick=\{\(\) => setStart\(cue \? null : index\)\}/);
});

test("every ritual photograph surface carries the cover and refuses a drag", () => {
  for (const [name, source] of [
    ["photo-row.tsx", row],
    ["gallery-modal-panel.tsx", panel],
    ["photo-viewer.tsx", viewer],
  ]) {
    assert.ok(source.includes(COVER), `${name} has no save cover`);
    assert.ok(source.includes("draggable={false}"), `${name} can be dragged`);
  }
});

test("the browser's own scroll restoration is held off while the gallery is open", () => {
  /* Back pops a layer through history, and the browser would otherwise restore its own remembered
     offset on that pop and fight the modal's scroll capture. */
  assert.match(modal, /history\.scrollRestoration = "manual"/);
  assert.match(modal, /history\.scrollRestoration = previousRestoration/);
});

test("the viewer is handed the full-screen copy, never the grid's", () => {
  assert.match(modal, /src=\{fulls\[images\[state\.index\]\] \?\? /);
});

test("the grid panel creates no handler of its own, so a server page can still render it", () => {
  /* The design-system gallery renders the panel from a server component, where a function created
     inside it cannot reach a \`<button>\` — the route answers 500. Neither tsc, this suite nor the build
     sees it, because that route is dev-only. A tile's handler must come from \`onOpenPhoto\` itself. */
  assert.ok(
    !panel.includes('"use client"'),
    "the panel is meant to stay server-renderable",
  );
  assert.match(
    panel,
    /onClick=\{onOpenPhoto && \(\(\) => onOpenPhoto\(index\)\)\}/,
  );
  assert.ok(
    !/onClick=\{\(\) =>/.test(panel),
    "an unconditional inline handler breaks a server render",
  );
});

test("every strip frame has a name, since each opens something different", () => {
  /* Its image, placeholder and cover are all hidden from assistive technology, so without a label a
     screen reader announces two or three bare "button"s. */
  assert.match(
    row,
    /aria-label=\{\s*cue\s*\? `All \$\{photos\.length\} photos`\s*: `Photo \$\{index \+ 1\} of \$\{photos\.length\}`\s*\}/,
  );
});

test("focus is put back inside the dialog whenever a layer swap removes the focused control", () => {
  /* Tapping a tile, "All photos", or Next onto the last photograph unmounts the focused button, so
     focus falls to <body> and the next Tab reaches the page behind the modal. */
  assert.match(modal, /\}, \[state\.layer, shownIndex\]\);/);
  assert.match(modal, /!container\.contains\(document\.activeElement\)/);
});

test("a second close before the first has landed does not go back again", () => {
  /* history.back() lands asynchronously; a double tap on Close would otherwise go back twice and take
     the guest off the invitation. */
  /* Both ways back are guarded: the close control (and "All photos" from a grid-opened viewer), and
     Escape. */
  assert.equal(modal.match(/if \(closingRef\.current\) return;/g)?.length, 2);
});

const motionCss = () => read("gallery-motion.module.css");

test("the gallery's motion lives entirely behind a no-preference gate, so reduced motion gets none", () => {
  const css = motionCss();
  const gate = css.indexOf("@media (prefers-reduced-motion: no-preference)");
  assert.ok(gate >= 0, "no reduced-motion gate");
  for (const name of [
    "rise",
    "fade",
    "slide-next",
    "slide-previous",
    "close",
  ]) {
    const at = css.indexOf(`@keyframes ${name}`);
    assert.ok(at > gate, `@keyframes ${name} missing or outside the gate`);
  }
  assert.equal(
    css.slice(0, gate).match(/animation\s*:/g),
    null,
    "an animation is declared outside the gate",
  );
});

test("the gallery's motion reads its durations and easing from the tokens", () => {
  const css = motionCss();
  assert.ok(css.includes("var(--duration-base)"));
  assert.ok(css.includes("var(--duration-fast)"));
  assert.ok(css.includes("var(--ease-entrance)"));
  assert.equal(
    css.match(/\d+m?s\b/g),
    null,
    "a raw duration in the motion CSS",
  );
});

test("closing waits for the fade before the modal unmounts, and not at all under reduced motion", () => {
  const popIndex = modal.indexOf("const onPopState");
  const handler = modal.slice(popIndex, modal.indexOf("};", popIndex));
  assert.ok(
    !handler.includes("onCloseRef.current()"),
    "the pop handler closes immediately instead of fading first",
  );
  assert.match(modal, /prefers-reduced-motion: reduce/);
  assert.match(modal, /onAnimationEnd=/);
  assert.match(modal, /setTimeout\(/);
});

test("a photograph slides in from the side it came from", () => {
  assert.match(viewer, /direction\?: 1 \| -1 \| 0;/);
  assert.match(viewer, /motion\["slide-next"\]/);
  assert.match(viewer, /motion\["slide-previous"\]/);
});
