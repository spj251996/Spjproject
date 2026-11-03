import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { credit } from "../../content/credit.ts";

/* Read from source because `designer-credit.tsx` is JSX, which `node --test` cannot load. */
const SOURCE = readFileSync("components/ui/designer-credit.tsx", "utf8");

/* `line` is the early return; `signoff` is the function's last return. */
const lineBranch = SOURCE.match(
  /if \(layout === "line"\) \{[\s\S]*?\n {2}\}/,
)?.[0];
const layout = (name: "line" | "signoff") => {
  assert.ok(lineBranch, "no line branch in designer-credit.tsx");
  if (name === "line") return lineBranch;
  return SOURCE.slice(SOURCE.indexOf(lineBranch) + lineBranch.length);
};

test("the credit's words are the owner's", () => {
  assert.deepEqual(credit, {
    lead: "Design",
    name: "Aishwarya Ganesan",
    url: "https://aishwaryaganesan.vercel.app/",
  });
});

test("in each layout the name is the only link, to the credit's url, in the same tab", () => {
  for (const name of ["line", "signoff"] as const) {
    const anchors = layout(name).match(/<a\b[^>]*>/g) ?? [];
    assert.equal(anchors.length, 1, `${name} has ${anchors.length} links`);
    assert.match(anchors[0], /href=\{credit\.url\}/);
    assert.doesNotMatch(anchors[0], /target=/);
    assert.match(layout(name), /<a\b[^>]*>\s*\{credit\.name\}\s*<\/a>/);
  }
});

test("the link is underlined 1px at 4px in currentColor at 35%, with a touch-target hit area", () => {
  const link = SOURCE.match(/const LINK =\s*"([^"]+)"/)?.[1];
  assert.ok(link, "no LINK class constant");
  for (const name of [
    "underline",
    "decoration-1",
    "underline-offset-4",
    "[text-decoration-color:color-mix(in_srgb,currentColor_35%,transparent)]",
    "[--credit-hit:calc((var(--touch-target)-1lh)/2)]",
    "inline-block",
    "py-(--credit-hit)",
    "-my-(--credit-hit)",
  ]) {
    assert.ok(link.split(" ").includes(name), `LINK lacks ${name}`);
  }
});

test("the line layout reads lead · name, the name bold below md", () => {
  const body = layout("line");
  assert.match(body, /type-caption-italic[^>]*>\s*\{credit\.lead\}/);
  assert.match(body, /·/);
  assert.match(body, /font-bold/);
  assert.match(body, /md:font-normal/);
  assert.match(body, /text-ink-muted/);
});

test("the signoff layout stacks a gold floor-size sprig, the lead, then the name", () => {
  const body = layout("signoff");
  const sprig = body.indexOf("<SprigIcon");
  const lead = body.indexOf("{credit.lead}");
  const name = body.indexOf("<a");
  assert.ok(
    sprig >= 0 && sprig < lead && lead < name,
    "order is sprig, lead, name",
  );
  assert.match(body, /<SprigIcon[^/]*size=\{FLOOR_DIAGONAL\}/);
  assert.match(body, /text-accent-gold/);
  assert.match(body, /type-caption-italic/);
  assert.match(body, /mt-space-2xs/);
  assert.match(body, /mt-space-3xs/);
});

test("the credit carries no positioning of its own", () => {
  assert.doesNotMatch(
    SOURCE,
    /\b(absolute|fixed|sticky|inset-|bottom-|top-)\S*/,
  );
});
