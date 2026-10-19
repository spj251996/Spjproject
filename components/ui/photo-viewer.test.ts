import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/* STRUCTURAL claims, deliberately: these are JSX and cannot be exercised without rendering. The
   layer logic, the history steps and the double-close guard they wire up are behaviour-tested in
   `gallery-state.test.ts`. No committed render harness opens the gallery, so the wiring itself — tap
   routes, focus return, save covers — is held only by the source checks below. */

const read = (name: string) =>
  readFileSync(new URL(`./${name}`, import.meta.url), "utf8");
const viewer = read("photo-viewer.tsx");
const row = read("photo-row.tsx");
const panel = read("gallery-modal-panel.tsx");
const modal = read("gallery-modal.tsx");
const control = read("gallery-control.ts");

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

test("the open gallery steps the history only through its guarded history", () => {
  /* The guard is behaviour-tested in `gallery-state.test.ts`; a direct call here would bypass it. The
     one `history.back()` left is the forward guard, which runs only once every gallery has closed. */
  const guard = modal.slice(
    modal.indexOf("export function ensureForwardGuard"),
  );
  assert.match(guard.slice(0, guard.indexOf("\n}\n")), /history\.back\(\);/);
  assert.equal(modal.match(/history\.back\(\);/g)?.length, 1);
  assert.doesNotMatch(modal, /history\.pushState/);
  assert.match(modal, /createGalleryHistory\(window\.history\)/);
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

test("a deliberate tap on empty space goes back one layer through the same guarded back", () => {
  assert.match(modal, /onPointerDown=/);
  assert.match(modal, /isDeliberateTap\(/);
  const click = modal.slice(modal.indexOf("onClick={(event)"));
  assert.ok(
    modal.includes("onClick={(event)") &&
      click.slice(0, click.indexOf("}}")).includes("goBack()"),
    "the tap does not go back through goBack on the click",
  );
});

test("the photograph, tiles, buttons and text are never empty space", () => {
  assert.match(modal, /closest\("button, h2, p"\)/);
  assert.match(modal, /containedRect\(/);
  assert.match(modal, /insideRect\(/);
  assert.match(viewer, /data-viewer-photo/);
});

test("the tap listener lives on the modal, so the grid panel still renders from a server page", () => {
  assert.doesNotMatch(panel, /onPointer/);
});

test("the close is decided on the click, not on pointerup, so a touch's click cannot land on the page beneath", () => {
  assert.doesNotMatch(modal, /onPointerUp=/);
});

test("only a primary-button press counts as a tap", () => {
  assert.match(modal, /event\.button === 0/);
});

test("while the gallery fades out it still catches every tap, so nothing reaches the invitation beneath", () => {
  const root = modal.slice(
    modal.indexOf('role="dialog"') - 2000,
    modal.indexOf('role="dialog"'),
  );
  const rootClass = root.slice(root.lastIndexOf("className="));
  assert.doesNotMatch(
    rootClass.slice(0, rootClass.indexOf("\n")),
    /pointer-events-none/,
    "the dialog root lets taps through while closing",
  );
});

test("previous and next are drawn chevrons in a 48px dark circle, not type marks", () => {
  assert.doesNotMatch(viewer, /[‹›]/);
  assert.match(viewer, /<ChevronIcon/);
  assert.match(viewer, /CONTROL_CIRCLE/);
  assert.match(control, /size-space-xl/);
  assert.match(control, /bg-scrim\/60/);
  assert.match(control, /hover:bg-scrim hover:scale-110/);
  assert.match(control, /active:bg-scrim active:scale-110/);
  assert.doesNotMatch(control, /active:opacity-80/);
});

test("All photos and Close are drawn icons in the arrows' dark circle, named for screen readers", () => {
  assert.match(viewer, /aria-label="All photos"/);
  assert.match(viewer, /aria-label="Close"/);
  assert.match(viewer, /<GridIcon/);
  assert.match(viewer, /<CloseIcon/);
  assert.match(panel, /aria-label="Close"/);
  assert.match(panel, /<CloseIcon/);
  assert.match(panel, /className=\{CONTROL_CIRCLE\}/);
  assert.doesNotMatch(viewer, />\s*(All photos|Close)\s*</);
  assert.doesNotMatch(panel, />\s*Close\s*</);
});

test("a grid tile shows it opens bigger, and only where motion is welcome", () => {
  assert.match(panel, /cursor-zoom-in/);
  assert.match(panel, /motion-safe:group-hover:scale-\[1\.03\]/);
});

test("the swipe hint plays once a visit, on touch, when there is a next photograph", () => {
  const css = motionCss();
  assert.ok(
    css.indexOf("@keyframes nudge") >
      css.indexOf("@media (prefers-reduced-motion: no-preference)"),
  );
  assert.match(modal, /let swipeHintShown = false/);
  assert.match(modal, /\(pointer: coarse\)/);
  assert.match(viewer, /motion\.nudge/);
});

test("while the full copy loads, the strip's small copy holds the stage, then gives way", () => {
  assert.match(viewer, /thumb\?: string;/);
  assert.match(viewer, /data-viewer-underlay/);
  assert.match(viewer, /onLoad=\{\(\) => setLoaded\(src\)\}/);
  assert.match(viewer, /loaded !== src/);
  assert.match(row, /thumbs=\{thumbs\}/);
  assert.match(modal, /thumb=\{thumbs\[/);
});

test("a failed photograph's message is sized to its text, so the dark stage around it is empty space", () => {
  const at = viewer.indexOf("This photo couldn&apos;t load");
  const before = viewer.slice(viewer.lastIndexOf("<p", at), at);
  assert.doesNotMatch(before, /inset-0/, "the message still spans the stage");
});

test("taps are judged against the stage's box, which the slide never moves, and the photo that has loaded", () => {
  const fn = modal.slice(
    modal.indexOf("const isEmptySpace"),
    modal.indexOf("const goBack"),
  );
  assert.match(fn, /\[data-viewer-stage\]/);
  assert.match(fn, /stage\.getBoundingClientRect\(\)/);
  assert.doesNotMatch(fn, /photo\.getBoundingClientRect\(\)/);
  assert.match(viewer, /data-viewer-stage/);
});

test("a press in a scrolling element's scrollbar gutter is never empty space", () => {
  const fn = modal.slice(
    modal.indexOf("const isEmptySpace"),
    modal.indexOf("const goBack"),
  );
  assert.match(fn, /scrollHeight > .*clientHeight/);
  assert.match(fn, /offsetX >= .*clientWidth/);
});

test("Forward onto a closed gallery's entry steps straight back past it", () => {
  assert.match(modal, /export function ensureForwardGuard\(\)/);
  const guard = modal.slice(
    modal.indexOf("export function ensureForwardGuard"),
  );
  const body = guard.slice(0, guard.indexOf("\n}\n"));
  assert.match(body, /history\.state\?\.gallery/);
  assert.match(body, /openGalleries === 0/);
  assert.match(body, /history\.back\(\)/);
  assert.match(modal, /openGalleries \+= 1/);
  assert.match(modal, /openGalleries -= 1/);
  assert.match(row, /useEffect\(ensureForwardGuard, \[\]\)/);
});
