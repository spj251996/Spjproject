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

/* The hit area is a pseudo-element, not padding on the link: padding grows the box the focus ring draws round, and
   at the page's foot that box reaches past `main`'s clip, cutting the ring's bottom edge. */
test("the link is underlined 1px at 4px in currentColor at 35%, its hit area a touch-target pseudo-element", () => {
  const link = SOURCE.match(/const LINK =\s*"([^"]+)"/)?.[1];
  assert.ok(link, "no LINK class constant");
  const classes = link.split(" ");
  for (const name of [
    "underline",
    "decoration-1",
    "underline-offset-4",
    "[text-decoration-color:color-mix(in_srgb,currentColor_35%,transparent)]",
    "[--credit-hit:calc((var(--touch-target)-1lh)/2)]",
    "relative",
    "inline-block",
    "before:absolute",
    "before:inset-x-0",
    "before:-inset-y-(--credit-hit)",
  ]) {
    assert.ok(classes.includes(name), `LINK lacks ${name}`);
  }
  for (const name of classes) {
    assert.doesNotMatch(
      name,
      /^-?(p|py|pb|pt|m|my|mb|mt)-/,
      `LINK pads or margins its own box: ${name}`,
    );
  }
});

test("the separator in line is hidden from screen readers", () => {
  assert.match(layout("line"), /<span aria-hidden="true">\s*·\s*<\/span>/);
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
  /* Its call sites place it. The link's \`before:\` hit area is positioned inside the link and places nothing. */
  const classes = [
    ...SOURCE.matchAll(/className=\{?[`"]([^`"]+)[`"]/g),
    ...SOURCE.matchAll(/const LINK =\s*"([^"]+)"/g),
  ]
    .flatMap((m) => m[1].split(" "))
    .filter((name) => !name.startsWith("before:"));
  for (const name of classes) {
    assert.doesNotMatch(
      name,
      /^(absolute|fixed|sticky)$|^-?(inset|top|bottom|left|right)-/,
      `positions itself: ${name}`,
    );
  }
});
