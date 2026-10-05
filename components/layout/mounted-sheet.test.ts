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
test("the unbacked prop selects paint and nothing else", () => {
  const ternaries = [
    ...source.matchAll(/unbacked\s*\?\s*([^:]+?)\s*:\s*([A-Za-z_$][\w$]*)/g),
  ];
  assert.ok(ternaries.length > 0, "no `unbacked` ternary found");
  for (const [whole, whenUnbacked, whenPainted] of ternaries) {
    assert.strictEqual(
      whenUnbacked.trim(),
      '""',
      `the unbacked arm must paint nothing at all: ${whole}`,
    );
    assert.ok(
      whenPainted === "MOUNT_PAINT" || whenPainted === "SHEET_PAINT",
      `the painted arm must be a paint constant, never geometry: ${whole}`,
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
   mistake and should say so. */
test("a tall card refuses the unbacked prop", () => {
  assert.match(source, /unbacked && tall/);
});
