import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const PAGE = readFileSync("app/preview/page.tsx", "utf8");
const PANEL = readFileSync("app/preview/_panel.tsx", "utf8");
const CSS = readFileSync("app/preview/preview.css", "utf8");

/* Strips comments before matching. Every assertion below reads CODE, never prose: this file's own
   subjects are named in the comments that explain why they are there, so an unstripped match
   passes while the code carries nothing — the trap this project has now recorded four times. */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, " ")
    .replace(/^\s*\/\/.*$/gm, " ");
}

const PAGE_CODE = code(PAGE);
const PANEL_CODE = code(PANEL);
const CSS_CODE = code(CSS);

/* THE PANEL'S WHOLE ATTRIBUTE VOCABULARY, and the only list of it. Every name is `data-pv-*`,
   including Event Info's four — which the scratch route carried as bare `data-rail` &c. One
   namespace is what makes the root-attribute guard below a guard rather than a list of
   exceptions: a guard carrying four names it must forgive cannot see a fifth it should not. */
/* EVERY SURVIVING LEVER IS THE COUPLE'S as of 2026-10-10 — the tuning block is gone with the last
   value it held, which is why there is no second list. */
const COUPLE_FACING = [
  "rail",
  "dot-label",
  "dot-place",
  "icon-split",
  "ritual-align",
  "side-pad",
  "name-scale",
  "date-day",
  "date-rules",
];
const VOCABULARY = COUPLE_FACING.map((name) => `data-pv-${name}`);

test("the route mounts the real page rather than re-composing it", () => {
  assert.match(
    PAGE_CODE,
    /from "@\/app\/page"/,
    "a re-composed preview is a second copy of the composition and drifts from the one that ships",
  );
  for (const section of [
    "InviteSection",
    "EventInfoSection",
    "ContactSection",
    "FamilySection",
    "CelebrationsSection",
    "WishesSection",
    "Sections",
  ]) {
    assert.doesNotMatch(
      PAGE_CODE,
      new RegExp(`\\b${section}\\b`),
      `${section} named in the route — it must come through app/page.tsx, not a second composition`,
    );
  }
});

test("the panel is a sibling of the page, never a wrapper", () => {
  /* A wrapping client boundary can establish a stacking context, and a stacking context on any
     ancestor of a `.botanical-piece` isolates `mix-blend-mode: multiply` — nothing errors, every
     gate stays green, and only a sampled pixel shows it. */
  assert.doesNotMatch(
    PAGE_CODE,
    /<LeverPanel[^/>]*>[\s\S]*<Home/,
    "the panel wraps the page",
  );
  assert.match(PAGE_CODE, /<Home\s*\/>[\s\S]*<LeverPanel\s*\/>/);
});

