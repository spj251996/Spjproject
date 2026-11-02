import assert from "node:assert/strict";
import test from "node:test";
import { tokenValue } from "../../scripts/lib/built-tokens.ts";
import { CATCH_UP_EASES, createCatchUp } from "./thread-catch-up.ts";

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

/* A frame's timestamp is when the frame began, so the first frame after a re-target can carry a time
   EARLIER than the re-target itself. The follower must treat that as no time passed, never as negative
   time: the eased curve dips below 0 there, and the draw stepped back along the line for one frame. */
test("a frame timestamped before a re-target never moves the draw backwards", () => {
  let queued: ((now: number) => void) | null = null;
  const painted: number[] = [];
  Object.assign(globalThis, {
    window: {
      requestAnimationFrame: (callback: (now: number) => void) => {
        queued = callback;
        return 1;
      },
      cancelAnimationFrame: () => {},
    },
  });
  try {
    const follower = createCatchUp((drawn) => painted.push(drawn));
    const flush = (now: number) => {
      const callback = queued;
      queued = null;
      callback?.(now);
    };
    follower.to(100, 0.6);
    flush(performance.now() + 300);
    const before = painted[painted.length - 1];
    const frameBegan = performance.now() - 8;
    follower.to(200, 0.6);
    flush(frameBegan);
    assert.ok(
      painted[painted.length - 1] >= before,
      `the draw stepped back from ${before} to ${painted[painted.length - 1]}`,
    );
  } finally {
    Reflect.deleteProperty(globalThis, "window");
  }
});
