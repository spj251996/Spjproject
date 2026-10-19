import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
  DURATION_TOKENS,
  EASING_TOKENS,
  LAYOUT_CAPS,
  LOOP_CADENCE_USES,
  SPACING_STEPS,
  TYPE_TOKENS,
  Z_LAYERS,
} from "./_sections/token-tables.ts";

/* The gallery's token tables are structured copies of tokens.css, a shape token-prose.test.ts's
   `--token (value)` rule cannot see. Each table is held to the stylesheet, and every finder asserts
   how many rows it matched, so a renamed token or a moved block fails rather than checking nothing. */

const css = readFileSync(
  join(import.meta.dirname, "..", "styles", "tokens.css"),
  "utf8",
);

function declarations(block: string): Map<string, string> {
  const found = new Map<string, string>();
  for (const [, name, value] of block.matchAll(
    /^\s*(--[a-z0-9-]+)\s*:\s*([^;]+);/gim,
  )) {
    if (!found.has(name)) found.set(name, value.trim());
  }
  return found;
}

/* The base values are everything outside an `@variant` block; each tier then layers its own block
   over the one below, as the cascade does from md to lg to xl. */
const variantBlocks = [...css.matchAll(/@variant (md|lg|xl) \{([^}]*)\}/g)];
const base = declarations(css.replace(/@variant [a-z-]+ \{[^}]*\}/g, ""));
const tiers = (() => {
  const tablet = new Map([
    ...base,
    ...variantBlocks
      .filter(([, at]) => at === "md")
      .flatMap(([, , body]) => [...declarations(body)]),
  ]);
  const laptop = new Map([
    ...tablet,
    ...variantBlocks
      .filter(([, at]) => at === "lg")
      .flatMap(([, , body]) => [...declarations(body)]),
  ]);
  const desktop = new Map([
    ...laptop,
    ...variantBlocks
      .filter(([, at]) => at === "xl")
      .flatMap(([, , body]) => [...declarations(body)]),
  ]);
  return { phone: base, tablet, laptop, desktop };
})();

const px = (value: string | undefined) =>
  value === undefined ? undefined : Number(value.replace(/px$/, ""));

test("the finders read tokens.css", () => {
  assert.ok(base.size >= 80, `read ${base.size} base tokens`);
  assert.equal(
    new Set(variantBlocks.map(([, at]) => at)).size,
    3,
    "expected an md, an lg and an xl block",
  );
});

test("the type table's sizes and line heights match tokens.css at every tier", () => {
  let checked = 0;
  for (const row of TYPE_TOKENS) {
    const role = row.token.replace(/^type-/, "");
    if (!base.has(`--text-${role}`)) continue;
    checked += 1;
    for (const tier of ["phone", "tablet", "laptop", "desktop"] as const) {
      const declared = tiers[tier];
      assert.deepEqual(
        row[tier],
        {
          size: px(declared.get(`--text-${role}`)),
          lh: px(declared.get(`--text-${role}--line-height`)),
        },
        `${row.token} at ${tier}`,
      );
    }
  }
  assert.ok(
    checked >= 10,
    `only ${checked} of ${TYPE_TOKENS.length} type rows have a --text-* token`,
  );
});

test("the spacing table is the whole spacing scale", () => {
  const scale = [...base].filter(([name]) => name.startsWith("--spacing-"));
  assert.equal(scale.length, 12, "the spacing scale's step count");
  assert.deepEqual(
    SPACING_STEPS.map((step) => [`--spacing-${step.token}`, `${step.px}px`]),
    scale,
  );
});

test("the duration and easing tables are the motion tokens", () => {
  const durations = [...base].filter(([name]) =>
    name.startsWith("--duration-"),
  );
  assert.equal(durations.length, 2, "the duration token count");
  assert.deepEqual(
    DURATION_TOKENS.map((item) => [item.token, `${item.ms}ms`]),
    durations,
  );

  const easings = [...base].filter(([name]) => name.startsWith("--ease-"));
  assert.equal(easings.length, 2, "the easing token count");
  assert.deepEqual(
    EASING_TOKENS.map((item) => [
      item.token,
      `cubic-bezier(${item.curve.join(", ")})`,
    ]),
    easings,
  );
});

test("the z-index table is the z scale", () => {
  const layers = [...base].filter(([name]) => name.startsWith("--z-"));
  assert.equal(layers.length, 4, "the z-index token count");
  assert.deepEqual(
    Z_LAYERS.map((item) => [item.token, item.value]),
    layers,
  );
});

test("every layout cap the gallery states matches tokens.css", () => {
  assert.equal(LAYOUT_CAPS.length, 5, "the layout cap rows");
  for (const line of LAYOUT_CAPS) {
    const match = line.match(/^(--[a-z0-9-]+) · ([0-9.]+px) · /);
    assert.ok(match, `"${line}" does not open with "--token · value · "`);
    assert.equal(match[2], base.get(match[1]), match[1]);
  }
});

/* The thread's loop and budget rows state each value as `--token · value ·`, the shape the caps use. The
   speed carries its unit in prose (`845 px/s`) where the token is the bare number. */
test("every loop-cadence value the gallery states matches tokens.css", () => {
  assert.equal(LOOP_CADENCE_USES.length, 7, "the loop-cadence rows");
  for (const line of LOOP_CADENCE_USES) {
    const match = line.match(/^(--[a-z0-9-]+) · ([^·]+?) · /);
    assert.ok(match, `"${line}" does not open with "--token · value · "`);
    assert.equal(match[2].replace(/ px\/s$/, ""), base.get(match[1]), match[1]);
  }
});
