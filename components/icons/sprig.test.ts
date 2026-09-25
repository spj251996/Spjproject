import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

const icon = readFileSync("components/icons/sprig.tsx", "utf8");
const symbol = readFileSync("components/icons/sprig-symbol.tsx", "utf8");
const tracedPath = symbol.match(/<path d="([^"]+)"/)?.[1] ?? "";

test("the traced path lives in exactly one file", () => {
  assert.ok(tracedPath.length > 2000, "the symbol must carry the whole trace");
  const holders = readdirSync("components/icons")
    .filter((name) => name.endsWith(".tsx"))
    .filter((name) =>
      readFileSync(`components/icons/${name}`, "utf8").includes(tracedPath),
    );
  assert.deepEqual(holders, ["sprig-symbol.tsx"]);
});

test("the symbol carries the traced viewBox, not a re-fitted one", () => {
  assert.match(symbol, /viewBox="0 0 174\.6 169\.8"/);
});

test("the symbol is one path — the trace is a single contour set", () => {
  assert.equal(symbol.match(/<path/g)?.length, 1);
});

test("the icon references the symbol rather than drawing it", () => {
  assert.match(icon, /<use href="#sprig-mark"/);
  assert.equal(icon.match(/<path/g), null);
});

test("neither file hardcodes a colour", () => {
  for (const source of [icon, symbol]) {
    assert.doesNotMatch(source, /#[0-9a-fA-F]{3,8}/);
  }
});

test("the icon goes through IconBase and sets no nudge", () => {
  assert.match(icon, /<IconBase/);
  assert.doesNotMatch(icon, /nudge/);
});
