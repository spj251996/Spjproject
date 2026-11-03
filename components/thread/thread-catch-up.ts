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
   is setting when they dial it.

   A RE-TARGET KEEPS THE SPEED. A scroll re-targets many times a second, and restarting the eased curve at
   each one began every leg at the curve's own start speed — up to three times the speed the line had
   reached — so the line surged at each new scroll position: the owner's "catch up in parts" (measured:
   35.6 → 99.6 px a frame). So a leg is a cubic Hermite from where the line is, at the speed it has, to the
   target at rest, over the same duration. The start speed is capped at the curve's own (`startSlope`),
   which keeps every leg monotonic — no overshoot, never backwards — and a leg begun from rest is the
   eased curve exactly.

   The curve is named by `--thread-catchup-ease`, so the line is pulled into place fast and settles
   slowly (DESIGN.md -> Motion). Every curve here starts at 0, arrives at exactly 1 and never overshoots:
   the draw never runs backwards, so an overshooting ease is forbidden, and the test holds every entry
   to that. An unknown keyword falls back to ease-out cubic. */
export const CATCH_UP_EASES: Readonly<Record<string, (t: number) => number>> = {
  "ease-out-cubic": (t) => 1 - (1 - t) ** 3,
  "ease-out-quad": (t) => 1 - (1 - t) * (1 - t),
};
const FALLBACK_EASE = CATCH_UP_EASES["ease-out-cubic"];

/* Read on the first `to`, once per follower, never at creation: the follower is created during
   render, which also runs on the server, where there is no document to read the token from. */
function chosenEasing(): (t: number) => number {
  if (typeof document === "undefined") return FALLBACK_EASE;
  const keyword = getComputedStyle(document.documentElement)
    .getPropertyValue("--thread-catchup-ease")
    .trim();
  return CATCH_UP_EASES[keyword] ?? FALLBACK_EASE;
}

/* The curve's speed as it leaves 0, in curve units: 3 for ease-out-cubic, 2 for ease-out-quad. */
function startSlope(ease: (t: number) => number): number {
  const h = 1e-6;
  return ease(h) / h;
}

export function createCatchUp(paint: (drawn: number) => void) {
  let from = 0;
  let target = 0;
  let shown = 0;
  let startedAt = 0;
  let duration = 0;
  /* The leg's start speed, in px per ms. */
  let startSpeed = 0;
  let raf: number | null = null;
  let ease: ((t: number) => number) | undefined;

  /* The leg's cubic Hermite at `u` (0 to 1): from `from` at `startSpeed` to `target` at rest. */
  function at(u: number): number {
    const u2 = u * u;
    const u3 = u2 * u;
    return (
      (2 * u3 - 3 * u2 + 1) * from +
      (u3 - 2 * u2 + u) * duration * startSpeed +
      (-2 * u3 + 3 * u2) * target
    );
  }

  function speedAt(u: number): number {
    if (duration <= 0) return 0;
    const u2 = u * u;
    return (
      ((6 * u2 - 6 * u) * from +
        (3 * u2 - 4 * u + 1) * duration * startSpeed +
        (-6 * u2 + 6 * u) * target) /
      duration
    );
  }

  function stop() {
    if (raf !== null) window.cancelAnimationFrame(raf);
    raf = null;
  }

  function tick(now: number) {
    raf = null;
    /* A frame's timestamp is when the frame began, which can be before a re-target made mid-frame:
       that is no time passed, not negative time, which the eased curve would carry below 0 and step
       the draw backwards. */
    const t =
      duration <= 0
        ? 1
        : Math.min(1, Math.max(0, (now - startedAt) / duration));
    shown = Math.max(shown, Math.min(target, at(t)));
    if (t >= 1) shown = target;
    paint(shown);
    if (t < 1) raf = window.requestAnimationFrame(tick);
  }

  return {
    /* Monotonic, like the ratchet it follows: scrolling back up never un-draws. */
    to(next: number, seconds: number) {
      ease ??= chosenEasing();
      if (next <= shown) return;
      if (!(seconds > 0)) {
        shown = next;
        target = next;
        paint(shown);
        stop();
        return;
      }
      const now = performance.now();
      const moving = raf !== null && duration > 0 && now - startedAt < duration;
      const speed = moving
        ? speedAt(Math.min(1, Math.max(0, (now - startedAt) / duration)))
        : 0;
      const nextDuration = seconds * 1000;
      const cap = (startSlope(ease) * (next - shown)) / nextDuration;
      startSpeed = moving ? Math.min(Math.max(0, speed), cap) : cap;
      from = shown;
      target = next;
      startedAt = now;
      duration = nextDuration;
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
