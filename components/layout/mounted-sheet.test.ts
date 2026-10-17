import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { inviteFit } from "../../app/invite-fit.ts";
import {
  BREAKPOINT_REM,
  revealFor,
  type WidthTier,
  windowClasses,
} from "./mounted-sheet-frame.ts";
import { SPACING_TOKEN } from "./mounted-sheet-frame-css.ts";

/* Comments are stripped: the constants' own comments name the very utilities these assertions
   search for, so an unstripped read would let a comment satisfy an assertion about the code. */
const source = readFileSync(
  "components/layout/mounted-sheet.tsx",
  "utf8",
).replace(/\/\*[\s\S]*?\*\//g, "");

/* A card's paint follows its role (DESIGN.md -> Foundations -> Layout -> mounted-sheet -> The card's two
   states), and the paint lives in THIS file's utility strings rather than in the generated frame
   stylesheet: the generated stylesheet only ever STRIPS a section's fill where its mount does not show, and emits nothing for the hero's mount. So the role selects
   the paint here, and a framed branch that named a paint utility INLINE would go on painting the hero
   while every other assertion below still passed.

   Asserted on the framed branches rather than by counting occurrences file-wide: `MOUNT_REVEAL_FILL`
   legitimately names `bg-surface-mount` of its own, for the unfitted specimen path's reveal ladder, and
   a file-wide count would have to encode it as a magic total, which goes stale the moment the ladder
   changes for an unrelated reason. */
test("a framed branch takes its paint only from the gated constants", () => {
  const framed = source
    .split("\n")
    .filter((line) => /FRAME_CLASS\.(mount|sheet)/.test(line));
  assert.ok(framed.length > 0, "no framed branch found");
  for (const line of framed) {
    const paints = line.match(
      /bg-surface-mount|bg-surface-elevated|shadow-mount|shadow-stock|rounded-card/g,
    );
    assert.strictEqual(
      paints,
      null,
      `a framed branch names paint inline, so the role cannot gate it: ${line.trim()}`,
    );
  }
});

/* PAINT FOLLOWS FROM ROLE (owner, 2026-10-14): the hero is always unpainted, every other card always mounted. The
   records are keyed by role, read by walking braces from each header, and the hero arm must be EMPTY -- the
   unpainted card is a subtraction, so any utility in a hero arm is paint leaking onto the invitation's first screen. */
function roleRecords(src: string): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  const header = /const (\w+): Record<CardRole, string> = \{/g;
  for (let m = header.exec(src); m !== null; m = header.exec(src)) {
    let depth = 1;
    let at = m.index + m[0].length;
    while (depth > 0 && at < src.length) {
      if (src[at] === "{") depth += 1;
      if (src[at] === "}") depth -= 1;
      at += 1;
    }
    const record: Record<string, string> = {};
    for (const arm of src
      .slice(m.index + m[0].length, at - 1)
      .matchAll(/(\w+):\s*(?:`([^`]*)`|"([^"]*)")/g)) {
      record[arm[1]] = arm[2] ?? arm[3];
    }
    out[m[1]] = record;
  }
  return out;
}

test("every paint record is keyed by role, and the hero paints nothing", () => {
  const records = roleRecords(source);
  assert.deepStrictEqual(Object.keys(records).sort(), [
    "MOUNT_PAINT",
    "SHEET_PAINT",
    "UNFITTED_MOUNT_PAINT",
  ]);
  for (const [name, record] of Object.entries(records)) {
    assert.deepStrictEqual(
      Object.keys(record).sort(),
      ["hero", "section"],
      `${name}'s arms`,
    );
    assert.strictEqual(record.hero, "", `${name}.hero must paint nothing`);
    assert.ok(
      record.section.length > 0,
      `${name}.section paints nothing, so an ordinary card lost its backing`,
    );
    assert.doesNotMatch(
      record.section,
      /MOUNT_REVEAL\b|SHEET_PADDING|\bp-|\bflex|justify-|items-/,
      `${name}.section names geometry`,
    );
  }
});

test("no retired paint survives in either frame component", () => {
  for (const file of [
    "components/layout/mounted-sheet.tsx",
    "components/layout/mounted-pair.tsx",
  ]) {
    const src = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    /* `\bpaint\b` is the lowercase prop or parameter; the role records' names (`MOUNT_PAINT`) are uppercase and stay. */
    assert.doesNotMatch(
      src,
      /FramePaint|\bpaint\b|shadow-mounted-stock|STOCK_/,
      `${file} still carries the paint switch`,
    );
  }
});

test("a tall card refuses to be the hero", () => {
  assert.match(
    source,
    /if\s*\(([^)]*\bhero\b[^)]*\btall\b[^)]*|[^)]*\btall\b[^)]*\bhero\b[^)]*)\)\s*\{\s*throw new Error\(/,
    "no throw guards hero + tall -- a tall hero would be an unpainted tall card, which nothing wants",
  );
});

