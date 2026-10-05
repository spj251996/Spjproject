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

/* The type is the sequence's SECOND beat under the hero card's unpainted option, which the
   invitation takes: the mount and stock settles are gone, because they animated layers that option
   does not paint, and the flowers took the first beat in their place (owner, 2026-10-05 — DESIGN.md
   → Motion → The opening sequence). The painted option's four-beat ladder, with the type third, is
   documented there as the alternative. */
/* Reads BOTH delays out of the stylesheets that ship them. The earlier version computed each side
   from the tokens and compared the results -- `3 x fast + 2 x base + base` against
   `3 x fast + 3 x base` -- so it asserted 1800 === 1800 and would have passed whatever the CSS said.
   It was vacuous before this change and vacuous after it; a check that runs and passes reads as
   evidence whatever it asserts, so it now parses the shipped expressions instead. */
/* The base multiplier is optional because `n = 2` writes `+ var(--duration-base)` with no `* 1`,
   which is how the shipped stylesheet spells it. An absent multiplier is one, not zero. */
function delayMs(rawCss: string, anchor: string, what: string) {
  /* Comments stripped before anchoring. `app/invite.css`'s header names `[data-invite-stack]` in
     prose, ~85 lines above the rule, so a lazy search from the first occurrence starts inside a
     comment and only reaches the right `calc()` because nothing between them happens to be one.
     Any `calc(…)` written into a comment in between would silently redirect this assertion. */
  const css = rawCss.replace(/\/\*[\s\S]*?\*\//g, "");
  const match = css.match(
    new RegExp(
      `${anchor}[\\s\\S]*?calc\\(var\\(--duration-fast\\) \\* (\\d+) \\+ var\\(--duration-base\\)(?: \\* (\\d+))?\\)`,
    ),
  );
  assert.ok(match, `${what} delay expression not found`);
  return (
    Number(match[1]) * tokenMs("duration-fast") +
    Number(match[2] ?? 1) * tokenMs("duration-base")
  );
}

test("the fade begins as the type lands, not a beat after it", () => {
  const typeDelay = delayMs(inviteCss, "\\[data-invite-stack\\]", "the type's");
  const fadeStart = delayMs(
    moduleCss,
    "animation:\\s*pageThreadFadeIn",
    "the thread fade's",
  );
  assert.equal(
    fadeStart,
    typeDelay + tokenMs("duration-base"),
    "the thread's fade must begin exactly as the type's own fade completes",
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

/* TWO steps live in this file, not three: the flowers and the type. The thread's own fade is the
   third and lives in `thread.module.css`, asserted separately below. Under the painted option this
   file carried three — the mount's settle, the stock's settle and the type — and dropping two while
   gaining one is what makes the number move. */
test("no step of the invite's sequence animates without the gate", () => {
  const selectors = animatedSelectors(inviteCss);
  assert.equal(
    selectors.length,
    2,
    `expected the sequence's two in-file steps, found ${selectors.length}`,
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

/* ---------------------------------------------------------------------------------------------
   The hero card's unpainted option, 2026-10-05. The invitation paints no mount and no stock, so the
   two settle beats animated nothing and the invite's own botanical pieces took the first beat in
   their place. DESIGN.md → Foundations → Layout → mounted-sheet → The hero card's two options holds
   both sequences and the one-word restoration.
   --------------------------------------------------------------------------------------------- */

test("the vacated mount and stock steps are gone", () => {
  assert.doesNotMatch(inviteCss, /mounted-sheet-frame__mount/);
  assert.doesNotMatch(inviteCss, /\.invite-settle\s*\{/);
});

/* The settle keyframe is now the flowers' own gesture, and it is also what the painted option's
   restoration recipe in DESIGN.md points at for the mount and the stock. Either way, deleting it as
   "dead" would break something. */
test("the settle keyframe survives for the painted option's restoration", () => {
  assert.match(inviteCss, /@keyframes invite-settle/);
});

/* THE FLOWERS SETTLE RATHER THAN FADE, AND THAT IS WORTH A GUARD BECAUSE IT IS A MEASURED CHOICE.
   With no mount painting, the flowers are the largest painted element on the opening screen, so
   starting them at opacity 0 delays the largest paint: measured on the static export at 390x844,
   three runs each, same build, **fade 808ms (784-836) against settle 248ms (228-264)**. Swapping the
   keyframe back would cost ~560ms of LCP against PROJECT.md's own success metric, and no other gate
   in this repo would see it. The settle is also the gesture the owner already chose for the mount
   for exactly this reason, and it never takes opacity below 1, so it cannot isolate the multiply
   blend even in principle. */
test("the flowers settle rather than fade, which is what keeps the largest paint early", () => {
  const beat = inviteCss.match(
    /\.botanical-piece\s*\{\s*animation:\s*([\w-]+)/,
  );
  assert.ok(beat, "the botanical beat's animation declaration was not found");
  assert.strictEqual(
    beat[1],
    "invite-settle",
    "the flowers must settle, not fade: a fade costs ~560ms of LCP because they are the largest painted element on the opening screen",
  );
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

/* Asserted as the EXPRESSION rather than a literal 800ms: the formula is the rule the owner set, and
   a literal would pass a retime that broke the formula while still landing on the same number. */
test("the type is the sequence's second beat", () => {
  assert.match(
    inviteCss,
    /\[data-invite-stack\][\s\S]{0,240}calc\(var\(--duration-fast\) \* 2 \+ var\(--duration-base\)\)/,
  );
});

/* The flowers are the first beat: `n = 1` is `1 x fast + 0 x base`, which is the bare token. */
test("the flowers are the sequence's first beat", () => {
  assert.match(
    inviteCss,
    /\.botanical-piece\s*\{[\s\S]{0,160}var\(--duration-fast\) backwards/,
  );
});
