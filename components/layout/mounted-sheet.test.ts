import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/* Comments are stripped: the constants' own comments name the very utilities these assertions
   search for, so an unstripped read would let a comment satisfy an assertion about the code. */
const source = readFileSync(
  "components/layout/mounted-sheet.tsx",
  "utf8",
).replace(/\/\*[\s\S]*?\*\//g, "");

/* `mounted-pair.tsx` grew its own paint records when the pair learned the enum, and nothing read them:
   every record test below pointed at `mounted-sheet.tsx` alone, so the pair's arm count, its geometry
   leakage and its empty-`none` rule were ungated. The records are the same shape in both files, so the
   parsers take both sources. */
const pairSource = readFileSync(
  "components/layout/mounted-pair.tsx",
  "utf8",
).replace(/\/\*[\s\S]*?\*\//g, "");

const PAINT_SOURCES = [
  ["mounted-sheet.tsx", source],
  ["mounted-pair.tsx", pairSource],
] as const;

/* The hero card has a painted and an unpainted option (owner, 2026-10-05 -- DESIGN.md ->
   Foundations -> Layout -> mounted-sheet -> The hero card's two options), and the paint lives in
   THIS file's utility strings rather than in the generated frame stylesheet: `mountRules` only ever
   STRIPS a fill where the mount does not show. So the prop selects between the options here, and a
   framed branch that named a paint utility INLINE would go on painting while every other assertion
   below still passed.

   Asserted on the framed branches rather than by counting occurrences file-wide: `MOUNT_REVEAL`
   legitimately names `bg-surface-mount` twice of its own, for the unfitted specimen path's reveal
   ladder, and those are the reveal's concern rather than the fitted card's paint. A file-wide count
   would therefore have to encode the reveal's two as a magic total, which goes stale the moment the
   ladder changes for an unrelated reason. */
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
      `a framed branch names paint inline, so the paint prop cannot gate it: ${line.trim()}`,
    );
  }
});

/* Every paint the unpainted option drops, asserted against the records' RESOLVED values rather than
   their spelling: the arms are composed from each other (`MOUNT_PAINT.mount` reads `MOUNT_SHADOW`), so
   a text match would reject the composition it is meant to encourage, and pinning a spelling is the
   failure mode this project keeps re-learning -- it passes the mutation that matters and fails the
   correct rewrite. The declarations are evaluated the way `button-action.test.ts` evaluates `sameTab`,
   so what is checked is what ships. */
test("the painted arms between them carry every paint an unpainted card drops", () => {
  const declared = (name: string) => {
    const match = source.match(
      new RegExp(
        `const ${name}(?:: Record<FramePaint, string>)? =\\s*([\\s\\S]*?);\\n`,
      ),
    );
    assert.ok(match, `no \`${name}\` declaration found`);
    /* `MOUNT_REVEAL_FILL` ends `} as const`, which is TypeScript and not evaluable JavaScript -- the
       declaration is sliced to the statement's `;`, so the assertion comes with it. */
    return match[1].replace(/\s+as const$/, "");
  };
  const resolve = new Function(`
    const MOUNT_SHADOW = ${declared("MOUNT_SHADOW")};
    const CARD_CORNERS = ${declared("CARD_CORNERS")};
    const SHEET = ${declared("SHEET")};
    const MOUNT_REVEAL_FILL = ${declared("MOUNT_REVEAL_FILL")};
    const STOCK_SHADOW = ${declared("STOCK_SHADOW")};
    const STOCK_PAINT = ${declared("STOCK_PAINT")};
    return [
      ${declared("MOUNT_PAINT")},
      ${declared("SHEET_PAINT")},
      ${declared("UNFITTED_HERO_PAINT")},
      ${declared("UNFITTED_SECTION_PAINT")},
    ].flatMap((record) => Object.values(record)).join(" ");
  `) as () => string;
  const paint = resolve();
  for (const utility of [
    "shadow-mount",
    "shadow-stock",
    "rounded-card",
    "bg-surface-mount",
    "bg-surface-elevated",
    /* The `stock` paint's own composed cast, listed here so a card that paints nothing is asserted to
       drop that too -- it is the one paint utility the enum added. */
    "shadow-mounted-stock",
  ]) {
    assert.ok(
      paint.includes(utility),
      `${utility} is not carried by any painted arm, so the paint prop cannot drop it`,
    );
  }
});

/* THE ASSERTION THAT MATTERS, and the one that makes this an OPTION rather than a fork, now lives in
   "every paint arm carries paint utilities only" below: the owner chose "backing only -- keep the box"
   precisely so the measured fit, the section's height, the thread's card box and the page's height are
   identical whichever paint is selected.

   It used to be asserted by walking each `${unbacked ? … : …}` ternary. The records replaced the
   ternaries, so the walk had nothing left to read -- and the record form is the stronger check, because
   it sees an arm that no call site happens to interpolate. What is kept from the old test is its
   lesson, written into `paintRecords` above: bound a slice by the delimiter the SYNTAX uses, and never
   let an arm the parser cannot read count as a pass. */

/* Painted is the DEFAULT, which is what keeps every other caller untouched -- including
   `not-found`, the same single-screen shape with the same two botanical pieces, which keeps its
   card. An opt-out default would have silently unpainted the 404 screen too. */
test("a card paints its backing unless asked not to", () => {
  assert.match(
    source,
    /paint\s*=\s*"mount"/,
    '`paint` must default to "mount", or every other card loses its backing',
  );
});

