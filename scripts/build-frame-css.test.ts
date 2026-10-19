import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { FrameSheet } from "../app/frame-sheets.ts";
import { buildFrames } from "./build-frame-css.ts";

const sheet = (name: string) => ({ name }) as FrameSheet;

function framesDir(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "frames-"));
  for (const [name, css] of Object.entries(files)) {
    writeFileSync(join(dir, name), css);
  }
  return dir;
}

function snapshot(dir: string): Record<string, string> {
  return Object.fromEntries(
    readdirSync(dir)
      .sort()
      .map((name) => [name, readFileSync(join(dir, name), "utf8")]),
  );
}

test("a sheet that throws leaves every committed sheet untouched and prunes nothing", () => {
  const dir = framesDir({ "a.css": "old a", "retired.css": "old retired" });
  const before = snapshot(dir);
  assert.throws(
    () =>
      buildFrames(
        [sheet("a"), sheet("b")],
        dir,
        (s) => {
          if (s.name === "b") throw new Error("b cannot be framed");
          return "new a";
        },
        { log: () => {} },
      ),
    /b cannot be framed/,
  );
  assert.deepEqual(snapshot(dir), before);
});

test("a clean run writes the changed sheets and prunes the unnamed ones", () => {
  const dir = framesDir({
    "a.css": "same",
    "b.css": "old b",
    "retired.css": "old retired",
  });
  buildFrames(
    [sheet("a"), sheet("b")],
    dir,
    (s) => (s.name === "a" ? "same" : "new b"),
    { log: () => {} },
  );
  assert.deepEqual(snapshot(dir), { "a.css": "same", "b.css": "new b" });
});

test("a dry run writes and prunes nothing, and reports both", () => {
  const dir = framesDir({ "b.css": "old b", "retired.css": "old retired" });
  const before = snapshot(dir);
  const lines: string[] = [];
  buildFrames([sheet("b")], dir, () => "new b", {
    dryRun: true,
    log: (line) => lines.push(line),
  });
  assert.deepEqual(snapshot(dir), before);
  assert.ok(lines.some((line) => line.startsWith("update")));
  assert.ok(lines.some((line) => line.startsWith("prune")));
});
