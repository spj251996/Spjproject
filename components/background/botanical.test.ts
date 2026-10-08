import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { botanicalCss, pieceOverrideCss } from "./botanical-css.ts";
import {
  ANCHORS,
  type BotanicalPiece,
  TIERS,
  TUNING,
} from "./botanical-tuning.ts";

/* The clip box is one property away from being the bug it fixes: `contain: paint` clips
   identically and creates a stacking context, which isolates `mix-blend-mode: multiply` so every
   piece composites its opaque white ground as a visible rectangle — with no error, and lint,
   types, tests and the build all green. Only a rendered pixel shows it, so the property choice is
   asserted here instead.

   Over EVERY `.clip` block, not the first: a second rule inside a media query could carry
   `contain: paint` and break every blend while the first block still read clean. And the rule is
   asserted, not a spelling — the shorthand `overflow: clip visible`, which is what the build
   emits, says exactly the same thing as the long-hand pair. */
test("every botanical clip rule clips by overflow alone and creates no stacking context", () => {
  const css = readFileSync(
    path.join(import.meta.dirname, "botanical.module.css"),
    "utf8",
  );
  const blocks = [...css.matchAll(/\.clip[^{}]*\{([^}]*)\}/g)].map(
    (match) => match[1],
  );
  assert.ok(blocks.length > 0, "no .clip rule found in botanical.module.css");

  for (const body of blocks) {
    const inline =
      /overflow-x:\s*clip/.test(body) || /overflow:\s*clip(\s|;|$)/.test(body);
    const blockAxis =
      /overflow-y:\s*visible/.test(body) ||
      /overflow:\s*clip\s+visible/.test(body);
    assert.ok(
      inline,
      `a .clip rule does not clip the inline axis — a piece would widen the page: ${body}`,
    );
    assert.ok(
      blockAxis,
      `a .clip rule does not leave the block axis visible — a piece straddling a section boundary would be cut: ${body}`,
    );
    for (const property of [
      /isolation\s*:/,
      /contain\s*:/,
      /(?:^|[;{ ])transform\s*:/,
      /opacity\s*:/,
      /filter\s*:/,
      /content-visibility\s*:/,
      /z-index\s*:/,
      /overflow(-x|-y)?\s*:\s*hidden/,
    ]) {
      assert.ok(
        !property.test(body),
        `a .clip rule carries a blend-isolating or both-axis-clipping property (${property}): ${body}`,
      );
    }
  }
});

/* --- The per-tier tuning table and the stylesheet it generates --------------------------------

   Three of these guard a failure no other gate sees: a piece sized 181% of a phone screen passed
   every build, lint and test run there has ever been, because nothing asserted a size at all. */

/* The widest a piece may be tuned at any tier, as a fraction of the viewport. Stated here rather
   than clamped in CSS — a clamp would silently contradict a tuned value, and the point is to fail
   loudly.

   The meadow band's two halves carry their own, looser ceiling: they span the section's bottom edge
   by design, so each half reaches most of the way across on a phone. The exemption had been stated
   in prose here while the check applied one number to every piece — which held only while the band
   was a single piece sized under it. */
/* 85, raised from 60 once the phone tier was tuned (owner, 2026-09-24): a phone is narrow enough
   that a piece reading as a corner spray there is a large fraction of the window — `horizontal-
   garland` is tuned to 84.2vw. The number is a tripwire, not a design value: it exists to catch the
   failure that started this pass, a piece rendering at 181% of a phone screen. */
const SIZE_CEILING = 85;
const BAND_SIZE_CEILING = 100;
const BAND_PIECES: readonly BotanicalPiece[] = [
  "meadow-band-left",
  "meadow-band-right",
];

test("every piece carries a complete, well-formed record at every tier", () => {
  const pieces = Object.keys(TUNING);
  assert.equal(
    pieces.length,
    20,
    "the table must carry one record set per piece — a piece added to the union without a row renders at no size",
  );
  for (const piece of pieces) {
    for (const tier of TIERS) {
      const record = TUNING[piece as BotanicalPiece][tier];
      assert.ok(record, `${piece} has no ${tier} record`);
      assert.ok(
        ANCHORS.includes(record.anchor),
        `${piece}/${tier}: unknown anchor ${record.anchor}`,
      );
      for (const field of ["x", "y", "size", "rotation"] as const) {
        assert.ok(
          Number.isFinite(record[field]),
          `${piece}/${tier}: ${field} is not a finite number`,
        );
      }
      assert.ok(
        record.size >= 0,
        `${piece}/${tier}: a negative size renders nothing`,
      );
    }
  }
});

test("no piece is tuned past its size ceiling", () => {
  for (const [piece, tiers] of Object.entries(TUNING)) {
    for (const tier of TIERS) {
      const { size } = tiers[tier];
      const ceiling = BAND_PIECES.includes(piece as BotanicalPiece)
        ? BAND_SIZE_CEILING
        : SIZE_CEILING;
      assert.ok(
        size <= ceiling,
        `${piece}/${tier}: ${size}vw is past the ${ceiling}vw ceiling — ` +
          "a piece wider than that is the 181%-of-a-phone-screen failure this check exists for",
      );
    }
  }
});

/* The CSS the emitter writes, resolved the way a browser resolves it, so the anchor invariant can
   be asserted without a render. Over-constrained insets with `margin-block: auto` split the slack
   evenly between the two sides, which is exactly the rule that makes a naive `inset-block: y 0`
   move a centred piece by half of `y`. The model is confirmed against the real thing: the laptop
   render reproduces pixel for pixel through these same declarations. */