/* THE REVEAL LADDER CARRIES NO FILL. `MOUNT_REVEAL` once set the mount's colour and its padding in
   one string, so the paint could be gated and the reveal would go on painting underneath -- the
   unfitted branch then rendered an unpainted hero as a solid tan block, and it is the branch the
   gallery's specimen uses. Fill belongs to the gated paint constants; the ladder keeps only the
   padding that is geometry and must never be gated. */
test("the reveal ladder carries padding only, so a paint can drop every fill", () => {
  const ladder = source.match(/const MOUNT_REVEAL = \{[\s\S]*?\} as const;/);
  assert.ok(ladder, "no `MOUNT_REVEAL` declaration found");
  assert.doesNotMatch(
    ladder[0],
    /bg-/,
    "the reveal ladder must carry no background utility, or an unpainted card still paints one",
  );
});

/* Every branch, not just the framed ones: the unfitted branch is what the gallery renders, and it is
   where the leak above actually showed. A mount className that names a fill outside a gated constant
   cannot be turned off. */
test("no branch names a fill outside a gated paint constant", () => {
  for (const line of source
    .split("\n")
    .filter((l) => l.includes("className"))) {
    assert.doesNotMatch(
      line,
      /bg-surface-(mount|elevated)/,
      `a branch names a fill inline, so the role cannot gate it: ${line.trim()}`,
    );
  }
});

/* THE FITTED HERO'S REVEAL IS THE UTILITY LADDER, and the ladder must equal the arithmetic. The frame
   generator emits no mount rule for the hero (owner, 2026-10-14), so `MOUNT_REVEAL.hero` is what paints
   the hero's reveal, while `revealFor` is what every threshold, tier line and padding chain assumed it
   to be. Walked over every window class the real hero produces, touchscreen classes included — a
   width-keyed ladder and a width-tier-keyed reveal agree only while the tiers are cut at the same
   breakpoints Tailwind's `md:`/`lg:`/`xl:` read, so that is asserted too. */
test("the hero's reveal ladder equals revealFor in every window the hero can be in", () => {
  const block = source.match(/const MOUNT_REVEAL = \{[\s\S]*?\} as const;/);
  assert.ok(block, "no `MOUNT_REVEAL` declaration found");
  const heroArm = block[0].match(/hero:\s*"([^"]+)"/);
  assert.ok(heroArm, "no hero arm in `MOUNT_REVEAL`");

  const pxOfStep = Object.fromEntries(
    Object.entries(SPACING_TOKEN).map(([px, token]) => [
      token.replace(/^--spacing-/, ""),
      Number(px),
    ]),
  );
  const tierOfPrefix: Record<string, WidthTier> = {
    "": "phone",
    "md:": "tablet",
    "lg:": "laptop",
    "xl:": "desktop",
  };
  const ladder: Partial<Record<WidthTier, number>> = {};
  for (const utility of heroArm[1].split(/\s+/)) {
    const parts = utility.match(/^(md:|lg:|xl:)?p-(.+)$/);
    assert.ok(parts, `not an all-sides padding utility: ${utility}`);
    const px = pxOfStep[parts[2]];
    assert.ok(px !== undefined, `not a spacing step: ${utility}`);
    ladder[tierOfPrefix[parts[1] ?? ""]] = px;
  }
  assert.deepStrictEqual(
    Object.keys(ladder).sort(),
    ["desktop", "laptop", "phone", "tablet"],
    "the ladder must have one rung per width tier",
  );

  const tokens = readFileSync("app/styles/tokens.css", "utf8");
  for (const key of ["md", "lg", "xl"] as const) {
    assert.match(
      tokens,
      new RegExp(`--breakpoint-${key}:\\s*${BREAKPOINT_REM[key]}rem;`),
      `Tailwind's ${key}: is not cut where the frame's width tiers are`,
    );
  }

  let checked = 0;
  for (const windowClass of windowClasses(inviteFit, "single", true)) {
    const orientations: boolean[] = [];
    if (windowClass.portraitPossible) orientations.push(false);
    if (windowClass.landscapePossible) orientations.push(true);
    for (const landscape of orientations) {
      assert.strictEqual(
        ladder[windowClass.widthTier],
        revealFor(windowClass, true, landscape),
        `${windowClass.media} landscape=${landscape}`,
      );
      checked += 1;
    }
  }
  assert.ok(checked >= 4, `only ${checked} hero windows walked`);
});

/* The fitted branch must actually USE the ladder for the hero, and only for the hero: a section's
   reveal stays the generator's, which strips its fill where its mount does not show. The box diff in
   the H1 plan is the behavioural proof; this pins the wiring against a later edit. */
test("the fitted hero's mount carries the reveal ladder, and a section's does not", () => {
  const fitted = source.slice(source.indexOf("\n  if (fit !== undefined)"));
  const mountLine = fitted
    .split("\n")
    .find((line) => line.includes("FRAME_CLASS.mount"));
  assert.ok(mountLine, "no mount in the fitted branch");
  assert.match(mountLine, /hero \?[^:]*MOUNT_REVEAL\.hero[^:]*:\s*""/);
});
