import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const strip = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");
const component = readFileSync("components/ui/scroll-progress.tsx", "utf8");
const css = strip(
  readFileSync("components/ui/scroll-progress.module.css", "utf8"),
);
const page = readFileSync("app/page.tsx", "utf8");
const lab = readFileSync("app/thread/[variant]/page.tsx", "utf8");
const tokens = readFileSync("app/styles/tokens.css", "utf8");
const invite = strip(readFileSync("app/invite.css", "utf8"));

const z = (name: string) => {
  const m = tokens.match(new RegExp(`--z-${name}:\\s*(\\d+);`));
  assert.ok(m, `--z-${name} not found`);
  return Number(m[1]);
};

test("the bar sits beside <main>, never inside it, so no section's box can move", () => {
  const bar = page.indexOf("<ScrollProgress />");
  /* The JSX element, not the comments that name `<main>`. */
  const main = page.search(/<main\s/);
  assert.ok(bar !== -1, "app/page.tsx does not render <ScrollProgress />");
  assert.ok(
    bar < main,
    "<ScrollProgress /> must come before <main>, as its sibling",
  );
  assert.equal(page.slice(main).includes("<ScrollProgress"), false);
});

test("the lab routes carry no bar", () => {
  assert.equal(lab.includes("ScrollProgress"), false);
});

test("the bar takes no layout and no pointer", () => {
  assert.match(css, /\.track\s*{[^}]*position:\s*fixed/);
  assert.match(css, /\.track\s*{[^}]*pointer-events:\s*none/);
  assert.match(css, /\.fill\s*{[^}]*transform-origin:\s*left/);
  assert.equal(/transition/.test(css), false, "the fill must never transition");
});

test("the bar is decorative and painted through transform alone", () => {
  assert.match(component, /aria-hidden/);
  assert.match(component, /data-scroll-progress/);
  assert.match(component, /scaleX\(/);
  assert.match(component, /passive:\s*true/);
  assert.match(component, /requestAnimationFrame/);
});

test("the bar sits under the gallery's scrim and over the content", () => {
  assert.ok(z("content") < z("progress") && z("progress") < z("modal"));
});

test("the track arrives as the opening's last beat, gated like every opening step", () => {
  const animated = css.match(/[^{}]+{[^}]*animation:[^}]*}/g) ?? [];
  assert.ok(animated.length > 0, "no animated rule found");
  for (const rule of animated) {
    assert.match(rule, /:root:not\(\[data-opening-skipped\]\)/);
    assert.match(rule, /var\(--opening-type-end\)/);
  }
  assert.match(css, /@media \(prefers-reduced-motion: no-preference\)/);
});

test("--opening-type-end is when Today's type has landed", () => {
  assert.match(
    invite,
    /--opening-type-end:\s*calc\(var\(--duration-fast\) \* 2 \+ var\(--duration-base\) \* 2\)/,
  );
});
