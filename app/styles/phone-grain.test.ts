import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { freshExport } from "../../scripts/lib/built-export.ts";

/* The card paper on phones takes half its tooth (owner, 2026-10-14, picked on an iPhone) —
   DESIGN.md → Foundations → Paper Grain. The same tile, each channel's final transfer slope halved
   and its intercept raised so the paper's mean colour holds; every wider tier keeps today's. */

const tokens = readFileSync("app/styles/tokens.css", "utf8");
const CSS_DIR = "out/_next/static/chunks";
const PUBLISHED = "out/index.html";

function transfer(name: string): string[] {
  const value = tokens.match(new RegExp(`--${name}: url\\("([^"]*)"\\);`));
  assert.ok(value, `--${name} not found`);
  return [
    ...value[1].matchAll(
      /<feFunc[RGB] type='linear' slope='([\d.]+)' intercept='([\d.]+)'\/>/g,
    ),
  ].map((m) => `${m[1]}/${m[2]}`);
}

test("the phone tile is today's at half the slope, intercepts raised to hold the mean", () => {
  assert.deepEqual(transfer("grain-stock-paper"), [
    "0.0825/0.9300",
    "0.1073/0.9090",
    "0.1486/0.8740",
  ]);
  assert.deepEqual(transfer("grain-stock-paper-phone"), [
    "0.0413/0.9612",
    "0.0537/0.9496",
    "0.0743/0.9302",
  ]);
});

test("only the stock changes on a phone, and only there", () => {
  const rule = tokens.match(/@variant max-md \{([^}]*)\}/);
  assert.ok(rule, "no max-md rule in tokens.css");
  assert.match(
    rule[1],
    /--grain-stock-paper: var\(--grain-stock-paper-phone\);/,
  );
  assert.doesNotMatch(rule[1], /--grain-(ground|mount)/);
  assert.equal(tokens.match(/--grain-stock-paper-phone\)/g)?.length, 1);
});

function publishedCss(): string {
  const html = readFileSync(PUBLISHED, "utf8");
  const sheets = [
    ...new Set(
      [...html.matchAll(/\/_next\/static\/chunks\/([A-Za-z0-9_-]+\.css)/g)].map(
        (match) => match[1],
      ),
    ),
  ];
  assert.ok(sheets.length > 0, `no stylesheet links in ${PUBLISHED}`);
  return sheets
    .map((name) => readFileSync(join(CSS_DIR, name), "utf8"))
    .join("\n");
}

test("the built CSS swaps the stock grain below 48rem, exactly once", (t) => {
  if (!freshExport(t)) return;
  const css = publishedCss();
  const swaps =
    css.match(/--grain-stock-paper:var\(--grain-stock-paper-phone\)/g) ?? [];
  assert.equal(swaps.length, 1, `${swaps.length} phone swaps in the built CSS`);
  const at = css.indexOf("--grain-stock-paper:var(--grain-stock-paper-phone)");
  const media = css.lastIndexOf("@media", at);
  assert.match(
    css.slice(media, css.indexOf("{", media)),
    /48rem/,
    "the swap is not inside the phone tier's media query",
  );
  assert.match(
    css,
    /slope='0\.0825' intercept='0\.9300'/,
    "today's tile is missing",
  );
  assert.match(
    css,
    /slope='0\.0413' intercept='0\.9612'/,
    "the phone tile is missing",
  );
});
