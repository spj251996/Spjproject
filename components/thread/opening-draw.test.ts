import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync("components/thread/page-thread.tsx", "utf8");
const moduleCss = readFileSync("components/thread/thread.module.css", "utf8");
const tokens = readFileSync("app/styles/tokens.css", "utf8");
const inviteCss = readFileSync("app/invite.css", "utf8");
const layout = readFileSync("app/layout.tsx", "utf8");

function constant(name: string) {
  const match = source.match(new RegExp(`const ${name} = ([0-9.]+);`));
  assert.ok(match, `${name} not found`);
  return Number(match[1]);
}

function tokenMs(name: string) {
  const match = tokens.match(new RegExp(`--${name}:\\s*(\\d+)ms`));
  assert.ok(match, `--${name} not found`);
  return Number(match[1]);
}

// The draw must start exactly as the fade ends, or the sequence's last beat is a fade over an empty
// stroke (draw late) or a line drawing before it is visible (draw early).
test("the timed draw begins as the thread's fade completes", () => {
  const delay = moduleCss.match(
    /animation:\s*pageThreadFadeIn[^;]*?calc\(var\(--duration-fast\) \* (\d+) \+ var\(--duration-base\) \* (\d+)\)/,
  );
  assert.ok(delay, "fade delay expression not found");
  const fadeStart =
    Number(delay[1]) * tokenMs("duration-fast") +
    Number(delay[2]) * tokenMs("duration-base");
  assert.equal(
    constant("OPENING_DRAW_DELAY"),
    fadeStart + tokenMs("duration-base"),
  );
});

test("the fade begins as the type lands, not a beat after it", () => {
  const typeEnd =
    3 * tokenMs("duration-fast") +
    2 * tokenMs("duration-base") +
    tokenMs("duration-base");
  const fadeStart = 3 * tokenMs("duration-fast") + 3 * tokenMs("duration-base");
  assert.equal(fadeStart, typeEnd);
});

test("the opening draw runs 1200ms and holds back a quarter of the last connector", () => {
  assert.equal(constant("OPENING_DRAW_DURATION"), 1200);
  assert.equal(constant("CROSSING_HOLD_BACK"), 0.25);
});

/* THE SEQUENCE'S GATE (`thread-draw-behaviour.md` Task 4) — a page that loads already scrolled is
   not an arrival, so no step runs. The guard SUBTRACTS each rule rather than overriding it, which is
   the same place reduced motion and a no-JS reader land, so these assert that no step escapes it.
   `not-found`'s own timed thread is deliberately not gated: that screen has one card and no scroll,
   so there is no scrolled state for it to load into. */
const GATE = ":root:not([data-opening-skipped])";

/* The selector of every rule that declares `animation:` — walk back from the declaration to its own
   `{`, then back again to whatever brace or comment-end precedes it, so a rule nested in `@media`
   and a
   selector written across several lines are both read correctly. An earlier version split the file
   on `}` and silently matched nothing, passing while a step sat ungated. */
function animatedSelectors(css: string): string[] {
  const selectors: string[] = [];
  for (
    let at = css.indexOf("animation:");
    at !== -1;
    at = css.indexOf("animation:", at + 1)
  ) {
    const open = css.lastIndexOf("{", at);
    const start = Math.max(
      css.lastIndexOf("{", open - 1),
      css.lastIndexOf("}", open - 1),
      css.lastIndexOf("*/", open - 1) + 1,
    );
    selectors.push(css.slice(start + 1, open).trim());
  }
  return selectors;
}

test("no step of the invite's sequence animates without the gate", () => {
  const selectors = animatedSelectors(inviteCss);
  assert.equal(
    selectors.length,
    3,
    `expected the sequence's three steps, found ${selectors.length}`,
  );
  for (const selector of selectors) {
    assert.ok(
      selector.includes(GATE),
      `this step animates outside the gate: ${selector}`,
    );
  }
});

test("the page thread's own fade carries the gate too", () => {
  const rule = moduleCss.match(
    /([^}]*)\{[^}]*animation:\s*pageThreadFadeIn[^}]*}/,
  );
  assert.ok(rule, "the .pageRoot fade rule was not found");
  assert.ok(
    rule[1].includes(GATE),
    ".pageRoot covers all of <main>, so an ungated fade blanks the thread in every section",
  );
});

/* The measured reason this waits: at document-start the browser has not restored the scroll
   position yet and `scrollY` reads 0, which would skip the skip. It reads true from
   `readyState === "interactive"` onward. */
test("the gate reads the scroll position at DOMContentLoaded, not while parsing", () => {
  const script = layout.match(/const SKIP_OPENING_WHEN_SCROLLED = `([^`]*)`/);
  assert.ok(script, "the gate script was not found");
  const body = script[1];
  assert.ok(
    body.indexOf("DOMContentLoaded") < body.indexOf("scrollY"),
    "the scroll position must be read inside the listener, not as the script is parsed",
  );
});

test("the gate and the thread's timed draw share one threshold", () => {
  const script = layout.match(/const SKIP_OPENING_WHEN_SCROLLED = `([^`]*)`/);
  assert.ok(script);
  assert.match(script[1], /scrollY\s*>\s*0/);
  assert.match(source, /window\.scrollY\s*>\s*0/);
});
