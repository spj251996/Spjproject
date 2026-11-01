import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { linkedStylesheets } from "./linked-stylesheets.mjs";

test("a linked sheet the export lacks comes back as missing, beside the ones it has", () => {
  const root = mkdtempSync(join(tmpdir(), "linked-"));
  mkdirSync(join(root, "_next/static/chunks"), { recursive: true });
  writeFileSync(join(root, "_next/static/chunks/a.css"), ".a{}");
  const html = `<link rel="stylesheet" href="/_next/static/chunks/a.css"/><link href="/_next/static/chunks/gone.css" rel="stylesheet"/><link rel="stylesheet" href="/_next/static/chunks/a.css"/>`;
  assert.deepEqual(linkedStylesheets(html, root), [
    { href: "/_next/static/chunks/a.css", css: ".a{}" },
    { href: "/_next/static/chunks/gone.css", css: null },
  ]);
});
