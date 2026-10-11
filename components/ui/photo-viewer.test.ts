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