/* One combination nothing needs, guarded in this file's existing throw idiom rather than left to
   compose into a silent no-op: `tall` has never wanted an unpainted card, so passing both is a
   mistake and should say so.

   Asserted as a THROW on both conditions, in either order, rather than as one spelling -- which this
   file's own comments preach against, and which would fail the correct rewrite while passing a
   downgrade of the throw to a `console.warn`. */
test("a tall card refuses the unpainted option", () => {
  const guard = source.match(
    /if\s*\(([^)]*paint === "none"[^)]*\btall\b[^)]*|[^)]*\btall\b[^)]*paint === "none"[^)]*)\)\s*\{\s*throw new Error\(/,
  );
  assert.ok(
    guard,
    'no `throw` guarding the paint="none" + tall combination — a warn or a silent no-op is not enough',
  );
});

/* THE REVEAL LADDER CARRIES NO FILL. `MOUNT_REVEAL` once set the mount's colour and its padding in
   one string, so the prop could gate `MOUNT_PAINT` and the reveal would go on painting underneath
   -- the unfitted branch then rendered an unpainted hero as a solid tan block, which is the opposite
   of what the option means, and it is the branch the gallery's specimen uses. Fill belongs to the
   gated paint constants; the ladder keeps only the padding that is geometry and must never be gated. */
test("the reveal ladder carries padding only, so a paint can drop every fill", () => {
  const ladder = source.match(/const MOUNT_REVEAL = \{[\s\S]*?\} as const;/);
  assert.ok(ladder, "no `MOUNT_REVEAL` declaration found");
  assert.doesNotMatch(
    ladder[0],
    /bg-/,
    "the reveal ladder must carry no background utility, or an unpainted card still paints one",
  );
});

/* THE PAINT RECORDS, and what makes this a three-state enum rather than a boolean beside one. Three
   mutually exclusive paints are one `FramePaint`; a boolean next to an enum is one constant answering
   two questions, which this codebase has shipped as a defect twice -- the frame's padding floor, and
   `MOUNT_REVEAL` carrying a fill and a padding in one string.

   Every record is read by walking braces from its own header, so a reformat cannot break the parse,
   and both the record count and each record's exact key set are asserted. That second assertion is
   the one that matters: a record whose arms this parser could not see would be SILENTLY UNCHECKED,
   and a guard that skips what it cannot parse reads exactly like a guard that passes -- the failure
   the failure the retired ternary walk above records. An arm must therefore be a LITERAL -- a bare
   identifier would not match, and would vanish from the check. */
const PAINT_ARMS = ["mount", "stock", "none"];

function paintRecords(src: string): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  const header = /const (\w+): Record<FramePaint, string> = \{/g;
  for (let m = header.exec(src); m !== null; m = header.exec(src)) {
    let depth = 1;
    let at = m.index + m[0].length;
    while (depth > 0 && at < src.length) {
      if (src[at] === "{") depth += 1;
      if (src[at] === "}") depth -= 1;
      at += 1;
    }
    const body = src.slice(m.index + m[0].length, at - 1);
    const record: Record<string, string> = {};
    /* Both quote styles: an arm with no interpolation is a plain string, and the formatter rewrites
       an interpolation-free template literal into one -- so a backtick-only parser would silently
       drop every literal arm, including all three `none` arms. That is this file's own recorded
       failure one level up: a guard that skips what it cannot parse reads exactly like a pass. */
    for (const arm of body.matchAll(/(\w+):\s*(?:`([^`]*)`|"([^"]*)")/g)) {
      record[arm[1]] = arm[2] ?? arm[3];
    }
    out[m[1]] = record;
  }
  return out;
}

test("every paint record carries exactly the three paints, as literals", () => {
  for (const [file, src] of PAINT_SOURCES) {
    const found = Object.keys(paintRecords(src));
    assert.ok(
      found.length >= 3,
      `${file} exposes ${found.length} paint records, which is too few to be the whole set: ${found}`,
    );
  }
  const records = { ...paintRecords(source), ...paintRecords(pairSource) };
  const names = Object.keys(records);
  /* Four: the fitted mount, the fitted sheet, and the unfitted branch's hero and section. A count
     that drifted down would mean a record stopped being parseable, not that one stopped existing. */
  /* Seven: the sheet's fitted mount and sheet, its unfitted hero and section, and the pair's mount,
     leaf and sheet. A count that drifted DOWN would mean a record stopped being parseable rather than
     stopped existing. */
  assert.ok(
    names.length >= 7,
    `expected at least seven paint records across both frame components, found ${names.length}: ${names}`,
  );
  for (const [name, record] of Object.entries(records)) {
    assert.deepStrictEqual(
      Object.keys(record).sort(),
      [...PAINT_ARMS].sort(),
      `${name}'s arms are not exactly ${PAINT_ARMS} -- an arm this parser cannot see is an arm nothing below checks`,
    );
  }
});

test("every paint arm carries paint utilities only", () => {
  const records = { ...paintRecords(source), ...paintRecords(pairSource) };
  assert.ok(
    Object.keys(records).length > 0,
    "no paint records found -- re-anchor this test",
  );
  for (const [name, record] of Object.entries(records)) {
    for (const [arm, value] of Object.entries(record)) {
      assert.doesNotMatch(
        value,
        /MOUNT_REVEAL\b|SHEET_PADDING|\bp-|\bpx-|\bpy-|\bflex|\bmin-h|justify-|items-|\bw-full/,
        `${name}.${arm} names geometry, so the paint prop would gate it: ${value}`,
      );
      if (arm === "none") {
        assert.strictEqual(
          value,
          "",
          `${name}.none must paint nothing at all -- the unpainted option is a subtraction, not a substitution`,
        );
      }
    }
  }
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
      `a branch names a fill inline, so the paint prop cannot gate it: ${line.trim()}`,
    );
  }
});
