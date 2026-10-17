import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { FRAME_SHEETS } from "./frame-sheets.ts";

const strip = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/* Each frame's sheet is generated from the arguments in `frame-sheets.ts`, while the component that
   paints the frame receives its own props at the call site. The two must name the same fit, the same
   role and the same layout, or the frame would ship another section's thresholds. */
test("every consumer imports its own sheet and passes the list's arguments", () => {
  for (const sheet of FRAME_SHEETS) {
    const src = strip(readFileSync(sheet.consumer, "utf8"));
    assert.match(
      src,
      new RegExp(`import "@/app/frames/${sheet.name}\\.css";`),
      `${sheet.consumer} does not import its sheet`,
    );
    if (sheet.layout === "tall") {
      assert.match(
        src,
        /<MountedSheet tall>/,
        `${sheet.consumer}: no tall MountedSheet`,
      );
      continue;
    }
    const tag = sheet.layout === "pair" ? "MountedPair" : "MountedSheet";
    const call = src.match(
      new RegExp(`<${tag}\\b[^>]*fit=\\{${sheet.fitExport}\\}[^>]*>`),
    );
    assert.ok(call, `${sheet.consumer}: no <${tag} fit={${sheet.fitExport}}>`);
    assert.equal(
      /\bhero\b/.test(call[0]),
      sheet.hero,
      `${sheet.consumer}: hero does not match the list`,
    );
  }
});

/* One importer per sheet keeps a sheet's link tied to the frame that needs it. */
test("each sheet is imported by its listed consumer and by no other file", () => {
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory()) return path === "app/frames" ? [] : walk(path);
      return /\.tsx?$/.test(entry.name) ? [path] : [];
    });
  const importers = new Map<string, string[]>();
  for (const file of [...walk("app"), ...walk("components")]) {
    for (const m of strip(readFileSync(file, "utf8")).matchAll(
      /import "@\/app\/frames\/([\w-]+)\.css";/g,
    )) {
      importers.set(m[1], [...(importers.get(m[1]) ?? []), file]);
    }
  }
  assert.equal(
    importers.size,
    FRAME_SHEETS.length,
    `sheets imported: [${[...importers.keys()]}]`,
  );
  for (const sheet of FRAME_SHEETS) {
    assert.deepEqual(
      importers.get(sheet.name),
      [sheet.consumer],
      `${sheet.name}.css importers`,
    );
  }
});

test("the frame components render no stylesheet of their own", () => {
  for (const file of [
    "components/layout/mounted-sheet.tsx",
    "components/layout/mounted-pair.tsx",
  ]) {
    const src = strip(readFileSync(file, "utf8"));
    assert.doesNotMatch(src, /<style\b/, `${file} still renders <style>`);
    assert.doesNotMatch(
      src,
      /mountedSheetFrameCss|tallFrameCss/,
      `${file} still calls the generator`,
    );
  }
});
