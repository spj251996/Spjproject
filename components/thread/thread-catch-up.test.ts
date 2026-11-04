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

/* On a busy page a frame runs past the next vsync, so a scroll's re-target, made late in one frame, is stamped
   AFTER the timestamp the next frame carries. A slow scroll re-targets every frame, and when that read as no time
   passed the draw held still on every late frame — the owner's slow scroll in chunks (iPhone, 2026-11-03). */
test("a re-target made late in a frame still moves the draw on the next frame", () => {
  let clock = 0;
  let queued: ((now: number) => void) | null = null;
  const painted: number[] = [];
  const originalNow = performance.now;
  performance.now = () => clock;
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
    let frameBegan = 0;
    let target = 100;
    follower.to(target, 0.6);
    for (let frame = 0; frame < 20; frame += 1) {
      frameBegan += 16;
      clock = Math.max(clock, frameBegan) + 1;
      flush(frameBegan);
      clock = frameBegan + 20;
      target += 5;
      follower.to(target, 0.6);
    }
    const still = painted.slice(1).filter((value, i) => value <= painted[i]);
    assert.equal(
      still.length,
      0,
      `the draw held still on ${still.length} of ${painted.length - 1} frames`,
    );
  } finally {
    performance.now = originalNow;
    Reflect.deleteProperty(globalThis, "window");
  }
});

/* A driven follower: a clock the test sets, and frames it flushes at that clock, every 16ms. */
function drive() {
  let clock = 0;
  let queued: ((now: number) => void) | null = null;
  const painted: number[] = [];
  const originalNow = performance.now;
  performance.now = () => clock;
  Object.assign(globalThis, {
    window: {
      requestAnimationFrame: (callback: (now: number) => void) => {
        queued = callback;
        return 1;
      },
      cancelAnimationFrame: () => {
        queued = null;
      },
    },
  });
  const follower = createCatchUp((drawn) => painted.push(drawn));
  const advance = (ms: number) => {
    for (let elapsed = 0; elapsed < ms; elapsed += 16) {
      clock += 16;
      const callback = queued;
      queued = null;
      callback?.(clock);
    }
  };
  const restore = () => {
    performance.now = originalNow;
    Reflect.deleteProperty(globalThis, "window");
  };
  return {
    follower,
    painted,
    advance,
    restore,
    pending: () => queued !== null,
  };
}

/* A scroll re-targets the follower many times a second, so a re-target that restarts the curve from rest speed
   makes the line surge at each new scroll position — the owner's "catch up in parts". The speed carries across. */
test("a re-target mid-chase keeps the speed: no frame steps faster at the re-target", () => {
  const { follower, painted, advance, restore } = drive();
  try {
    follower.to(1000, 0.6);
    advance(208);
    const before = painted[painted.length - 1] - painted[painted.length - 2];
    follower.to(2000, 0.6);
    advance(16);
    const after = painted[painted.length - 1] - painted[painted.length - 2];
    assert.ok(
      after <= before * 1.05,
      `the draw sped up at the re-target: ${before.toFixed(2)} → ${after.toFixed(2)} px a frame`,
    );
  } finally {
    restore();
  }
});

test("a re-target never overshoots its target or runs backwards", () => {
  const { follower, painted, advance, restore } = drive();
  try {
    follower.to(5000, 0.6);
    advance(48);
    const shown = painted[painted.length - 1];
    follower.to(shown + 1, 0.6);
    advance(800);
    for (let i = 1; i < painted.length; i += 1) {
      assert.ok(
        painted[i] >= painted[i - 1],
        `the draw ran backwards at frame ${i}`,
      );
    }
    assert.ok(
      Math.max(...painted) <= shown + 1 + 1e-9,
      `the draw passed its target ${shown + 1}: ${Math.max(...painted)}`,
    );
  } finally {
    restore();
  }
});

test("it arrives exactly at the target one duration after the last re-target, and stops", () => {
  const { follower, painted, advance, restore, pending } = drive();
  try {
    follower.to(1000, 0.6);
    advance(208);
    follower.to(2000, 0.6);
    advance(608);
    assert.equal(painted[painted.length - 1], 2000);
    assert.equal(pending(), false, "no frame is left scheduled");
  } finally {
    restore();
  }
});

/* Monotonic like the ratchet it follows: a target at or below what is already drawn — scrolling back up — leaves the
   chase exactly as it was. */
test("a target at or below what is shown changes nothing", () => {
  const run = (retarget: boolean) => {
    const { follower, painted, advance, restore } = drive();
    try {
      follower.to(5000, 0.6);
      advance(300);
      if (retarget) {
        const shown = painted[painted.length - 1];
        follower.to(shown - 10, 0.6);
        follower.to(shown, 0.6);
      }
      advance(800);
      return [...painted];
    } finally {
      restore();
    }
  };
  assert.deepEqual(run(true), run(false));
});

/* A leg from rest is timed from the moment of the re-target, and the next frame can carry an earlier timestamp. That
   frame has nothing new to show: painting it repainted every piece at the length it already had. */
test("a frame that begins before a resting follower's leg paints nothing", () => {
  let clock = 1000;
  let queued: ((now: number) => void) | null = null;
  const painted: number[] = [];
  const originalNow = performance.now;
  performance.now = () => clock;
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
    flush(990);
    assert.equal(painted.length, 0, "the early frame painted");
    clock = 1016;
    flush(1016);
    assert.equal(painted.length, 1);
    assert.ok(painted[0] > 0, `the first frame painted ${painted[0]}`);
  } finally {
    performance.now = originalNow;
    Reflect.deleteProperty(globalThis, "window");
  }
});

/* A follower at rest still holds the timestamp of the last frame it painted. Two re-targets before a new leg's first
   frame must not time that leg from the old frame, or the line jumps to its target in one frame. */
test("a second re-target before a resting follower's first frame never jumps the draw", () => {
  const { follower, painted, advance, restore } = drive();
  try {
    follower.to(1000, 0.6);
    advance(800);
    advance(5000);
    follower.to(2000, 0.6);
    follower.to(2100, 0.6);
    advance(16);
    const step = painted[painted.length - 1] - 1000;
    assert.ok(
      step < 200,
      `the draw jumped ${step.toFixed(0)}px in its first frame`,
    );
  } finally {
    restore();
  }
});
