import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/* STRUCTURAL claims, like `photo-viewer.test.ts`'s: the grid tile is JSX, and no committed render
   harness opens the gallery. What these hold is the contract between the modal and the panel — a
   tile holds no place until its photograph has loaded, and a failed photograph leaves nothing
   behind. */

const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf8");
const panel = read("./gallery-modal-panel.tsx");
const modal = read("./gallery-modal.tsx");

/* The JSX element opened by `tag`, up to the end of its opening tag, so a prop is asserted on the
   element that carries it rather than anywhere in the file. */
function element(source: string, tag: string, close = "/>"): string {
  /* Whitespace after the name, so a prose mention (`<img>`) or a longer name is never matched. */
  const start = source.search(new RegExp(`<${tag}\\s`));
  assert.notEqual(start, -1, `no <${tag}> in the source`);
  const end = source.indexOf(close, start);
  assert.notEqual(end, -1, `<${tag}> never closes`);
  return source.slice(start, end);
}

test("a grid tile reserves no box: no placeholder, the photograph in flow", () => {
  assert.doesNotMatch(panel, /ImagePlaceholder/);
  assert.match(element(panel, "img"), /className="relative block w-full /);
});

test("a tile holds no place until its photograph has loaded: no margin, no Tab stop", () => {
  assert.match(panel, /shown: loaded === undefined \|\| loaded\.has\(index\),/);
  assert.match(
    element(panel, "figure", ">"),
    /\$\{shown \? "mb-space-2xs" : ""\}/,
  );
  assert.doesNotMatch(
    element(panel, "figure", ">"),
    /"relative mb-space-2xs/,
    "the figure's margin must not be unconditional",
  );
  assert.match(
    element(panel.slice(panel.indexOf("<figure")), "button", 'type="button"'),
    /tabIndex=\{shown \? undefined : -1\}/,
  );
  assert.match(
    element(panel, "img"),
    /onLoad=\{onPhotoLoad && \(\(\) => onPhotoLoad\(index\)\)\}/,
  );
});

test("a failed photograph renders no figure, so it leaves no gap, margin or Tab stop", () => {
  assert.match(
    panel,
    /\.filter\(\(\{ index \}\) => !failed\?\.has\(index\)\);/,
  );
  /* The figures are drawn from the filtered list, keeping each tile's index into `images`, and the
     columns are counted over what is left. */
  assert.match(
    panel,
    /\{tiles\.map\(\(\{ src, key, index, shown \}\) => \(\s*<figure/,
  );
  assert.match(panel, /gridColumns\(tiles\.length\)/);
  assert.match(
    element(panel, "img"),
    /onError=\{onPhotoError && \(\(\) => onPhotoError\(index\)\)\}/,
  );
});

test("the modal holds both sets and wires both handlers", () => {
  /* The panel unmounts whenever the viewer opens, so the state lives in the modal. */
  const wired = element(modal, "GalleryModalPanel");
  assert.match(wired, /\bloaded=\{loaded\}/);
  assert.match(wired, /\bfailed=\{failed\}/);
  assert.match(wired, /\bonPhotoLoad=\{photoLoaded\}/);
  assert.match(wired, /\bonPhotoError=\{photoFailed\}/);
  assert.match(
    modal,
    /setLoaded\(\(previous\) => new Set\(previous\)\.add\(index\)\)/,
  );
  assert.match(
    modal,
    /setFailed\(\(previous\) => new Set\(previous\)\.add\(index\)\)/,
  );
});
