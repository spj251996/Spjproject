import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/* The eyebrow is set in `--font-sans` (Libre Baskerville), which ships 400, 700 and 400 italic and
   nothing between. A weight the family does not carry is not an error anywhere in this stack: CSS
   resolves an unavailable 500 down to 400 and a 600 up to 700, so `tsc`, lint, the build and every
   render check stay green while the declared value and the painted one differ. The owner stepped
   the role to 700 on 2026-10-07; a later "soften it to 500" would be a silent no-op.

   So the real assertion is not the number — it is that the number is one the FAMILY actually
   loads, read out of `layout.tsx` rather than restated here. */

const tokens = readFileSync("app/styles/tokens.css", "utf8");
const typeScale = readFileSync("app/styles/type-scale.css", "utf8");
const layout = readFileSync("app/layout.tsx", "utf8");

/* Bounded by the call's own closing brace rather than the next `}` in the file, so a nested object
   in the options cannot end the slice early. */
function loadedSansWeights(): string[] {
  const at = layout.indexOf("Libre_Baskerville({");
  assert.notStrictEqual(at, -1, "no Libre_Baskerville call in app/layout.tsx");
  const call = layout.slice(at, layout.indexOf("\n});", at));
  const weights = /weight:\s*\[([^\]]*)\]/.exec(call);
  assert.notStrictEqual(
    weights,
    null,
    "the sans call declares no weight array",
  );
  const parsed = (weights as RegExpExecArray)[1]
    .split(",")
    .map((part) => part.trim().replace(/^["']|["']$/g, ""))
    .filter((part) => part.length > 0);
  assert.ok(
    parsed.length >= 2,
    `read ${parsed.length} sans weights — the slice is wrong, not the code`,
  );
  return parsed;
}

function eyebrowWeight(): string {
  const match = /--text-eyebrow--font-weight:\s*(\d+);/.exec(tokens);
  assert.notStrictEqual(
    match,
    null,
    "no --text-eyebrow--font-weight in tokens.css",
  );
  return (match as RegExpExecArray)[1];
}

test("the eyebrow is set at 700", () => {
  assert.strictEqual(eyebrowWeight(), "700");
});

test("the eyebrow's weight is one the sans family actually loads", () => {
  const loaded = loadedSansWeights();
  assert.ok(
    loaded.includes(eyebrowWeight()),
    `the eyebrow asks for ${eyebrowWeight()} but Libre Baskerville loads only ${loaded.join(", ")} — the browser would paint a neighbouring weight and nothing would report it`,
  );
});

test("the eyebrow class reads the token rather than a literal", () => {
  const at = typeScale.indexOf(".type-eyebrow {");
  assert.notStrictEqual(at, -1, "no .type-eyebrow rule in type-scale.css");
  const rule = typeScale.slice(at, typeScale.indexOf("}", at));
  assert.match(rule, /font-weight:\s*var\(--text-eyebrow--font-weight\)/);
});