function resolvePosition(
  declarations: string,
  box: { width: number; height: number },
  piece: { width: number; height: number },
): { left: number; top: number } {
  const value = (property: string): number | null => {
    const match = new RegExp(`(?:^|[;{ ])${property}:\\s*([^;]+)`).exec(
      declarations,
    );
    if (match === null) return null;
    const raw = match[1].trim();
    if (raw === "auto") return null;
    /* Sum the signed `vw` terms: an `above-bottom-*` anchor subtracts its nudge from a percentage
       inside a `calc()`, so reading the first number alone would invert the axis. Percentage terms
       are not modelled — every assertion here compares two positions, so a constant drops out. */
    let total = 0;
    for (const term of raw.matchAll(/([+-])?\s*(-?[\d.]+)vw/g)) {
      total += (term[1] === "-" ? -1 : 1) * Number(term[2]);
    }
    return (total / 100) * box.width;
  };
  const insetBlock = /(?:^|[;{ ])inset-block:\s*([^;]+)/.exec(declarations);
  const blockStart =
    insetBlock === null
      ? value("top")
      : ((): number => {
          const first = insetBlock[1].trim().split(" ")[0];
          const start = /(-?[\d.]+)vw/.exec(first);
          return start === null ? 0 : (Number(start[1]) / 100) * box.width;
        })();
  const centred =
    insetBlock !== null && /margin-block:\s*auto/.test(declarations);

  const top = centred
    ? (blockStart ?? 0) / 2 + (box.height - piece.height) / 2
    : blockStart !== null
      ? blockStart
      : box.height - piece.height - (value("bottom") ?? 0);
  const left = (() => {
    const fromLeft = value("left");
    if (fromLeft !== null) return fromLeft;
    return box.width - piece.width - (value("right") ?? 0);
  })();
  return { left, top };
}

test("a positive nudge moves a piece right and down by exactly that many vw, at every anchor", () => {
  const box = { width: 1000, height: 800 };
  const piece = { width: 200, height: 300 };
  const nudge = 3;
  const expected = (nudge / 100) * box.width;

  for (const anchor of ANCHORS) {
    const base = pieceOverrideCss("falling-spray", {
      anchor,
      x: 0,
      y: 0,
      size: 20,
      rotation: 0,
    });
    const moved = pieceOverrideCss("falling-spray", {
      anchor,
      x: nudge,
      y: nudge,
      size: 20,
      rotation: 0,
    });
    /* An `above-bottom-*` anchor sits on a percentage of the section, which this model does not
       resolve; its own vw term is what the nudge moves, so the difference is still exact. */
    const at = resolvePosition(base, box, piece);
    const to = resolvePosition(moved, box, piece);
    assert.ok(
      Math.abs(to.left - at.left - expected) < 0.001,
      `${anchor}: +${nudge}vw of x moved the piece ${to.left - at.left}px, not ${expected}px`,
    );
    assert.ok(
      Math.abs(to.top - at.top - expected) < 0.001,
      `${anchor}: +${nudge}vw of y moved the piece ${to.top - at.top}px, not ${expected}px`,
    );
  }
});

/* The same class of failure as the clip box's: any of these properties makes the piece's nearest
   ancestor — or the piece's own group — an isolated one, and `mix-blend-mode: multiply` then
   composites the drawing's opaque white ground as a visible rectangle, with every gate green.
   `rotate` and `scale` are the two the spike cleared, and only on the piece itself: an element's
   own stacking context isolates its children — a bloom has none — not its own blending with the
   ground behind it. A bare `transform` is still refused, because it is the property an ANCESTOR
   would carry. */
test("the generated stylesheet carries no blend-isolating property", () => {
  const css = botanicalCss(Object.keys(TUNING) as BotanicalPiece[]);
  for (const property of [
    /z-index\s*:/,
    /isolation\s*:/,
    /contain\s*:/,
    /filter\s*:/,
    /opacity\s*:/,
    /content-visibility\s*:/,
    /(?:^|[;{ ])transform\s*:/,
    /translate\s*:/,
    /perspective\s*:/,
  ]) {
    assert.ok(
      !property.test(css),
      `the generated botanical stylesheet carries ${property} — it isolates the multiply blend`,
    );
  }
  assert.match(
    css,
    /rotate: (none|-?[\d.]+deg)/,
    "rotation is a tuned value and must reach the stylesheet",
  );
  assert.match(
    css,
    /scale: (none|-1 1)/,
    "the mirror is a tuned value and must reach the stylesheet",
  );
  /* The mirror is exactly `-1 1`: any other scale resizes the piece and silently contradicts its
     tuned width. */
  assert.ok(
    !/scale: (?!none|-1 1)/.test(css),
    "the only scale this layer may carry is the horizontal mirror",
  );
});

test("every piece the section carries gets a rule at every tier, and no other piece does", () => {
  const css = botanicalCss(["falling-spray", "corner-spray"]);
  for (const piece of ["falling-spray", "corner-spray"]) {
    const rules = css.match(
      new RegExp(`\\.botanical-piece\\.botanical-piece--${piece}\\b`, "g"),
    )?.length;
    assert.equal(
      rules,
      TIERS.length,
      `${piece}: expected one rule per tier, each at the doubled selector that beats the module stylesheet`,
    );
  }
  assert.ok(
    !css.includes("tied-bouquet"),
    "a section's stylesheet must carry only its own pieces",
  );
});
