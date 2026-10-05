import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/* Comments are stripped: the constants' own comments name the very utilities these assertions
   search for, so an unstripped read would let a comment satisfy an assertion about the code. */
const source = readFileSync(
  "components/layout/mounted-sheet.tsx",
  "utf8",
).replace(/\/\*[\s\S]*?\*\//g, "");

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
      `a framed branch names paint inline, so \`unbacked\` cannot gate it: ${line.trim()}`,
    );
  }
});

/* Every paint the unpainted option drops, asserted against the constants' RESOLVED values rather
   than their spelling: they are composed from each other (`MOUNT_PAINT` reads `MOUNT_SHADOW`), so a
   text match would reject the composition it is meant to encourage, and pinning a spelling is the
   failure mode this project keeps re-learning -- it passes the mutation that matters and fails the
   correct rewrite. The declarations are evaluated the way `button-action.test.ts` evaluates
   `sameTab`, so what is checked is what ships. */
test("the two paint constants between them carry every paint the option drops", () => {
  const declared = (name: string) => {
    const match = source.match(
      new RegExp(`const ${name} =\\s*([\\s\\S]*?);\\n`),
    );
    assert.ok(match, `no \`${name}\` declaration found`);
    return match[1];
  };
  const resolve = new Function(`
    const MOUNT_SHADOW = ${declared("MOUNT_SHADOW")};
    const CARD_CORNERS = ${declared("CARD_CORNERS")};
    const SHEET = ${declared("SHEET")};
    return [${declared("MOUNT_PAINT")}, ${declared("SHEET_PAINT")}].join(" ");
  `) as () => string;
  const paint = resolve();
  for (const utility of [
    "shadow-mount",
    "shadow-stock",
    "rounded-card",
    "bg-surface-mount",
    "bg-surface-elevated",
  ]) {
    assert.ok(
      paint.includes(utility),
      `${utility} is not carried by either paint constant, so \`unbacked\` cannot drop it`,
    );
  }
});

/* THE ASSERTION THAT MATTERS, and the one that makes this an OPTION rather than a fork. The owner
   chose "backing only -- keep the box" precisely so the measured fit, the section's height, the
   thread's card box and the page's height are identical either way.

   Asserted on what the prop SELECTS BETWEEN, not on what shares a line with it: the reveal ladder
   and the sheet's padding sit on the same `className` as the paint, unconditionally and correctly,
   so a line-local check would forbid the one arrangement the component needs. What must hold is that
   every `unbacked` ternary chooses between a paint constant and nothing at all -- never a reveal,
   never a padding, and never with the arms the wrong way round. */
/* Each `${unbacked ? … : …}` is read by walking braces to its own close, not by a regex that stops
   at the first `:` or demands a bare identifier. The earlier version required the painted arm to
   match `[A-Za-z_$][\w$]*`, so any arm that was a string or a template literal produced NO MATCH and
   was silently skipped -- it passed both mutations it existed to catch: moving `SHEET_PADDING` into
   the painted arm, and swapping the arms. A guard that skips what it cannot parse is worse than
   none, because the skip reads as a pass. Braces are the delimiter the syntax uses, so braces are
   what bounds the slice. */
function unbackedInterpolations(src: string): string[] {
  const found: string[] = [];
  for (
    let at = src.indexOf("${unbacked");
    at !== -1;
    at = src.indexOf("${unbacked", at + 1)
  ) {
    let depth = 0;
    for (let i = at + 1; i < src.length; i++) {
      if (src[i] === "{") depth++;
      else if (src[i] === "}") {
        depth--;
        if (depth === 0) {
          found.push(src.slice(at + 2, i));
          break;
        }
      }
    }
  }
  return found;
}

const PAINT_CONSTANTS = ["MOUNT_PAINT", "SHEET_PAINT", "UNFITTED_MOUNT_PAINT"];

test("the unbacked prop selects paint and nothing else", () => {
  const interpolations = unbackedInterpolations(source);
  assert.ok(interpolations.length > 0, "no `unbacked` interpolation found");
  for (const expression of interpolations) {
    const split = expression.indexOf("?");
    const colon = expression.indexOf(":", split);
    assert.ok(colon !== -1, `not a ternary: ${expression}`);
    assert.strictEqual(
      expression.slice(split + 1, colon).trim(),
      '""',
      `the unbacked arm must paint nothing at all, and must be the FIRST arm: ${expression}`,
    );
    const painted = expression.slice(colon + 1).trim();
    assert.ok(
      PAINT_CONSTANTS.some((name) => painted.startsWith(name)),
      `the painted arm must be a paint constant, never geometry: ${expression}`,
    );
    assert.doesNotMatch(
      painted,
      /MOUNT_REVEAL\b|SHEET_PADDING|\bp-|\bpx-|\bpy-|\bflex|\bmin-h|justify-|items-|\bw-full/,
      `the painted arm reaches geometry, so \`unbacked\` would gate it: ${expression}`,
    );
  }
});

/* Painted is the DEFAULT, which is what keeps every other caller untouched -- including
   `not-found`, the same single-screen shape with the same two botanical pieces, which keeps its
   card. An opt-out default would have silently unpainted the 404 screen too. */
test("a card paints its backing unless asked not to", () => {
  assert.match(
    source,
    /unbacked\s*=\s*false/,
    "`unbacked` must default to false, or every other card loses its backing",
  );
});

/* One combination nothing needs, guarded in this file's existing throw idiom rather than left to
   compose into a silent no-op: `tall` has never wanted an unpainted card, so passing both is a
   mistake and should say so.

   Asserted as a THROW on both flags, in either order, rather than as the spelling `unbacked && tall`
   -- which this file's own comments preach against, and which would fail the correct rewrite
   `tall && unbacked` while passing a downgrade of the throw to a `console.warn`. */
test("a tall card refuses the unbacked prop", () => {
  const guard = source.match(
    /if\s*\(([^)]*\bunbacked\b[^)]*\btall\b[^)]*|[^)]*\btall\b[^)]*\bunbacked\b[^)]*)\)\s*\{\s*throw new Error\(/,
  );
  assert.ok(
    guard,
    "no `throw` guarding the unbacked + tall combination — a warn or a silent no-op is not enough",
  );
});

/* THE REVEAL LADDER CARRIES NO FILL. `MOUNT_REVEAL` once set the mount's colour and its padding in
   one string, so `unbacked` could gate `MOUNT_PAINT` and the reveal would go on painting underneath
   -- the unfitted branch then rendered an unpainted hero as a solid tan block, which is the opposite
   of what the option means, and it is the branch the gallery's specimen uses. Fill belongs to the
   gated paint constants; the ladder keeps only the padding that is geometry and must never be gated. */
test("the reveal ladder carries padding only, so unbacked can drop every fill", () => {
  const ladder = source.match(/const MOUNT_REVEAL = \{[\s\S]*?\} as const;/);
  assert.ok(ladder, "no `MOUNT_REVEAL` declaration found");
  assert.doesNotMatch(
    ladder[0],
    /bg-/,
    "the reveal ladder must carry no background utility, or an unbacked card still paints one",
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
      `a branch names a fill inline, so \`unbacked\` cannot gate it: ${line.trim()}`,
    );
  }
});
