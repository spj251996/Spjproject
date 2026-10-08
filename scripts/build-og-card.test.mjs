/* Synthetic fixtures only — no dev server, no tmp/, no gitignored path, so the suite runs the same
 * in every clone (see efef5c8). The fixture reproduces the shapes the extractors anchor on, not the
 * whole page: React renders a boolean data attribute as `data-invite-place="true"`, and the four
 * invite rows are emitted as one contiguous run inside a centring wrapper. */

import assert from "node:assert/strict";
import test from "node:test";
import {
  CARD,
  cardHtml,
  extractFontVars,
  extractInvite,
  extractSprigSymbol,
} from "./build-og-card.mjs";

const SYMBOL =
  '<svg aria-hidden="true" height="0" role="presentation" width="0" style="position:absolute">' +
  '<defs><symbol id="sprig-mark" viewBox="0 0 174.6 169.8"><path d="M 1 1"/></symbol></defs></svg>';

const INVITE_RUN =
  '<p class="type-eyebrow">We are getting married</p>' +
  '<h1 class="type-display-name text-ink mt-space-lg"><span>Flemy</span>' +
  '<span class="type-display-name__joiner"> &amp; </span><span>Sebastian</span></h1>' +
  '<p class="type-caption text-ink-muted mt-space-3xs" data-invite-line="true">invite you to celebrate our wedding</p>' +
  '<p class="type-date-primary text-ink mt-space-lg">' +
  '<time dateTime="2027-01-09">9<span class="type-caption type-date-ordinal align-super">th</span> January 2027</time></p>' +
  '<p class="type-date-primary font-medium text-ink mt-space-3xs" data-invite-place="true">Kerala</p>';

const PAGE =
  '<html lang="en" class="corinthia_x__variable playfair_y__variable h-full antialiased">' +
  `<body>${SYMBOL}<main><section><div class="flex flex-col items-center">${INVITE_RUN}</div>` +
  '<div data-invite-passage="true">passage</div></section></main></body></html>';

const html = () =>
  cardHtml({
    fontVars: "a__variable",
    invite: INVITE_RUN,
    sprigSymbol: SYMBOL,
    card: CARD,
  });

test("extractFontVars keeps only the next/font variable classes", () => {
  assert.equal(
    extractFontVars(PAGE),
    "corinthia_x__variable playfair_y__variable",
  );
});

test("extractFontVars throws when the page carries none", () => {
  assert.throws(
    () => extractFontVars('<html lang="en" class="h-full"></html>'),
    /no next\/font variable classes/,
  );
});

test("extractInvite returns the contiguous eyebrow-to-place run", () => {
  assert.equal(extractInvite(PAGE), INVITE_RUN);
});

/* `extractInvite` lifts ONE contiguous run, eyebrow to `data-invite-place`. Anything added outside
   that run vanishes from the card silently -- the overflow guard in the generator cannot see a
   missing element, only an oversized one. Phase 7 added the invitation's own line inside the run;
   this is what says so. */
test("extractInvite carries the invitation's own line", () => {
  const run = extractInvite(PAGE);
  assert.match(run, /data-invite-line/);
  assert.match(run, /invite you to celebrate our wedding/);
});

test("extractInvite throws when the place hook is gone", () => {
  assert.throws(
    () => extractInvite(PAGE.replace('data-invite-place="true"', "")),
    /invite markup incomplete/,
  );
});

test("extractInvite throws when the eyebrow is gone", () => {
  assert.throws(
    () =>
      extractInvite(PAGE.replace("We are getting married", "Save the date")),
    /invite markup incomplete/,
  );
});

test("extractSprigSymbol returns a zero-size svg wrapping the symbol", () => {
  const svg = extractSprigSymbol(PAGE);
  assert.match(svg, /^<svg /);
  assert.match(svg, /<symbol id="sprig-mark" viewBox="0 0 174\.6 169\.8">/);
  assert.match(svg, /<\/symbol><\/defs><\/svg>$/);
});

test("extractSprigSymbol throws when the symbol is absent", () => {
  assert.throws(
    () => extractSprigSymbol(PAGE.replace(SYMBOL, "")),
    /sprig symbol not found/,
  );
});

test("cardHtml emits the agreed geometry, derived from CARD", () => {
  const out = html();
  assert.match(out, /\.og-card\s*\{[^}]*padding:\s*96px/);
  assert.match(out, /grid-template-columns:\s*58fr 42fr/);
  assert.match(out, /width:\s*1200px/);
  assert.match(out, /height:\s*630px/);
});

test("cardHtml carries one surface and the invite's own rows", () => {
  const out = html();
  assert.ok(
    out.includes("bg-surface-elevated"),
    "the card is the invite's stock",
  );
  /* Rejected on a render as cramped: the card is ONE surface, so a band creeping back in is a
     regression, not a refinement. */
  for (const gone of [
    "bg-surface-base",
    "bg-surface-mount",
    "shadow-mount",
    "rounded-card",
  ]) {
    assert.ok(
      !out.includes(gone),
      `${gone} was dropped with the mount and ground`,
    );
  }
  assert.ok(out.includes("We are getting married"));
  assert.ok(out.includes("Kerala"));
  assert.match(out, /<use href="#sprig-mark">/);
});

test("cardHtml holds the names while every other role comes down", () => {
  const out = html();
  /* Inline, the mark sits on a line box and renders 55.8px when asked for 48. */
  assert.match(out, /\.og-sprig svg\s*\{[^}]*display:\s*block/);
  /* The card's own box, 1.164 — the page's ratio is about 1.51 and overflows. */
  assert.match(out, /--text-display-name--line-height:\s*135px/);
  assert.match(out, /--text-display-name:\s*116px/);
  /* The names are the one role that did NOT come down: "reduce size all text except couples
     names". A sweep that lowered them with the rest would pass every other assertion here. */
  assert.match(out, /--text-eyebrow:\s*21px/);
  assert.match(out, /--text-date-primary:\s*32px/);
});

test("cardHtml depends on no CSS module and no retired stock", () => {
  const out = html();
  assert.ok(
    !out.includes("wishes-module"),
    "the card must not borrow Wishes' hashed grid",
  );
  assert.ok(!out.includes("bg-surface-contrast"), "the green stock is retired");
});
