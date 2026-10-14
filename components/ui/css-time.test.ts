import assert from "node:assert/strict";
import test from "node:test";
import { cssTimeMs } from "./css-time.ts";

test("a computed CSS time reads in milliseconds whichever unit the build emitted", () => {
  assert.equal(cssTimeMs(".4s"), 400);
  assert.equal(cssTimeMs(" 0.4s"), 400);
  assert.equal(cssTimeMs("400ms"), 400);
  assert.equal(cssTimeMs("200ms "), 200);
});

test("an unreadable time falls back rather than becoming zero", () => {
  assert.equal(cssTimeMs("", 400), 400);
  assert.equal(cssTimeMs("auto", 400), 400);
});
