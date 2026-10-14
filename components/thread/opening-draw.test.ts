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

function stripComments(css: string) {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

/* `calc(var(--duration-fast) * a [+ var(--duration-base) * b])`, either term optional, in ms. */
function calcMs(expression: string, what: string) {
  const fast = expression.match(/var\(--duration-fast\)(?: \* ([\d.]+))?/);
  const base = expression.match(/var\(--duration-base\)(?: \* ([\d.]+))?/);
  assert.ok(fast || base, `${what}: no duration token in ${expression}`);
  return (
    (fast ? Number(fast[1] ?? 1) * tokenMs("duration-fast") : 0) +
    (base ? Number(base[1] ?? 1) * tokenMs("duration-base") : 0)
  );
}

/* THE ONE SOURCE. `--opening-type-end` in `app/invite.css` says when the type has landed; the
   thread's fade and the progress bar's track read it, and the timed draw is derived from it. */
function typeEndMs() {
  const match = stripComments(inviteCss).match(
    /--opening-type-end:\s*(calc\([^;]*\));/,
  );
  assert.ok(match, "--opening-type-end not found in app/invite.css");
  return calcMs(match[1], "--opening-type-end");
}

test("--opening-type-end is when the last row of type lands", () => {
  /* Every type step's start + duration, read off the shipped rules; the latest is the landing. */
  const css = stripComments(inviteCss);
  const rises = [
    ...css.matchAll(
      /animation:\s*opening-rise\s+(calc\(var\(--duration-[a-z]+\)(?: \* [\d.]+)?\))\s+var\(--ease-entrance\)\s+(calc\(var\(--duration-[a-z]+\)(?: \* [\d.]+)?\))\s+backwards/g,
    ),
  ];
  assert.equal(
    rises.length,
    6,
    `expected six type rows, found ${rises.length}`,
  );
  const landing = Math.max(
    ...rises.map((m) => calcMs(m[2], "delay") + calcMs(m[1], "duration")),
  );
  assert.equal(typeEndMs(), landing);
});

test("the thread's fade starts at --opening-type-end rather than restating it", () => {
  assert.match(
    stripComments(moduleCss),
    /animation:\s*pageThreadFadeIn var\(--duration-base\) var\(--ease-entrance\)\s+var\(--opening-type-end\) both/,
  );
});

// The draw must start exactly as the fade ends, or the sequence's last beat is a fade over an empty
// stroke (draw late) or a line drawing before it is visible (draw early).
test("the timed draw begins as the thread's fade completes", () => {
  assert.equal(
    constant("OPENING_DRAW_DELAY"),
    typeEndMs() + tokenMs("duration-base"),
  );
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

/* SEVEN steps live in this file under Bloom: the flowers and six rows of type. The thread's own fade
   lives in `thread.module.css`, asserted separately below. */
test("no step of the invite's sequence animates without the gate", () => {
  const selectors = animatedSelectors(inviteCss);
  assert.equal(
    selectors.length,
    7,
    `expected the sequence's seven in-file steps, found ${selectors.length}`,
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

test("no mount or stock step remains", () => {
  assert.doesNotMatch(inviteCss, /mounted-sheet-frame__mount/);
  assert.doesNotMatch(inviteCss, /\.invite-settle\s*\{/);
});

/* THE FLOWERS NEVER FADE, AND THAT IS WORTH A GUARD BECAUSE IT IS A MEASURED CHOICE. They are the
   largest painted element on the opening screen, so starting them at opacity 0 delays the largest
   paint: measured on the static export at 390x844, **a fade 808ms (784-836) against a translate's
   248ms (228-264)**. No other gate in this repo would see the swap. Transform only also means the
   gesture can never isolate the multiply blend. */
test("the flowers' gesture is transform only, which keeps the largest paint early", () => {
  const css = stripComments(inviteCss);
  const beat = css.match(/\.botanical-piece\s*\{\s*animation:\s*([\w-]+)/);
  assert.ok(beat, "the botanical beat's animation declaration was not found");
  const frames = css.match(
    new RegExp(`@keyframes ${beat[1]}\\s*\\{([\\s\\S]*?)\\n  \\}`),
  );
  assert.ok(frames, `@keyframes ${beat[1]} not found`);
  const properties = new Set(frames[1].match(/[a-z-]+(?=\s*:)/g) ?? []);
  assert.deepEqual([...properties], ["transform"]);
});

/* `not-found` ships the SAME two pieces (`SECTION_PLACEMENT["not-found"]` is the invite's pair) and
   keeps a painted card, so the invite's own frame scope class is the only thing keeping this beat
   off the 404 screen. */
test("the botanical beat is scoped to the invite and never reaches not-found", () => {
  assert.match(
    inviteCss,
    /mounted-sheet-frame--invite[\s\S]{0,200}\.botanical-piece/,
    "the pieces must be animated inside the invite's own frame scope",
  );
  assert.doesNotMatch(inviteCss, /mounted-sheet-frame--not-found/);
});

/* The class is `botanical-piece` (`botanical-css.ts`'s PIECE_CLASS), not `bloom` -- `bloom` is the
   hashed CSS-module class, and a rule written from it would match nothing while every gate stayed
   green, which is the failure mode this project records for deleted Tailwind tokens. */
test("the beat targets the class the pieces actually carry", () => {
  assert.doesNotMatch(
    inviteCss,
    /\.bloom/,
    "`bloom` is the hashed module class; the global one is `botanical-piece`",
  );
});

/* Opacity on the PIECE, never on an ancestor: sub-1 opacity anywhere in a bloom's ancestor chain
   isolates `mix-blend-mode: multiply` and paints the piece's opaque white backing rectangle, with no
   error and every gate green (`botanical.module.css`'s header). `.layer` and `.clip` are that chain. */
/* A gesture on a bloom must sit on the PIECE. On any ancestor it isolates `mix-blend-mode: multiply`
   and the piece paints its opaque backing rectangle instead of blending (`botanical.module.css`).

   The ancestor that actually matters is `.mounted-sheet-frame--invite` ITSELF: `Botanical` stamps
   that class on its own wrapper (`frameScopeClass`), so a rule animating the bare scope class would
   isolate every bloom under it. An earlier version of this test forbade `.layer` and `.clip`, which
   are HASHED CSS-module classes a global stylesheet could never name — it guarded an impossible
   mutation while the reachable one passed untouched. Each animated selector must therefore reach
   something BEYOND the scope class. */
test("every beat animates a descendant, never the scope class a bloom hangs from", () => {
  const SCOPE = ".mounted-sheet-frame--invite";
  for (const selector of animatedSelectors(inviteCss)) {
    const flat = selector.replace(/\s+/g, " ").trim();
    if (!flat.includes(SCOPE)) continue;
    const after = flat.slice(flat.indexOf(SCOPE) + SCOPE.length).trim();
    assert.notStrictEqual(
      after,
      "",
      `this beat animates the scope class itself, which is a bloom's ancestor and isolates the multiply blend: ${flat}`,
    );
  }
});

/* The rows rise top to bottom, each after the one above — read off the shipped delays. */
test("the type rises top to bottom, after the flowers have begun", () => {
  const css = stripComments(inviteCss);
  const order = [
    "\\.type-eyebrow",
    "h1",
    "\\[data-invite-line\\]",
    "\\[data-invite-date\\]",
    "\\[data-invite-place\\]",
    "\\[data-invite-passage\\]",
  ].map((anchor) => {
    const m = css.match(
      new RegExp(
        `${anchor}\\s*\\{\\s*animation:\\s*opening-rise\\s+calc\\(var\\(--duration-fast\\) \\* [\\d.]+\\)\\s+var\\(--ease-entrance\\)\\s+(calc\\(var\\(--duration-fast\\) \\* [\\d.]+\\))`,
      ),
    );
    assert.ok(m, `${anchor}'s rise not found`);
    return calcMs(m[1], anchor);
  });
  assert.ok(
    order[0] > tokenMs("duration-fast"),
    "the type starts before the flowers",
  );
  for (let i = 1; i < order.length; i++) {
    assert.ok(order[i] > order[i - 1], `row ${i} does not follow row ${i - 1}`);
  }
});

/* The flowers are the first beat: `n = 1` is `1 x fast + 0 x base`, which is the bare token. */
test("the flowers are the sequence's first beat", () => {
  assert.match(
    inviteCss,
    /\.botanical-piece\s*\{[\s\S]{0,160}var\(--duration-fast\) backwards/,
  );
});
