/* Synthetic fixtures only — no dev server, no tmp/, no gitignored path, so the suite runs the same
 * in every clone. The fixture reproduces the shapes the extractors anchor on, not the whole page:
 * the root layout's hidden symbol sheets, the invite's `<h1>` with both name layouts, its passage's
 * divider, and Event Info's two sheet dates with their ordinal in its own element. */

import assert from "node:assert/strict";
import test from "node:test";
import {
  CARD,
  cardHtml,
  extractDates,
  extractDivider,
  extractFontVars,
  extractNames,
  extractSymbols,
  PIECES,
} from "./build-og-card.mjs";

const SPRIG =
  '<svg aria-hidden="true" height="0" role="presentation" width="0" style="position:absolute">' +
  '<defs><symbol id="sprig-mark" viewBox="0 0 174.6 169.8"><path d="M 1 1"/></symbol></defs></svg>';
const NAMES =
  '<svg aria-hidden="true" height="0" role="presentation" style="position:absolute" width="0"><defs>' +
  '<symbol id="names-sebastian" viewBox="0 0 1 1"></symbol><symbol id="names-ampersand" viewBox="0 0 1 1"></symbol>' +
  '<symbol id="names-flemy" viewBox="0 0 1 1"></symbol></defs></svg>';

const H1 =
  '<h1 class="text-(length:--text-display-name) text-ink"><span class="sr-only">Sebastian &amp; Flemy</span>' +
  '<svg data-names-layout="stacked"><use href="#names-sebastian"></use></svg>' +
  '<svg data-names-layout="line"><use href="#names-sebastian"></use></svg></h1>';

const DIVIDER =
  '<div aria-hidden="true" class="ornamental-divider-module__x__rule " role="presentation">' +
  '<span class="hairline"></span><span><svg viewBox="0 0 174.6 169.8"><use href="#sprig-mark"></use></svg></span>' +
  '<span class="hairline"></span></div>';

const sheet = (id, weekday, day) =>
  `<h2 class="type-heading-xl" data-event="${id}">${id}</h2><div><p class="type-date-primary text-ink">` +
  `<time>${weekday}, ${day}<span class="type-date-ordinal">th</span> <span class="md:hidden">Jan</span>` +
  '<span class="hidden md:inline">January</span> 2027</time></p></div>';

const PAGE =
  '<html lang="en" class="libre_x__variable playfair_y__variable h-full antialiased">' +
  `<body>${SPRIG}${NAMES}<main><section id="invite">${H1}` +
  `<div data-invite-passage="true"><div class="grow"></div>${DIVIDER}<p>verse</p></div></section>` +
  `<section id="event-info">${sheet("engagement", "Monday", 4)}${sheet("wedding", "Saturday", 9)}</section>` +
  "</main></body></html>";

test("extractFontVars keeps only the next/font variable classes", () => {
  assert.equal(extractFontVars(PAGE), "libre_x__variable playfair_y__variable");
});

test("extractNames lifts the invite's whole <h1>, both layouts", () => {
  assert.equal(extractNames(PAGE), H1);
});

test("extractNames fails loudly when the drawn names are gone", () => {
  assert.throws(
    () => extractNames(PAGE.replace(H1, "<h1>Sebastian</h1>")),
    /no drawn names/,
  );
});

test("extractDivider lifts the passage's divider and nothing after it", () => {
  assert.equal(extractDivider(PAGE), DIVIDER);
});

test("extractDivider fails loudly when the passage carries none", () => {
  assert.throws(
    () => extractDivider(PAGE.replace(DIVIDER, "")),
    /divider was not found/,
  );
});

/* The names render through `<use>`, which resolves against ITS OWN document — the card's. The
   previous generator lifted only the sprig, and its card shipped with no names at all. */
test("extractSymbols carries the names' symbols as well as the sprig", () => {
  const symbols = extractSymbols(PAGE);
  for (const id of [
    "sprig-mark",
    "names-sebastian",
    "names-ampersand",
    "names-flemy",
  ]) {
    assert.ok(symbols.includes(`id="${id}"`), id);
  }
  assert.throws(
    () => extractSymbols(PAGE.replace(NAMES, "")),
    /#names-sebastian/,
  );
});

test("extractDates reads both days off the event sheets, month and year once", () => {
  assert.equal(extractDates(PAGE), "4th &amp; 9th January 2027");
});

test("extractDates refuses two dates that do not share a month", () => {
  const moved = PAGE.replace(
    '9<span class="type-date-ordinal">th</span> <span class="md:hidden">Jan</span><span class="hidden md:inline">January</span>',
    '9<span class="type-date-ordinal">th</span> <span class="md:hidden">Feb</span><span class="hidden md:inline">February</span>',
  );
  assert.throws(() => extractDates(moved), /do not share a month/);
});

const html = () =>
  cardHtml({
    fontVars: "a__variable",
    names: H1,
    divider: DIVIDER,
    symbols: SPRIG + NAMES,
    dates: "4th &amp; 9th January 2027",
    card: CARD,
  });

test("the card is the invite's ground, 1200x630", () => {
  assert.match(html(), /class="og-card bg-surface-base"/);
  assert.match(
    html(),
    new RegExp(`width: ${CARD.width}px;\\s*height: ${CARD.height}px;`),
  );
});

test("both invite flowers sit in their corners, each blended on its own element", () => {
  const out = html();
  for (const { piece } of PIECES)
    assert.ok(out.includes(`botanical/${piece}-desktop.webp`), piece);
  assert.match(out, /\.og-flower \{[^}]*mix-blend-mode: multiply/);
  assert.doesNotMatch(
    out,
    /\.og-card \{[^}]*(?:opacity|filter|transform|isolation)/,
  );
});

test("the dates take date-label's role, and its size is the card's", () => {
  assert.match(
    html(),
    /<p class="og-dates type-date-label text-ink">4th &amp; 9th January 2027<\/p>/,
  );
  assert.match(html(), new RegExp(`--text-date-label: ${CARD.dates}px`));
  assert.match(html(), new RegExp(`--text-display-name: ${CARD.names}px`));
});

test("the card carries the symbols its names and sprig resolve against", () => {
  assert.ok(html().includes('id="names-flemy"'));
  assert.ok(html().includes('id="sprig-mark"'));
});

test("no eyebrow, illustration, place or passage", () => {
  assert.doesNotMatch(html(), /type-eyebrow|couple\/|data-invite-place|verse/);
});

/* Values the owner picked by eye on renders (2026-10-14) — pinned, so a later run cannot drift them. */
test("the card's sizes are the owner's picks", () => {
  assert.equal(CARD.names, 124);
  assert.equal(CARD.dates, 24);
  assert.equal(CARD.flowers, 1.65);
  assert.equal(CARD.sprayDrop, 60);
});
