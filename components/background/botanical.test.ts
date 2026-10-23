import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { botanicalCss, pieceRule } from "./botanical-css.ts";
import { SECTION_PLACEMENT } from "./botanical-placement.ts";
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
   than clamped in CSS: a clamp would silently contradict a tuned value, and the point is to fail
   loudly. A tripwire, not a design value. 95 because `corner-trail`, a corner frame whose empty
   interior holds the eyebrow, spans most of a phone's width (90.2vw). The meadow band's two halves
   carry their own looser ceiling: they span the section's bottom edge by design, so each half
   reaches most of the way across on a phone. */
const SIZE_CEILING = 95;
const BAND_SIZE_CEILING = 100;
const BAND_PIECES: readonly BotanicalPiece[] = [
  "meadow-band-left",
  "meadow-band-right",
];

/* Every rule in the module, not only `.clip`: the header's list of blend-isolating properties holds
   for the whole layer. Matched as property NAMES, so `background-size: contain` is not mistaken for
   `contain`. */
test("no rule in botanical.module.css declares a blend-isolating property", () => {
  const css = readFileSync(
    path.join(import.meta.dirname, "botanical.module.css"),
    "utf8",
  ).replace(/\/\*[\s\S]*?\*\//g, "");
  const bodies = [...css.matchAll(/[^{}]+\{([^{}]*)\}/g)].map((m) => m[1]);
  const atRules = (css.match(/@[\w-]+[^{;]*\{/g) ?? []).length;
  assert.equal(
    bodies.length,
    (css.match(/\{/g) ?? []).length - atRules,
    "every rule body was parsed",
  );
  const isolating =
    /(^|;)\s*(z-index|isolation|contain|content-visibility|transform|filter|opacity|box-shadow|will-change|perspective)\s*:/;
  for (const body of bodies) {
    assert.ok(
      !isolating.test(body),
      `a botanical.module.css rule declares a blend-isolating property: ${body.trim()}`,
    );
  }
});

test("every piece carries a complete, well-formed record at every tier", () => {
  const pieces = Object.keys(TUNING);
  assert.equal(
    pieces.length,
    19,
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
    const base = pieceRule("corner-trail", {
      anchor,
      x: 0,
      y: 0,
      size: 20,
      rotation: 0,
    });
    const moved = pieceRule("corner-trail", {
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
  const css = botanicalCss(["corner-trail", "corner-spray"]);
  for (const piece of ["corner-trail", "corner-spray"]) {
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

/* The invite and the not-found screen share one botanical layout (DESIGN.md → Botanical Edge), so
   both keys must name the SAME list — a copy would let the two drift apart one swap at a time. */
test("not-found reuses the invite's own piece list, and that list is corner-trail then corner-spray", () => {
  assert.equal(
    SECTION_PLACEMENT["not-found"],
    SECTION_PLACEMENT.invite,
    "not-found must reuse the invite's list",
  );
  assert.deepEqual(
    SECTION_PLACEMENT.invite.map((placement) => placement.piece),
    ["corner-trail", "corner-spray"],
  );
});

/* `corner-trail`'s placement is the owner's, settled on a render, and is the shape this project
   pins: a later conversion or tidy-up could overwrite it and nothing else
   would notice. Its clearance comes from the drawing's empty interior, not from an offset, so every
   tier sits flush in the corner (x 0, y 0); only the size was tuned. Measured against the invite's
   eyebrow at these values, nearest ink 24px at 390x664 and wider everywhere else. */
test("corner-trail's placement is the value settled on a render", () => {
  const record = (size: number) => ({
    anchor: "top-right",
    x: 0,
    y: 0,
    size,
    rotation: 0,
  });
  assert.deepEqual(TUNING["corner-trail"], {
    phone: record(90.2),
    tablet: record(52),
    laptop: record(40),
    desktop: record(40),
  });
});

test("retired pieces stay retired", () => {
  assert.ok(!("falling-spray" in TUNING));
  assert.ok(!("cosmos-arc" in TUNING));
});

test("poppy-spread is a phone-only piece, dropped from the tablet tier up", () => {
  const record = TUNING["poppy-spread"];
  assert.deepEqual(record.phone, {
    anchor: "top-right",
    x: 4.6,
    y: -24,
    size: 48,
    rotation: -14,
  });
  for (const tier of ["tablet", "laptop", "desktop"] as const) {
    assert.equal(
      record[tier].drop,
      true,
      `poppy-spread must be dropped at ${tier}`,
    );
  }
});

test("every image the generated sheet names exists in public/botanical", () => {
  const css = botanicalCss(Object.keys(TUNING) as BotanicalPiece[]);
  const urls = [...css.matchAll(/url\("?(\/botanical\/[^")]+)"?\)/g)].map(
    (m) => m[1],
  );
  let pairs = 0;
  for (const record of Object.values(TUNING)) {
    for (const tier of TIERS) if (!record[tier].drop) pairs += 1;
  }
  assert.equal(
    urls.length,
    2 * pairs,
    "one AVIF and one WebP per shown piece and tier",
  );
  for (const url of urls) {
    assert.ok(
      existsSync(path.join("public", url)),
      `${url} is not in public/ — run npm run images`,
    );
  }
});

/* DESIGN.md → Botanical Edge: no piece appears twice in one scroll. */
test("no piece appears twice in one scroll, and the scroll carries all nineteen", () => {
  const { "not-found": _notFound, ...scrollSections } = SECTION_PLACEMENT;
  const scroll = Object.values(scrollSections).flatMap((placements) =>
    placements.map((placement) => placement.piece),
  );
  assert.equal(
    new Set(scroll).size,
    scroll.length,
    `a piece repeats: ${scroll}`,
  );
  assert.deepEqual([...scroll].sort(), Object.keys(TUNING).sort());
});
