import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { botanicalCss } from "./botanical-css.ts";
import { type BotanicalPiece, TIERS, TUNING } from "./botanical-tuning.ts";

const pieces = Object.keys(TUNING) as BotanicalPiece[];
const VISUAL_X: Record<string, number> = {
  "top-left": -1,
  "top-right": 1,
  "bottom-left": -1,
  "bottom-right": 1,
  "above-bottom-right": 1,
  "above-bottom-left": -1,
  "middle-left": -1,
  "middle-right": 1,
};

test("without the option no stylesheet carries a corner, so every other section is unchanged", () => {
  assert.equal(botanicalCss(pieces).includes("--piece-corner"), false);
});

test("with it, every displayed piece names the corner it grows from", () => {
  const shown =
    botanicalCss(pieces, { corners: true }).match(
      /{[^}]*display: block;[^}]*}/g,
    ) ?? [];
  assert.ok(shown.length > 0);
  for (const rule of shown) {
    assert.match(rule, /--piece-corner-x: -?[01];/);
    assert.match(rule, /--piece-corner-y: -?[01];/);
  }
});

test("a mirrored piece's corner is flipped into its own local frame, per tier", () => {
  let checked = 0;
  for (const piece of pieces) {
    /* One tier's block each: the tiers are emitted in TIERS order, unwrapped first then @media. */
    const css = botanicalCss([piece], { corners: true });
    const blocks = css.split(/\n(?=@media)/);
    assert.equal(blocks.length, TIERS.length, piece);
    TIERS.forEach((tier, i) => {
      const t = TUNING[piece][tier];
      if (t.drop === true) return;
      const expected = VISUAL_X[t.anchor] * (t.flip === true ? -1 : 1);
      assert.ok(
        blocks[i].includes(`--piece-corner-x: ${expected};`),
        `${piece}/${tier}`,
      );
      checked += 1;
    });
  }
  assert.ok(checked > 0);
});

test("only the invite section asks for corners", () => {
  const sections = [
    "event-info",
    "family",
    "celebrations",
    "wishes",
    "contact",
  ];
  const invite = readFileSync("app/_sections/invite.tsx", "utf8");
  assert.match(invite, /<Botanical[^>]*\bcorners\b/);
  for (const id of sections) {
    let src = "";
    try {
      src = readFileSync(`app/_sections/${id}.tsx`, "utf8");
    } catch {
      continue; /* a retired section has no file */
    }
    assert.equal(
      /<Botanical[^>]*\bcorners\b/.test(src),
      false,
      `${id} asks for corners`,
    );
  }
  assert.equal(
    /\bcorners\b/.test(readFileSync("app/not-found.tsx", "utf8")),
    false,
  );
});
