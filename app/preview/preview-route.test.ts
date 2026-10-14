import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
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

/* THE PANEL'S WHOLE ATTRIBUTE VOCABULARY, and the only list of it. Every name is `data-pv-*`, and
   one namespace is what makes the root-attribute guard below a guard rather than a list of
   exceptions. ONE LEVER REMAINS (2026-10-14): the family photos blended into the card. Every other
   lever landed in the section files and is checked where it landed, below and in
   `app/round7-9.test.ts`. */
const COUPLE_FACING = ["invite-gap", "event-rhythm"];
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

test("every storage access is guarded", () => {
  /* It throws outright in a private window and with site data blocked, and an unguarded read
     inside a client component blanks its whole subtree — which would leave the couple looking at
     the page with no panel and no lever at all. */
  const accesses = PANEL_CODE.match(/(local|session)Storage/g) ?? [];
  assert.ok(accesses.length > 0, "the panel reads no storage at all");
  const tries = PANEL_CODE.match(/try\s*\{/g) ?? [];
  assert.equal(
    tries.length,
    accesses.length,
    `${accesses.length} storage accesses against ${tries.length} try blocks`,
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

test("the 2026-10-14 picks left the route: family photos, progress line, opening and phone paper", () => {
  for (const gone of [
    "data-pv-portrait",
    "data-pv-progress-height",
    "data-pv-progress-glow",
    "data-pv-opening",
    "data-pv-replaying",
    "data-pv-grain",
  ]) {
    assert.equal(PANEL_CODE.includes(gone), false, `${gone} is still a lever`);
    assert.equal(CSS_CODE.includes(gone), false, `${gone} still has a rule`);
    assert.equal(
      PAGE_CODE.includes(gone),
      false,
      `${gone} is still in page.tsx`,
    );
  }
  assert.doesNotMatch(
    PAGE_CODE,
    /<script|sessionStorage/,
    "the replay script is still on the route",
  );
  /* The progress line's picks, checked where they landed (owner, 2026-10-14): 2px on a phone,
     3px from the tablet up, the soft glow. */
  const tokens = readFileSync("app/styles/tokens.css", "utf8");
  assert.match(tokens, /--progress-height: 3px;/);
  assert.match(
    tokens,
    /@variant max-md \{[^}]*--progress-height: 2px;[^}]*\}/,
    "the phone's 2px line is not in tokens.css",
  );
  assert.match(
    tokens,
    /--progress-glow: drop-shadow\(\s*0 0 2px color-mix\(in srgb, var\(--color-thread-vermilion\) 55%, transparent\)\s*\);/,
  );
});

test("the alternates do not touch the botanical layer at all", () => {
  /* A `z-index`, `isolation`, `contain`, `filter`, sub-1 `opacity` or `content-visibility` on ANY
     ancestor of a `.botanical-piece` kills `mix-blend-mode: multiply`, silently and with every gate
     green. With the opening's candidates gone (Bloom ships, 2026-10-14) the file names the layer
     NOWHERE again. The forbidden-property sweep stays for whatever rules do exist, because a lever
     on any ancestor would reach the pieces too. */
  assert.doesNotMatch(
    CSS_CODE,
    /botanical|falling-spray|arching-branch/,
    "the alternates name the botanical layer",
  );
  const rules = CSS_CODE.split("}");
  /* The levers' own rules; a lower count means the parse broke, not that the file shrank. */
  assert.ok(
    rules.length > 3,
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
     - `data-pv-heading-md` — SETTLED, in `tokens.css`; 18/20/18/21px since 2026-10-11;
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
    ["18", "20", "18", "21"],
    "the title size was stripped from the route but not landed in the token ladder",
  );
  const names = readFileSync("components/ui/couple-names.tsx", "utf8");
  assert.match(
    names,
    /const AMPERSAND_SCALE = 0\.65;/,
    "the ampersand scale was stripped from the route but not landed in the component",
  );
  /* The dropped lever's alternate — the typeset names — is RETIRED (owner, 2026-10-14), so nothing
     of it may linger behind a hidden marker. `app/names-retired.test.ts` owns the whole sweep. */
  assert.ok(
    !existsSync("app/couple-names.css"),
    "the typeset alternate's stylesheet is still in the tree",
  );
});

/* SIX LEVERS LEFT ON 2026-10-11 (owner) AND EACH IS CHECKED WHERE IT LANDED, because a stripped
   control with no landed value reads as a decision taken and leaves the page on the old value. */
test("the 2026-10-11 picks left the route and landed in code", () => {
  for (const retired of [
    "data-pv-date-space",
    "data-pv-day-weight",
    "data-pv-glow",
    "data-pv-ritual-align",
    "data-pv-side-pad",
  ]) {
    assert.ok(!PANEL_CODE.includes(retired), `${retired} still has a control`);
    assert.ok(!CSS_CODE.includes(retired), `${retired} still has a rule`);
  }
  const tokens = readFileSync("app/styles/tokens.css", "utf8");
  /* The opening is one token now: 8px from the tablet, 7px at laptop (8 refused the compact-touchscreen
     tier line by 2px), and 4px on a phone since the invite came back inside one screen (2026-10-14). */
  assert.match(
    tokens,
    /--date-weekday-pull:\s*calc\(var\(--date-open\) - 5px\);/,
    "the weekday's row is no longer pulled off the opening",
  );
  assert.deepStrictEqual(
    [...tokens.matchAll(/--date-open:\s*(\d+)px;/g)].map((m) => m[1]),
    ["4", "8", "7", "8"],
    "the date's opening by tier — phone, tablet, laptop, desktop",
  );
  assert.match(
    readFileSync("app/_sections/invite.tsx", "utf8"),
    /mt-\[calc\(var\(--spacing-space-3xs\)\+var\(--date-open\)-var\(--date-place-pull\)\)\]/,
    "the date's opening below the day",
  );
  assert.match(
    tokens,
    /--text-date-day--font-weight:\s*400;/,
    "the day at regular",
  );
  assert.match(
    tokens,
    /--shadow-glow-couple:\s*0 0 14px 3px/,
    "the medium glow",
  );
  assert.match(
    readFileSync("components/family/family.tsx", "utf8"),
    /glow=\{COUPLE\.has\(member\.relationship\)\}/,
    "the glow reaches the couple's portraits",
  );
  assert.match(
    tokens,
    /--tall-inline-phone:\s*36px;/,
    "the 36px phone padding",
  );
  const module = readFileSync("app/celebrations.module.css", "utf8");
  const text = module.slice(
    module.indexOf(".text {"),
    module.indexOf("}", module.indexOf(".text {")),
  );
  assert.match(text, /text-align:\s*start/, "the rituals left-aligned");
  assert.match(
    readFileSync("app/_sections/celebrations.tsx", "utf8"),
    /mt-space-sm w-full text-end/,
    "the photographs at the block's right edge",
  );
});

test("the close control cannot scroll out of reach", () => {
  /* The panel scrolls on a short phone, where its group and notes outgrow 70svh —
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
