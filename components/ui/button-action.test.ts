import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import { freshExport } from "../../scripts/lib/built-export.ts";
import { linkedStylesheets } from "../../scripts/lib/linked-stylesheets.mjs";

const typeScale = readFileSync("app/styles/type-scale.css", "utf8");
// Comments explain the retired design by name, so the assertions read the code alone.
const buttonAction = readFileSync(
  "components/ui/button-action.tsx",
  "utf8",
).replace(/\/\*[\s\S]*?\*\//g, "");
/* Actions are read across the sections, so the one read became a concatenation when the sections moved
   out of `app/page.tsx` -- reading one file would have narrowed the coverage silently. */
const page = ["event-info", "family", "celebrations"]
  .map((name) => readFileSync(`app/_sections/${name}.tsx`, "utf8"))
  .join("\n");
const tokens = readFileSync("app/styles/tokens.css", "utf8");

function ruleBody(css: string, selector: string) {
  const match = css.match(new RegExp(`${selector}\\s*\\{([^}]*)\\}`));
  assert.ok(match, `${selector} rule not found`);
  return match[1];
}

/* The role owns its own size rather than borrowing `--text-body`'s (owner, 2026-09-30), so an
   action can diverge from prose later without a second edit. The two are set to the SAME values
   today -- the point is that they are separable, not that they differ. */
test("type-action is sentence-case italic at its own size token", () => {
  const rule = ruleBody(typeScale, "\\.type-action");
  assert.match(rule, /font-style:\s*italic/);
  assert.match(rule, /font-size:\s*var\(--text-action\)/);
  assert.match(rule, /line-height:\s*var\(--text-action--line-height\)/);
  assert.doesNotMatch(rule, /var\(--text-body/);
});

/* Pinned because the size token exists to allow divergence, and divergence that happens by
   accident -- a tier edited on one role and not the other -- is the failure it invites. */
test("every tier's action size matches the body size it was set from", () => {
  const sizes = (name: string) =>
    [...tokens.matchAll(new RegExp(`--text-${name}:\\s*(\\d+)px`, "g"))].map(
      (m) => m[1],
    );
  assert.deepEqual(sizes("action"), sizes("body"));
});

test("type-action carries no capitals and no tracking tuned for them", () => {
  const rule = ruleBody(typeScale, "\\.type-action");
  assert.doesNotMatch(rule, /text-transform/);
  assert.doesNotMatch(
    rule,
    /letter-spacing:\s*var\(--text-action--letter-spacing\)/,
  );
});

// The utility also lays the stock's grain, which reads as noise inside a shape this small.
test("the pill takes the surface colour bare, never the grained utility", () => {
  assert.match(buttonAction, /bg-\(--color-surface-elevated\)/);
  assert.doesNotMatch(buttonAction, /(^|[\s"'`])bg-surface-elevated/);
});

test("the mark is scaled in its box rather than sized by class", () => {
  assert.match(buttonAction, /\[&_svg\]:\[transform:scale\(/);
});

/* The mark's box was `--touch-target` until 2026-10-07, so its size WAS the 44px accessibility
   floor. Shrinking it to 32 only works because the target carries the floor itself; if that ever
   moves back onto the box, its size silently becomes the hit area again and no render check would
   report it as a failure — it would just be a smaller tap target. */
test("the mark's box has its own size token and is not the touch target", () => {
  assert.match(tokens, /--action-disc:\s*32px/);
  assert.match(buttonAction, /size-\(--action-disc\)/);
  assert.doesNotMatch(
    buttonAction,
    /size-\(--touch-target\)/,
    "the mark's box must not be sized by the touch target again",
  );
});

test("the target keeps the touch-target floor on both axes", () => {
  assert.match(buttonAction, /min-h-\(--touch-target\)/);
  assert.match(buttonAction, /min-w-\(--touch-target\)/);
  assert.match(tokens, /--touch-target:\s*44px/);
});

/* An owner-tuned constant with nothing pinning it is how a fitting step silently overwrites a
   value someone chose by eye. 1.2 is 1.65 x 32/44: the scale the 44px box carried, held in
   proportion as the box came down, so the mark keeps its share of it. The ratio is asserted rather
   than the bare number, so moving the box without moving the scale fails here instead of rendering
   a crowded or a lost mark. */
test("the mark's scale is in proportion to its box", () => {
  const scale = /\[&_svg\]:\[transform:scale\(([\d.]+)\)\]/.exec(buttonAction);
  assert.ok(scale, "no mark scale found on the mark's box");
  const disc = /--action-disc:\s*(\d+)px/.exec(tokens);
  assert.ok(disc, "no --action-disc in tokens.css");
  const expected = (1.65 * Number(disc[1])) / 44;
  assert.ok(
    Math.abs(Number(scale[1]) - expected) < 0.005,
    `the mark is scaled ${scale[1]} in a ${disc[1]}px box; in proportion it should be ${expected.toFixed(3)}`,
  );
});

test("the flanking hairline rules are gone", () => {
  assert.doesNotMatch(buttonAction, /stroke-divider|<hr|h-px/);
});

/* Each element is read on its own, from its opening tag to its own closing tag, and its props in any
   order: one pattern across the joined sections could start in one action and finish in another. */
test("the map action reads Get directions on the pill ground", () => {
  const actions = page
    .split("<ButtonAction")
    .slice(1)
    .map((rest) => rest.slice(0, rest.indexOf("</ButtonAction>")));
  const maps = actions.filter((element) =>
    />\s*Get directions\s*$/.test(element),
  );
  assert.equal(maps.length, 1, "one map action, rendered per event");
  assert.ok(
    maps[0].includes('ground="pill"'),
    "the map action is not on the pill",
  );
  assert.ok(
    maps[0].includes("mark={<MapIcon size={24} />}"),
    "the map action lost its mark",
  );
});

function classList(name: string) {
  const match = new RegExp(`const ${name} =\\s*([\\s\\S]*?);`).exec(
    buttonAction,
  );
  assert.ok(match, `${name} not found`);
  return [...match[1].matchAll(/"([^"]*)"/g)].flatMap((m) => m[1].split(/\s+/));
}

/* The pill is the card's own paper (owner, 2026-10-30), so it must carry exactly the paper's two
   parts — the bare surface colour and the mount shadow — and set the label upright. */
test("the pill ground lays paper under the mark and label and sets the label upright", () => {
  const pill = classList("pillMarkClassName");
  for (const utility of [
    "bg-(--color-surface-elevated)",
    "shadow-mount",
    "rounded-full",
    "not-italic",
  ]) {
    assert.ok(pill.includes(utility), `the pill ground lacks ${utility}`);
  }
});

/* The label stays on one line down to a 320px phone (owner, 2026-10-30): the first pill's wider start
   and gap wrapped it into a 60px capsule there, so the start and the gap are tight and the label never
   wraps. The end is space-sm (owner, on a render, 2026-10-30): at space-2xs the text sat cramped
   against the pill's right edge. Each superseded value is asserted absent so a revert reads as a
   failure, not a pass. */
test("the pill holds its label on one line with room after the text", () => {
  const pill = classList("pillMarkClassName");
  for (const utility of [
    "ps-space-3xs",
    "pe-space-sm",
    "py-space-3xs",
    "gap-space-3xs",
    "whitespace-nowrap",
  ]) {
    assert.ok(pill.includes(utility), `the pill ground lacks ${utility}`);
  }
  for (const superseded of ["ps-space-2xs", "pe-space-2xs", "gap-space-2xs"]) {
    assert.ok(
      !pill.includes(superseded),
      `the pill ground still carries ${superseded}`,
    );
  }
});

/* Scaled 1.06 the pill reaches 4.6px past the target, and the focus ring sits 4px out, so a pill hovered
   while keyboard-focused covered the ring's ends (rendered, 2026-10-31). It stops growing while focused;
   the plain ground carries no paper to the target's edge, so it keeps its growth. The class is composed
   at run time: a literal here would keep the utility in the build on its own. */
const STEADY_WHEN_FOCUSED = ["group-focus-visible", "[transform:none]"].join(
  ":",
);

test("a keyboard-focused pill does not grow over its focus ring", () => {
  assert.ok(
    classList("pillMarkClassName").includes(STEADY_WHEN_FOCUSED),
    "the pill grows while keyboard-focused",
  );
  assert.ok(
    !classList("plainMarkClassName").includes(STEADY_WHEN_FOCUSED),
    "the plain ground was held steady too",
  );
});

/* Both rules have the same specificity, so the later one wins; this reads the order that shipped. */
test("the built CSS lets focus hold the pill over hover's growth", (t) => {
  if (!freshExport(t)) return;
  const css = linkedStylesheets(readFileSync("out/index.html", "utf8"), "out")
    .map((sheet) => sheet.css ?? "")
    .join("\n");
  const grow = css.search(
    /:where\(\.group\):hover \*\)\{transform:scale\(1\.06\)\}/,
  );
  const hold = css.search(
    /:where\(\.group\):focus-visible \*\)\{transform:none\}/,
  );
  assert.notStrictEqual(grow, -1, "the hover growth did not ship");
  assert.notStrictEqual(hold, -1, "the focused hold compiled to nothing");
  assert.ok(
    hold > grow,
    "the hover growth ships after the focused hold and wins",
  );
});

/* The disc's paper is retired (owner, 2026-10-30): no caller but the map action ever carried a mark,
   and the map action moved onto the pill, so a paper disc rendered nowhere. The plain ground is the
   label alone, italic, with no paper of any kind. */
test("the plain ground is the default: an italic label with no paper", () => {
  assert.match(buttonAction, /ground\s*=\s*"plain"/);
  const plain = classList("plainMarkClassName");
  for (const utility of ["gap-space-xs", "px-space-sm", "py-space-3xs"]) {
    assert.ok(plain.includes(utility), `the plain ground lacks ${utility}`);
  }
  for (const paper of [
    "not-italic",
    "bg-(--color-surface-elevated)",
    "shadow-mount",
    "rounded-full",
  ]) {
    assert.ok(!plain.includes(paper), `the plain ground carries ${paper}`);
  }
});

test("the pill is the only paper: the mark's box carries none", () => {
  assert.equal(
    buttonAction.split("bg-(--color-surface-elevated)").length - 1,
    1,
    "the surface colour is laid once, on the pill",
  );
  assert.equal(
    buttonAction.split("shadow-mount").length - 1,
    1,
    "the mount shadow is laid once, on the pill",
  );
  const box = classList("markBoxClassName");
  assert.ok(
    box.includes("size-(--action-disc)"),
    "the mark's box lost its size",
  );
  assert.doesNotMatch(buttonAction, /discPaperClassName|discMarkClassName/);
});

/* The class lists above say what each ground carries; this says which ground gets which. Without it a
   swapped branch passes every other test while turning "View photos" into a pill and the map action
   back into an italic label — and "View photos" cannot be rendered until a ritual has photographs. */
test("ground decides the classes: the pill side takes the pill, the plain side the plain label", () => {
  assert.match(
    buttonAction,
    /pill\s*\?\s*pillMarkClassName\s*:\s*plainMarkClassName/,
  );
  assert.match(
    buttonAction,
    /\$\{pill\s*\?\s*" rounded-full"\s*:\s*""\}/,
    "only the pill ground rounds the target its focus ring is drawn on",
  );
});

/* "View photos" and the not-found page's way back stay plain labels (owner, 2026-10-30): a second
   caller taking the pill is a design change, not a refactor. */
test("only the map action takes the pill", () => {
  /* Every shipped caller, found rather than listed, so a new one is covered the day it appears. The
     dev-only gallery is excluded: it shows each ground as a specimen. */
  const callers = ["app", "components"]
    .flatMap((root) =>
      readdirSync(root, { recursive: true, encoding: "utf8" }).map(
        (path) => `${root}/${path}`,
      ),
    )
    .filter(
      (path) =>
        path.endsWith(".tsx") &&
        !path.startsWith("app/design-system/") &&
        path !== "components/ui/button-action.tsx",
    )
    .map((path) => [path, readFileSync(path, "utf8")] as const)
    .filter(([, source]) => source.includes("<ButtonAction"));
  assert.ok(callers.length >= 3, `found ${callers.length} callers`);
  const pills = callers.flatMap(([path, source]) =>
    [...source.matchAll(/ground="pill"/g)].map(() => path),
  );
  assert.deepEqual(pills, ["app/_sections/event-info.tsx"]);
});

// Bold is a deliberate departure from type-body-italic's 400, giving an action presence on the card.
test("the action role keeps its bold weight and drops the caps-era tracking", () => {
  assert.match(tokens, /--text-action--font-weight:\s*700/);
  assert.match(
    ruleBody(typeScale, "\\.type-action"),
    /font-weight:\s*var\(--text-action--font-weight\)/,
  );
  /* The tracking was tuned for uppercase and has no meaning for sentence-case italic. */
  assert.doesNotMatch(tokens, /--text-action--letter-spacing:/);
});

/* EVALUATED, not pattern-matched. Pinning a spelling of the predicate passes the mis-refactor as
   well as the correct one: `!href.startsWith("//")` alone satisfies any regex
   asking for the `//` exclusion, and makes every external `https://` link same-tab with no
   `rel="noopener noreferrer"` -- the exact defect this guard exists to prevent. The predicate is a
   self-contained expression over one variable, so the honest test is to run it.

   A protocol-relative URL is the case that motivated this: it starts with `/` like a root-relative
   path but is an EXTERNAL destination, so treating it as same-tab drops the new tab's protection. */
test("sameTab opens external destinations in a new tab and this site in place", () => {
  const from = buttonAction.indexOf("const sameTab =");
  assert.notStrictEqual(from, -1, "no sameTab predicate found");
  const expression = buttonAction
    .slice(from + "const sameTab =".length, buttonAction.indexOf(";", from))
    .trim();
  const sameTab = new Function("href", `return ${expression};`) as (
    href: string,
  ) => boolean;

  for (const href of ["/", "/design-system"]) {
    assert.equal(sameTab(href), true, `${href} should replace the page`);
  }
  for (const href of [
    "//evil.example",
    "//wa.me/919354187793",
    "https://wa.me/919354187793",
    "https://maps.google.com/",
    "http://example.com/",
  ]) {
    assert.equal(
      sameTab(href),
      false,
      `${href} is external and must open in its own tab with noopener`,
    );
  }
});