test("every localStorage access is guarded", () => {
  /* It throws outright in a private window and with site data blocked, and an unguarded read
     inside a client component blanks its whole subtree — which would leave the couple looking at
     the page with no panel and no lever at all. */
  const accesses = PANEL_CODE.match(/localStorage/g) ?? [];
  assert.ok(accesses.length > 0, "the panel reads no storage at all");
  const tries = PANEL_CODE.match(/try\s*\{/g) ?? [];
  assert.equal(
    tries.length,
    accesses.length,
    `${accesses.length} localStorage accesses against ${tries.length} try blocks`,
  );
});

test("the panel writes only its own namespace onto the document root", () => {
  /* `app/layout.tsx` sets `data-opening-skipped` on the SAME element before hydration, and
     `app/invite.css` plus `thread.module.css` read `:root:not([data-opening-skipped])`. A panel
     that cleared or rewrote the root's attribute set would re-arm the invite's 1600ms opening
     mid-scroll.

     THE CLAIM IS ABOUT THE WHOLE VOCABULARY, NOT ABOUT ONE CALL SITE, and that is why it sweeps
     every `data-*` STRING LITERAL rather than the `setAttribute` arguments: the panel applies its
     attributes in ONE LOOP over a named list, so the call itself carries a variable and an
     argument-matching regex finds nothing while reporting a pass -- this file's own zero-match
     trap, and it fired here on the first run. Every attribute name the panel can reach is a
     literal in that list, so sweeping the literals is the stronger statement. */
  const literals = PANEL_CODE.match(/"data-[a-z-]+"/g) ?? [];
  assert.ok(
    literals.length >= VOCABULARY.length,
    `only ${literals.length} data-* literals against a ${VOCABULARY.length}-name vocabulary`,
  );
  for (const literal of literals) {
    assert.ok(
      literal.startsWith('"data-pv-'),
      `the panel names ${literal}, which is outside its own namespace`,
    );
  }
  assert.doesNotMatch(PANEL_CODE, /opening-skipped/i);
  assert.doesNotMatch(
    PANEL_CODE,
    /\.attributes\s*=|outerHTML|removeAttributeNode|getAttributeNames/,
  );
});

test("shipped state removes the attribute, so an untouched panel is the published page", () => {
  assert.match(
    PANEL_CODE,
    /removeAttribute/,
    "without a removal the shipped state would be a rule competing with the alternates'",
  );
  /* Asserted on the CSS too, because this is the property that makes the route the page: every
     rule in the alternates file is gated on an attribute, so at shipped the file matches nothing. */
  const selectors = CSS_CODE.match(/^\s*html\b[^{,]*/gm) ?? [];
  assert.ok(selectors.length > 0, "no html-rooted selectors in preview.css");
  for (const selector of selectors) {
    assert.match(
      selector,
      /\[data-pv-[a-z-]+/,
      `an ungated rule would paint on the published page too: ${selector.trim()}`,
    );
  }
});

test("every attribute the panel sets is a rule in the alternates, and vice versa", () => {
  /* The two files are the two halves of one vocabulary. A panel control with no CSS behind it is
     a dead switch the couple will press; a CSS rule with no control is unreachable weight. */
  for (const name of VOCABULARY) {
    assert.ok(PANEL_CODE.includes(name), `${name} has no control in the panel`);
    assert.ok(CSS_CODE.includes(name), `${name} has no rule in preview.css`);
  }
  const inCss = new Set(CSS_CODE.match(/data-pv-[a-z-]+/g) ?? []);
  for (const name of inCss) {
    assert.ok(
      VOCABULARY.includes(name),
      `${name} is styled but is not in the vocabulary`,
    );
  }
});

test("the panel never reads the viewport the wrong way", () => {
  /* Under device emulation `innerWidth` and `clientWidth` disagree, so a panel that reported a
     tier would report the wrong one. THE PANEL NOW READS NO VIEWPORT AT ALL — the measurement
     readout went with the tuning block on 2026-10-10 — so the positive half of this claim is gone
     and only the prohibition is left. Kept rather than deleted: the next thing anyone adds here
     that wants a width is exactly where this would bite. */
  assert.doesNotMatch(PANEL_CODE, /window\.innerWidth/);
  assert.doesNotMatch(
    PANEL_CODE,
    /screen\.width|outerWidth/,
    "neither of these is the viewport either",
  );
});

test("the Event Info alternates are marked preview-only", () => {
  /* `app/event-info-fit.ts` is GENERATED from the shipped layout. A CSS override cannot re-derive
     it, so an alternate can render a composition the production build will not produce — all six
     happen to measure 1704px today, which is why `/` needs no new fit, but an approval given to a
     render nobody can build is wasted either way. */
  assert.match(
    PANEL_CODE,
    /preview only/i,
    "the six Event Info candidates carry no preview-only mark",
  );
});

test("Event Info's alternates stay inside the phone band", () => {
  /* Every wider band is settled. The scratch route bounded the whole family in one query and the
     bound travels with the rules. */
  assert.match(CSS_CODE, /@media \(width < 48rem\)/);
  const railRules = (CSS_CODE.match(/html\[data-pv-rail/g) ?? []).length;
  assert.ok(
    railRules > 10,
    `only ${railRules} rail rules — the scratch route carried 39`,
  );
  const band = CSS_CODE.slice(CSS_CODE.indexOf("@media (width < 48rem)"));
  assert.equal(
    (band.match(/html\[data-pv-rail/g) ?? []).length,
    railRules,
    "a rail rule sits outside the phone band and would reach a settled tier",
  );
});

test("the alternates do not touch the botanical layer at all", () => {
  /* THIS TEST'S PREMISE CHANGED WITH THE FLOWERS LEVER (owner, 2026-10-10), and the stronger
     claim replaced the weaker one rather than being deleted with it. While that lever existed the
     claim was "no botanical rule here isolates the blend" — a `z-index`, `isolation`, `contain`,
     `filter`, sub-1 `opacity` or `content-visibility` on ANY ancestor of a `.botanical-piece`
     kills `mix-blend-mode: multiply`, silently and with every gate green. With the lever gone the
     file should name the layer NOWHERE, which is both easier to satisfy and harder to break by
     accident. The forbidden-property sweep is kept for whatever rules do exist, because a future
     lever on any ancestor would reach the pieces too. */
  assert.doesNotMatch(
    CSS_CODE,
    /botanical|falling-spray|arching-branch/,
    "the alternates name the botanical layer — the flowers lever is off the couple's review",
  );
  const rules = CSS_CODE.split("}");
  assert.ok(
    rules.length > 10,
    `only ${rules.length} rules parsed from preview.css`,
  );
  for (const rule of rules) {
    assert.doesNotMatch(
      rule,
      /\b(isolation|contain|content-visibility|filter)\s*:/,
      `an isolating property in the alternates: ${rule.trim().slice(0, 80)}`,
    );
  }
});

test("the six retired levers are gone from both files", () => {
  /* Each left for its own reason and each absence is asserted, so a later pass cannot reinstate
     one as a lever without deciding to:
     - `data-pv-eyebrow`, the flowers over the invite's eyebrow — the owner settled that clearance
       themselves, and its two alternates were the only options on the route with no measurement;
     - `data-pv-malayalam` — SETTLED at 600, and `app/layout.tsx` loads that cut alone;
     - `data-pv-heading-md` — SETTLED at 21/23/21/25px, in `tokens.css`;
     - `data-pv-amp` — SETTLED at 35% smaller, in `couple-names.tsx`;
     - `data-pv-names` — DROPPED rather than decided: the drawn asset ships and the couple are not
       asked, so the typeset alternate it showed is dead and `scripts/retire-register.mjs` carries
       it as `unused`.
     The last two are checked AT THEIR DESTINATIONS as well, because a stripped control with no
     landed value is the failure this gate exists to catch — it would read as a decision taken and
     leave the page on the old number. */
  for (const retired of [
    "data-pv-eyebrow",
    "data-pv-malayalam",
    "data-pv-heading-md",
    "data-pv-amp",
    "data-pv-names",
  ]) {
    assert.ok(
      !PANEL_CODE.includes(retired),
      `${retired} still has a control in the panel`,
    );
    assert.ok(
      !CSS_CODE.includes(retired),
      `${retired} still has a rule in preview.css`,
    );
  }
  const tokens = readFileSync("app/styles/tokens.css", "utf8");
  assert.deepStrictEqual(
    [...tokens.matchAll(/--text-heading-md:\s*(\d+)px/g)].map((m) => m[1]),
    ["21", "23", "21", "25"],
    "the title size was stripped from the route but not landed in the token ladder",
  );
  const names = readFileSync("components/ui/couple-names.tsx", "utf8");
  assert.match(
    names,
    /const AMPERSAND_SCALE = 0\.65;/,
    "the ampersand scale was stripped from the route but not landed in the component",
  );
  /* The dropped lever's own follow-through: its alternate must be REGISTERED as unused, not left
     looking like a pending answer. A dead alternate with a `temporary` entry would sit in the tree
     indefinitely, because the sweep that reads this list waits for exactly that word to change. */
  const register = readFileSync("scripts/retire-register.mjs", "utf8");
  /* ANCHORED ON THE ENTRY'S OWN FIELD, not on the name. A first version sliced from the first
     occurrence of each name, which is in the register's HEADER PROSE — so it read a comment that
     mentions both and fails every `kind` check. That is this project's own comment-matching trap,
     recorded four times and hit here in the gate written to catch something else. */
  for (const dead of [
    'symbol: "splitCoupleNames"',
    'path: "app/couple-names.css"',
  ]) {
    const at = register.indexOf(dead);
    assert.notStrictEqual(
      at,
      -1,
      `${dead} is not an entry in the retire register`,
    );
    const entry = register.slice(at, register.indexOf("},", at));
    /* THE LABEL IS PER SUBJECT, and getting it wrong is what stalls Phase 9 rather than what
       breaks the page. `unused` promises zero consumers — follow it and you delete on sight — so
       only the STYLESHEET earns it: nothing un-hides the alternate any more, so its single rule
       hides markup nobody can reach. `splitCoupleNames` has two live callers and its output IS
       rendered, into the span that stylesheet hides, so it is `temporary`: the deletion is a
       decision, not a confirmation. It was registered `unused` until 2026-10-11, which this
       assertion required and a whole-branch review caught. */
    const expected = dead.includes("couple-names.css")
      ? /kind: "unused"/
      : /kind: "temporary"/;
    assert.match(
      entry,
      expected,
      `${dead} carries the wrong kind: \`unused\` promises Phase 9 zero consumers, and splitCoupleNames has two`,
    );
  }
  /* Both go in ONE commit whatever their labels, once the couple confirm the drawn names (owner,
     2026-10-11) — removing the stylesheet alone paints both forms of the names at once. */
  assert.match(
    register,
    /couple confirm the drawn names|couple confirm the preview/,
    "the removal window the owner set is not written in the register",
  );
});

test("every ritual form, and the photographs' right alignment, holds at every tier", () => {
  /* Owner, 2026-10-11: "sprig title malayalam on same baseline in all tiers", then the photographs
     and their button "right alignment in all tiers". So no ritual rule is banded: the whole block,
     from the header line to the strip's alignment, sits outside any media query. Asserted as the
     shape of the file, because the recorded failure on this route was a whole arrangement going
     missing at one tier. */
  const start = CSS_CODE.indexOf("html[data-pv-ritual-align] #celebrations");
  const end = CSS_CODE.indexOf("html[data-pv-side-pad]");
  assert.ok(
    start >= 0 && end > start,
    "the ritual block is not where the gate expects it",
  );
  const block = CSS_CODE.slice(start, CSS_CODE.lastIndexOf("@media", end));
  assert.ok(!block.includes("@media"), "a ritual rule is inside a media query");
  for (const [rule, what] of [
    ["flex-wrap: wrap", "the header line's flow"],
    ["display: contents", "the two-level promotion"],
    ["svg:nth-of-type(2)", "the trailing sprig's hide"],
    ["order: -2", "the sprig leading the line"],
    ["order: -1", "the title before the Malayalam"],
    ["text-align: end", "the photographs' right alignment"],
    ["align-items: flex-end", "the button following the strip right"],
  ]) {
    assert.ok(block.includes(rule), `${what} is missing from the ritual block`);
  }
  assert.ok(
    !CSS_CODE.includes('data-pv-ritual-align="rail"'),
    "the rail left the route (owner, 2026-10-11)",
  );
});

test("the close control cannot scroll out of reach", () => {
  /* The panel scrolls — three groups do not fit 70svh on a phone —
     so a close button in normal flow leaves the couple scrolling back up inside the panel to get
     it out of the way (owner, 2026-10-10). It is sticky, and its background is restated because
     a sticky child paints over what slides under it while the shell's own background sits on the
     scroll container. */
  assert.match(PANEL_CODE, /position: "sticky"/);
  const header = PANEL_CODE.match(/position: "sticky"[\s\S]{0,400}/)?.[0] ?? "";
  assert.match(
    header,
    /background:/,
    "a sticky header with no background of its own",
  );
  const closeAt = PANEL_CODE.indexOf("Close the options panel");
  const stickyAt = PANEL_CODE.indexOf('position: "sticky"');
  assert.ok(
    stickyAt !== -1 && stickyAt < closeAt,
    "the close button is not inside the sticky header",
  );
});

/* THE COUPLE'S FIRST TAP, which is the one the panel is most likely to lose. The panel is
   server-rendered OPEN, so its radios paint and accept taps long before React hydrates — on a
   phone over a mobile connection that window is ordinary, not exotic. A tap landing in it flips
   the DOM's own `checked` while React's state does not move, and React never reconciles a radio
   the DOM changed under it; from then on a click on an already-checked radio fires no `change`
   event at all. MEASURED against the real page with the JS chunks delayed: two taps applied
   nothing and the panel showed a selection the page was not in. Both halves of the repair are
   asserted here because each fails differently — without `onClick` the control stays dead, and
   without the mount reconcile the panel keeps lying about what is applied. */
test("a tap that lands before hydration cannot leave a lever dead or the panel lying", () => {
  const input = PANEL_CODE.match(/<input[\s\S]{0,320}?\/>/)?.[0] ?? "";
  assert.match(
    input,
    /type="radio"/,
    "the choice control is not a radio any more",
  );
  assert.match(
    input,
    /onClick=\{\(\) => onChoose\(index\)\}/,
    "onChange alone: a click on an already-checked radio fires no change event, so the couple's re-tap does nothing",
  );
  assert.match(
    input,
    /onChange=\{\(\) => onChoose\(index\)\}/,
    "onClick alone would not carry keyboard selection",
  );
  const reconcile =
    PANEL_CODE.match(
      /useEffect\(\(\) => \{[\s\S]{0,700}?radio\.checked[\s\S]{0,200}?\}, \[\]\);/,
    )?.[0] ?? "";
  assert.ok(
    reconcile,
    "no mount effect puts the radios back in step with the applied state",
  );
  assert.match(
    reconcile,
    /SHIPPED\[lever\.id\]/,
    "the reconcile must restore the SHIPPED state, which is what the page is actually in at mount",
  );
  assert.match(
    reconcile,
    /\}, \[\]\);$/,
    "the reconcile must run once, or it fights a real selection",
  );
});
