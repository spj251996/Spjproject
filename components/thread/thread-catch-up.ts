/* THE DRAW'S CATCH-UP — the owner's finding, 2026-10-05, in their own words: "i want the thread on
   section to draw a bit more slowly so that when page is scrolled fast to end it doesnt appear like
   thread just popped".

   The drawn length is a PURE FUNCTION OF `scrollY` (`drawnLength`), which is what makes the whole
   sequence testable without a browser — and also why a fling to the bottom paints the finished thread
   on the very next frame: there is no time in the mapping at all, so a large scroll delta is a large
   draw delta. Re-mapping the stretch onto more scroll (`TerminalWindow`) does not help this; it only
   changes WHICH scroll position means which length.

   `shown` follows `target` over a fixed duration (`--thread-catchup`, passed to `to(next, seconds)`)
   rather than being set to it, so a fling still ends at the right length but visibly travels there.
   Monotonic like the ratchet it follows, so scrolling back up never un-draws. The duration is passed
   in, not read here, because this ticks every frame and `getComputedStyle` would force a style
   recalc. A duration of 0 paints immediately and starts no loop. The opening draw does not go through
   this; it calls `seen` so the follower never replays it. */
/* A FIXED DURATION, NOT AN EXPONENTIAL. The obvious shape for a follower is `shown += gap * (1 -
   exp(-dt/tau))`, and it was tried first and measured wrong: an exponential never arrives. With a
   0.4s time constant the card thread still read 99.69% drawn 2.5 seconds after the scroll stopped, so the
   drawing head — which retires only when every piece is COMPLETE — stayed lit over the closing taper
   long after the thread looked finished. That is the very symptom the owner reported this round, so
   the fix must converge exactly rather than asymptotically.

   `--thread-catchup` is therefore how long the thread takes to ARRIVE, which is also what the owner
   is setting when they dial it. Re-targeting mid-flight eases from wherever it has got to, so a
   continuous scroll trails smoothly rather than restarting with a jerk. */
function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

export function createCatchUp(paint: (drawn: number) => void) {
  let from = 0;
  let target = 0;
  let shown = 0;
  let startedAt = 0;
  let duration = 0;
  let raf: number | null = null;

  function stop() {
    if (raf !== null) window.cancelAnimationFrame(raf);
    raf = null;
  }

  function tick(now: number) {
    raf = null;
    const t = duration <= 0 ? 1 : Math.min(1, (now - startedAt) / duration);
    shown = from + (target - from) * easeOutQuad(t);
    if (t >= 1) shown = target;
    paint(shown);
    if (t < 1) raf = window.requestAnimationFrame(tick);
  }

  return {
    /* Monotonic, like the ratchet it follows: scrolling back up never un-draws. */
    to(next: number, seconds: number) {
      if (next <= shown) return;
      if (!(seconds > 0)) {
        shown = next;
        target = next;
        paint(shown);
        stop();
        return;
      }
      from = shown;
      target = next;
      startedAt = performance.now();
      duration = seconds * 1000;
      if (raf === null) raf = window.requestAnimationFrame(tick);
    },
    /* The opening draw paints directly; this keeps the follower from replaying what is already up. */
    seen(value: number) {
      if (value <= shown) return;
      stop();
      shown = value;
      from = value;
      target = value;
    },
    stop,
    reset() {
      stop();
      shown = 0;
      from = 0;
      target = 0;
    },
  };
}
