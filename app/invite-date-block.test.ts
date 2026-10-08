/* The date block's claims — DESIGN.md → Domain Components → Invite → `date-block` owns the reasons;
   this pins the handful that render perfectly when broken.

   Each is a geometry claim a later edit can satisfy visually at one width and break at another, or a
   claim about which element carries which job. None of them is a value: the values live in
   `tokens.css` and step per tier, and asserting one here would pin a tier rather than a rule. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const section = readFileSync("app/_sections/invite.tsx", "utf8");
const block = readFileSync("app/invite-date.module.css", "utf8");
const typeScale = readFileSync("app/styles/type-scale.css", "utf8");

function rule(css: string, selector: string): string {
  const at = css.indexOf(`${selector} {`);
  assert.notStrictEqual(at, -1, `no ${selector} in the stylesheet`);
  return css.slice(at, css.indexOf("}", at));
}

test("the outer tracks are equal, which is what centres the day", () => {
  const columns = rule(block, ".block").match(
    /grid-template-columns:([^;]+);/,
  )?.[1];
  assert.ok(columns, "the block declares no columns");
  const tracks = columns.trim().split(/\s+(?![^(]*\))/);
  assert.equal(tracks.length, 5, `expected five tracks, got: ${columns}`);
  assert.equal(
    tracks[0],
    tracks[4],
    "the outer tracks differ, so the day no longer sits on the card's centre axis",
  );
  assert.equal(tracks[0], "1fr");
});

test("the weekday sits in the centre track, so the bracket encloses it", () => {
  const weekday = section.match(
    /type-date-label \$\{dateBlock\.weekday\}([^`]*)`/,
  )?.[1];
  assert.ok(weekday, "the weekday's class list moved — re-anchor this test");
  assert.match(
    weekday,
    /\bcol-start-3\b/,
    "the weekday left the centre track; it is what sizes that track, so the bracket now fits the day alone",
  );
});

test("the hairline is a bracket, not an underline", () => {
  const hairline = rule(block, ".hairline");
  /* Bounded by the declaration's own `;`, not by the next `)` — the value legitimately contains
     `var(...)`, so a paren-bounded slice truncates inside it and the assertions below read a
     fragment. */
  const top = hairline.match(/top:\s*([^;]+);/)?.[1];
  assert.ok(top, "the hairline is no longer placed from the day's baseline");
  /* Its top is the overshoot MINUS its own height, so its bottom lands the overshoot BELOW the
     baseline. A `top` that is just the negated height would stop the rule exactly on the baseline
     and the block would read as a table. */
  assert.match(top, /--spacing-space-3xs/);
  assert.match(top, /--rule-date-bracket/);
  assert.ok(
    top.includes("-"),
    `the bracket no longer reaches above the baseline: ${top}`,
  );
});

test("the hairline takes the page's one stroke width and the faint rule colour", () => {
  const hairline = rule(block, ".hairline");
  assert.match(hairline, /width:\s*var\(--stroke-divider\)/);
  assert.match(hairline, /background:\s*var\(--color-rule-faint\)/);
  assert.doesNotMatch(
    hairline,
    /var\(--color-(ink|accent-gold)\)/,
    "the rule must read lighter than the type it brackets",
  );
});

test("the rule is anchored on the baseline, not on a line box", () => {
  const anchor = rule(block, ".hairlineAnchor");
  assert.match(anchor, /height:\s*0/);
  assert.match(anchor, /vertical-align:\s*baseline/);
  assert.match(anchor, /position:\s*relative/);
});

test("both date-block roles take lining figures", () => {
  for (const role of ["type-date-label", "type-date-day"]) {
    assert.match(
      rule(typeScale, `.${role}`),
      /font-variant-numeric:\s*lining-nums/,
      `.${role} lost lining figures — the serif's own figures descend out of the bracket`,
    );
  }
});

test("the day is a bare numeral with no raised ordinal", () => {
  const at = section.indexOf("function InviteDate");
  const body = section.slice(at, section.indexOf("\nfunction ", at + 1));
  assert.match(
    body,
    /<time/,
    "the day no longer carries its machine-readable date",
  );
  assert.match(body, /dateTime=\{date\.iso\}/);
  assert.doesNotMatch(
    body,
    /date\.ordinal|type-date-ordinal/,
    "a raised ordinal inside the bracket collides with the rule",
  );
  assert.doesNotMatch(
    body,
    /<PrimaryDate/,
    "the block composes its own parts; PrimaryDate renders one line with an ordinal",
  );
});
