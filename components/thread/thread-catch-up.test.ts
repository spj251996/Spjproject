import assert from "node:assert/strict";
import test from "node:test";
import { tokenValue } from "../../scripts/lib/built-tokens.ts";
import { CATCH_UP_EASES } from "./thread-catch-up.ts";

/* The follower must ARRIVE, never approach (an exponential leaves the card thread short of complete),
   and never overshoot (the draw never runs backwards). */
for (const [name, ease] of Object.entries(CATCH_UP_EASES)) {
  test(`${name} starts at 0, arrives at exactly 1, never runs backwards`, () => {
    assert.equal(ease(0), 0);
    assert.equal(ease(1), 1);
    let last = 0;
    for (let i = 1; i <= 100; i += 1) {
      const value = ease(i / 100);
      assert.ok(value >= last - 1e-12, `${name} decreased at ${i / 100}`);
      assert.ok(value <= 1 + 1e-12, `${name} overshot at ${i / 100}`);
      last = value;
    }
  });
}

/* Chosen on a render (DESIGN.md -> Motion): pinned so the curve cannot drift to the fallback unseen —
   an unknown keyword silently takes the first curve. */
test("the catch-up is 0.6s on a curve the follower knows", () => {
  assert.equal(tokenValue("thread-catchup"), "0.6s");
  assert.equal(tokenValue("thread-catchup-ease"), "ease-out-cubic");
  assert.ok(tokenValue("thread-catchup-ease") in CATCH_UP_EASES);
});
