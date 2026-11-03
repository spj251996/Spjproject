"use client";

import { useCallback, useEffect, useRef } from "react";
import styles from "./thread.module.css";
import { THREAD_BANDS } from "./thread-bands";
import { createCatchUp } from "./thread-catch-up";
import { PAGE_FALLBACKS } from "./thread-fallback";
import { ThreadFilters } from "./thread-filters";
import { paintedLength } from "./thread-head";
import { TaperCutMask, ThreadInk, TRUNK_CUT_ID } from "./thread-ink";
import {
  type SectionRange,
  type SectionRect,
  splitSubpaths,
  subpathRange,
  type ThreadPiece,
  threadLine,
} from "./thread-line";
import {
  coverRect,
  currentBand,
  familyAnchors,
  measureSections,
  measureSubdivisions,
  pageDrawnLength,
  reducedMotion,
  useLayoutTriggers,
} from "./thread-measure";
import {
  applyPieceDashes,
  clearPieceDashes,
  createHeadPainter,
  createTaperPainter,
  type HeadPainter,
  type TaperPainter,
} from "./thread-painters";
import { THREAD_IDS } from "./thread-paths";
import {
  CHAIN_TERMINAL_WINDOW,
  createDrawRatchet,
  type TerminalWindow,
  totalLength,
} from "./thread-progress";
import type { PieceSamples } from "./thread-samples";
import {
  createThreadShadows,
  type ThreadShadows,
} from "./thread-shadow-regions";
import {
  createThreadSway,
  setSwayAwake,
  swayAmplitude,
  type ThreadSway,
} from "./thread-sway";
import {
  headOptions,
  readTerminalWindow,
  taperOptions,
  tokenTime,
} from "./thread-tokens";
import { createTwistPainter } from "./thread-twist";

/* THE MODEL.

   ONE PATH PER PIECE: `thread-line.ts` bakes the page's thread into one `d` in page-absolute pixels;
   `stroke-dasharray` restarts at every `M` subpath, so one `<path>` would put a draw head on every
   piece at once. This renders one `<path>` per piece (`splitSubpaths(d)`, zipped 1:1 against
   `threadLine`'s `pieces`), each driven by `pieceProgress(drawn, piece)` from one page-level scalar;
   piece ranges are contiguous and disjoint, so exactly one piece is ever mid-draw.

   MEASURE, NEVER MODEL THE LAYOUT: each section's `MeasuredSection` comes from two rects read at the
   same instant (the `<section>` and its `.mounted-sheet-frame__box`), never from CSS custom
   properties; every SVG sits in its own wrapper positioned from the same measurement, and only the
   no-JS fallback relies on `.pageWrapper` (see the closing comment).

   NOT NORMALISED: each piece's dash is in its own px (`stroke-dasharray: Lk`, `stroke-dashoffset:
   Lk - drawnK`, plus a small epsilon so the trailing edge overshoots), because Chromium stops a dash
   covering a whole `pathLength="1"` path about 7% short; each section's scroll window maps onto its
   own stretch of the total, never one global fraction.

   WISHES: this SVG paints at `{z.thread}` above every card, so Wishes' stretch is drawn by
   `CardThread` inside its card (DESIGN.md → Thread → Wishes).

   ANCHORING: `family`'s two `portraitLoop`s translate onto the portraits labelled Bride and Groom,
   paired by nearest distance, which is safe because the correction is under 18px across `wide`; a
   missing portrait falls back to `familyPortraitFractions`, an unmeasurable card to the plain warped
   position. */

/* ---------------------------------------------------------------------------------------------
   THE STATIC FALLBACK — what a reader with no JS sees, and what every reader sees for the one
   frame before JS measures. `PAGE_FALLBACKS` (`thread-fallback.ts`) is `threadLine` fed an IDENTITY
   warp (a band's own authored card/section figures as both `from` and `to`), which reproduces the
   authored geometry exactly (proven in `thread-line.test.ts`'s own identity test), stacked into one
   page-length path in that band's own nominal pixels and normalised into a 0-1 square per band so
   all three can share ONE viewBox and the choice between them is a plain CSS `display` toggle — no
   platform assumption beyond `@media (aspect-ratio ...)`, which this project's generated
   stylesheet already relied on. It lives outside this "use client" module because a server
   component cannot call a function a client module exports, even a pure one. */
const FALLBACKS = PAGE_FALLBACKS;

/* THE MAIN TRUNK'S OWN PIECE COUNT -- every section's pieces but `wishes`' own, which `CardThread`
   draws separately (`card-thread.tsx`). Fixed
   at every band: `THREAD_PATHS`/`MOTIF_PLACEMENTS` carry the same connector/motif COUNTS per section
   in all three bands (only the coordinates differ per band) -- confirmed directly against the data,
   not assumed, so this can be a plain module constant, letting `PageThread` render a FIXED number of
   `<path>` elements in JSX rather than growing/shrinking a list from measured state on every band
   change. Read structurally, off `subpathRange` (already exported for exactly this kind of count),
   never off a live `threadLine()` call, so it costs nothing at measure time. */
const MAIN_PIECE_COUNT = Math.max(
  ...THREAD_BANDS.map((band) => subpathRange(band.id, "wishes").start),
);

/* The hide-all rule and every per-band show rule share the SAME specificity (a single attribute
   selector each), so the winner is decided by SOURCE ORDER alone, not by which one a stylesheet
   layer happens to out-rank -- the hide-all rule is listed first, and CSS applies a later rule of
   equal specificity over an earlier one. Splitting these across a CSS-module class and this inline
   `<style>` would let the module rule's higher specificity always win regardless of `@media`; see
   `thread.module.css`'s own comment for why both halves live here instead. */
const FALLBACK_STYLE = [
  "[data-thread-fallback] { display: none; }",
  ...FALLBACKS.map(
    (fallback) =>
      `@media ${fallback.media} { [data-thread-fallback="${fallback.band}"] { display: block; } }`,
  ),
].join("\n");

/* The opening sequence hands off at 2200ms -- ground present, the invite's flowers unfurling, the
   type rising line by line until it lands at `--opening-type-end` (1800ms under Bloom, owner
   2026-10-14), then the thread's own fade for one `--duration-base` (`DESIGN.md` -> Motion -> The
   opening sequence). The draw begins as that fade completes, so this is the sequence's own end, not a
   value of its own: `opening-draw.test.ts` derives it from `app/_sections/invite.css` and fails if the two
   part. The duration is the invite's three pieces at one `--duration-base` (400ms) each -- a token
   multiple rather than a coined number, since a fresh design value is the owner's to set. */
const OPENING_DRAW_DELAY = 2200;
const OPENING_DRAW_DURATION = 1200;

/* The fraction of a group's last connector left undrawn as the reader arrives -- the owner's
   75%/25% crossing rule, so the line visibly travels into the next card as they scroll on. */
const CROSSING_HOLD_BACK = 0.25;

/* Where the opening sequence's own timed draw stops: the invite's whole stretch less the quarter of
   its crossing connector every group holds back. Drawing it to 100% instead made the thread look
   stuck for the whole first screen of scroll -- there was nothing left in the invite to draw and the
   next group had not opened yet. Derived from the CURRENT ranges on each call rather than stored,
   so a re-measure re-seeds the floor at the new layout's own lengths; returns 0 before the sequence
   has finished, which is a floor that holds nothing. */
function openingFloor(
  ranges: readonly SectionRange[],
  complete: boolean,
): number {
  const invite = ranges[0];
  if (!complete || invite === undefined) return 0;
  return invite.end - CROSSING_HOLD_BACK * invite.lastPieceLength;
}

/* ---------------------------------------------------------------------------------------------
   THE COMPONENT */

export function PageThread() {
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const fallbackSvgRef = useRef<SVGSVGElement>(null);
  const liveSvgRef = useRef<SVGSVGElement>(null);
  /* One entry per main-trunk piece (`MAIN_PIECE_COUNT`, fixed), index-aligned with `piecesRef`
     below -- a callback ref per `<path>` populates this on mount/unmount rather than one ref per
     the old single trunk path. */
  const pathsRef = useRef<(SVGPathElement | null)[]>([]);
  const piecesRef = useRef<readonly ThreadPiece[]>([]);
  /* EVERY piece of the page, the card thread's included: the head is the last stretch of the drawn line, so
     when the tip is a few pixels into Wishes' first piece the trunk still draws the head's tail in
     its own last one (`thread-head.ts`'s header). */
  const chainRef = useRef<readonly ThreadPiece[]>([]);
  const headGroupRef = useRef<SVGGElement>(null);
  const headRef = useRef<HeadPainter | null>(null);
  const taperGroupRef = useRef<SVGGElement>(null);
  const cutRef = useRef<SVGPathElement>(null);
  const taperRef = useRef<TaperPainter | null>(null);
  const shadowDefsRef = useRef<SVGDefsElement>(null);
  const shadowsRef = useRef<ThreadShadows | null>(null);
  /* One sampling of each piece, made the first time the head reaches it. */
  const samplesRef = useRef(new Map<number, PieceSamples>());
  /* IDLE: the page has gone `--thread-idle` without a scroll, tap, click or key. The sway stops then, and any
     interaction wakes it. The clock starts at load. */
  const idleRef = useRef(false);
  const idleTimerRef = useRef<number | null>(null);
  /* Fed to `pageDrawnLength` on every scroll frame -- all three captured at the same layout instant
     as `measured.sections` itself, never re-measured on scroll. `groupRectsRef` is `threadLine`'s own
     per-GROUP window rects (a stacked pair's own two card rects, a ritual list's own row rects, or a
     section's whole rect where nothing splits it) -- the card/row split this task adds, index-aligned
     with `rangesRef`, never the whole-section rects `measured.sections` itself carries. */
  const groupRectsRef = useRef<readonly SectionRect[]>([]);
  const rangesRef = useRef<readonly SectionRange[]>([]);
  const viewportHeightRef = useRef(0);
  const terminalWindowRef = useRef<TerminalWindow>(CHAIN_TERMINAL_WINDOW);
  const catchUpSecondsRef = useRef(0);
  /* The owner's "and then stay drawn" (`createDrawRatchet`'s own header) -- every value that
     reaches `applyPieceDashes` below goes through this, so scrolling back up can only ever hold the
     line where it was, never unravel it. `CardThread` owns its own; the two maxima are in
     different path lengths and would mean nothing to each other. */
  const ratchetRef = useRef(createDrawRatchet());
  const swayRef = useRef<ThreadSway | null>(null);
  const twistRef = useRef<ReturnType<typeof createTwistPainter> | null>(null);

  /* The `d` of a chain piece that lives in this `<svg>`, or nothing for the card thread's. */
  const pathOf = useCallback((index: number) => {
    if (index >= piecesRef.current.length) return undefined;
    const path = pathsRef.current[index];
    if (path === null || path === undefined) return undefined;
    /* A swaying `d` is not the geometry; the sway holds the unswayed one. */
    return swayRef.current?.baseOf(path) ?? path.getAttribute("d") ?? undefined;
  }, []);

  const shadows = useCallback((): ThreadShadows | null => {
    const defs = shadowDefsRef.current;
    if (defs === null) return null;
    shadowsRef.current ??= createThreadShadows(defs, swayAmplitude());
    return shadowsRef.current;
  }, []);

  const head = useCallback((): HeadPainter | null => {
    const group = headGroupRef.current;
    if (group === null) return null;
    headRef.current ??= createHeadPainter(group, pathOf, samplesRef.current);
    return headRef.current;
  }, [pathOf]);

  const goIdle = useCallback(() => {
    idleTimerRef.current = null;
    idleRef.current = true;
    setSwayAwake(false);
  }, []);

  /* Any scroll, tap, click or key: the idle clock starts over, and a page that had gone idle sways again. */
  const wake = useCallback(() => {
    if (idleTimerRef.current !== null)
      window.clearTimeout(idleTimerRef.current);
    const idle = tokenTime("--thread-idle");
    idleTimerRef.current =
      idle === undefined ? null : window.setTimeout(goIdle, idle);
    if (!idleRef.current) return;
    idleRef.current = false;
    setSwayAwake(true);
  }, [goIdle]);

  const taper = useCallback((): TaperPainter | null => {
    const group = taperGroupRef.current;
    const cut = cutRef.current;
    if (group === null || cut === null) return null;
    taperRef.current ??= createTaperPainter(group, cut);
    return taperRef.current;
  }, []);

  const draw = useCallback(
    (drawn: number) => {
      applyPieceDashes(pathsRef.current, piecesRef.current, drawn);
      twistRef.current?.painted(drawn);
      head()?.paint(drawn, chainRef.current, headOptions());
      if (headGroupRef.current !== null)
        shadows()?.headPainted(headGroupRef.current);
      const first = piecesRef.current[0];
      if (first !== undefined) taper()?.paint(paintedLength(drawn, first));
    },
    [head, shadows, taper],
  );

  /* The opening draw paints directly -- it is already timed on its own rAF -- and tells the follower
     what is on the page so a later scroll never replays it. */
  const commit = useCallback(
    (value: number) => {
      const drawn = ratchetRef.current.advance(value);
      catchUpRef.current?.seen(drawn);
      draw(drawn);
      wake();
    },
    [draw, wake],
  );

  const paintRef = useRef<(drawn: number) => void>(() => {});
  paintRef.current = (drawn: number) => {
    draw(drawn);
    wake();
  };
  const catchUpRef = useRef<ReturnType<typeof createCatchUp> | null>(null);
  catchUpRef.current ??= createCatchUp((drawn) => paintRef.current(drawn));

  /* A reader's own scroll goes through the follower instead. It wakes the page here as well as from the
     follower's frames: scrolling back up a finished thread moves no drawn length, so the follower paints
     nothing, and it is still an interaction. */
  const commitScrolled = useCallback(
    (value: number) => {
      const drawn = ratchetRef.current.advance(value);
      catchUpRef.current?.to(drawn, catchUpSecondsRef.current);
      wake();
    },
    [wake],
  );

  function measureLayout() {
    /* Read BEFORE `rangesRef.current` is overwritten below: the ratchet's peak is a length on the
       OLD path, and rebasing it needs both totals. */
    const previousRanges = rangesRef.current;
    const wrapper = wrapperRef.current;
    const fallbackSvg = fallbackSvgRef.current;
    const liveSvg = liveSvgRef.current;
    if (wrapper === null || fallbackSvg === null || liveSvg === null) {
      return;
    }
    const main = wrapper.closest("main");
    if (main === null) return;
    const band = currentBand();
    if (band === undefined) return;
    const measured = measureSections(main);
    if (measured === undefined) return;

    const mainRect = main.getBoundingClientRect();
    coverRect(fallbackSvg, wrapper, mainRect);
    coverRect(liveSvg, wrapper, mainRect);

    const familyIndex = THREAD_IDS.indexOf("family");
    const familySection = measured.sectionEls[familyIndex];
    const anchors =
      familySection === undefined
        ? undefined
        : {
            family: familyAnchors(
              band,
              familySection,
              measured.sections[familyIndex],
              mainRect,
            ),
          };
    const subdivisions = measureSubdivisions(measured.sectionEls, mainRect);

    const {
      d,
      sections: ranges,
      groupRects,
      pieces,
    } = threadLine(band, measured.sections, anchors, subdivisions);
    const range = subpathRange(band, "wishes");
    const subpaths = splitSubpaths(d);
    // `wishes` is always last in both `subpaths` and `pieces` (THREAD_IDS order), so the main
    // trunk is everything before its own range start in both -- the same slice point, applied to
    // the two index-aligned arrays rather than to a joined string.
    const trunkSubpaths = subpaths.slice(0, range.start);
    const trunkPieces = pieces.slice(0, range.start);
    const totalHeight = measured.sections.reduce((sum, s) => sum + s.height, 0);

    liveSvg.setAttribute("viewBox", `0 0 ${mainRect.width} ${totalHeight}`);
    trunkSubpaths.forEach((pieceD, index) => {
      pathsRef.current[index]?.setAttribute("d", pieceD);
    });
    piecesRef.current = trunkPieces;
    chainRef.current = pieces;
    twistRef.current ??= createTwistPainter(
      liveSvg,
      taperGroupRef.current,
      TRUNK_CUT_ID,
      () => 0,
    );
    swayRef.current ??= createThreadSway(liveSvg, reducedMotion());
    swayRef.current.measured(main);
    twistRef.current.measured(
      pathsRef.current,
      trunkPieces,
      swayRef.current.baseOf,
    );
    head()?.reset();
    const invitePiece = trunkPieces[0];
    taper()?.set(
      invitePiece === undefined
        ? undefined
        : {
            d: trunkSubpaths[0],
            length: invitePiece.end - invitePiece.start,
            endAt: 0,
            direction: -1,
          },
      taperOptions(),
    );
    const taperGroup = taperGroupRef.current;
    const invitePath = pathsRef.current[0];
    shadows()?.measured(
      pathsRef.current,
      taperGroup === null || invitePath === null || invitePath === undefined
        ? undefined
        : { group: taperGroup, piece: invitePath },
    );
    groupRectsRef.current = groupRects;
    rangesRef.current = ranges;
    viewportHeightRef.current = window.innerHeight;
    terminalWindowRef.current = readTerminalWindow(viewportHeightRef.current);
    catchUpSecondsRef.current = (tokenTime("--thread-catchup") ?? 0) / 1000;
    fallbackSvg.style.display = "none";

    if (reducedMotion()) {
      stopOpeningRef.current();
      catchUpRef.current?.stop();
      clearPieceDashes(pathsRef.current);
      twistRef.current?.painted(Number.POSITIVE_INFINITY);
      taper()?.paint(Number.POSITIVE_INFINITY);
    } else {
      /* The path this ratchet's maximum was measured against no longer exists. The maximum is
         REBASED rather than discarded: it is the only thing holding the owner's "and then stay
         drawn", and zeroing it let a phone's URL-bar resize un-draw the thread mid-scroll. The
         opening draw's own floor is still RE-DERIVED from the new ranges rather than carried across
         as a stale length -- without it, a resize at the very top after the sequence has run would
         unravel the invite's thread and leave a reader who has not scrolled looking at nothing. The
         rebase is not an interaction, so it does not wake the page. */
      ratchetRef.current.rebase(
        totalLength(previousRanges),
        totalLength(ranges),
      );
      const drawn = ratchetRef.current.advance(
        Math.max(
          pageDrawnLength(
            groupRectsRef.current,
            rangesRef.current,
            viewportHeightRef.current,
            terminalWindowRef.current,
          ),
          openingFloor(rangesRef.current, openingCompleteRef.current),
        ),
      );
      draw(drawn);
    }
  }

  /* The cheap half of the old `measure`. A viewport-height change moves where the draw window starts
     and ends and changes nothing else about the page's geometry, so this re-reads the two window
     values and re-paints the drawn length. It deliberately does NOT reset the head, re-measure
     sections or rebase the ratchet -- doing those mid-scroll is what the owner saw as glitches.

     It paints the way `measureLayout` does rather than through `commitScrolled`: there is no TRAVEL
     (easing a layout change the reader did not ask for would animate the thread sideways under them),
     and a URL bar moving is not an interaction, so it does not wake the page. */
  function refreshWindow() {
    if (reducedMotion()) return;
    viewportHeightRef.current = window.innerHeight;
    terminalWindowRef.current = readTerminalWindow(viewportHeightRef.current);
    const drawn = ratchetRef.current.advance(
      Math.max(
        pageDrawnLength(
          groupRectsRef.current,
          rangesRef.current,
          viewportHeightRef.current,
          terminalWindowRef.current,
        ),
        openingFloor(rangesRef.current, openingCompleteRef.current),
      ),
    );
    catchUpRef.current?.seen(drawn);
    draw(drawn);
  }

  useLayoutTriggers(measureLayout, refreshWindow);

  /* The owner's opening sequence ends with "thread starts drawing" (`DESIGN.md` -> Motion). Without
     this the last beat is a no-op: the thread's fade ramps opacity over a stroke with nothing drawn,
     so a reader who never scrolls never sees a thread at all. The invite's own pieces therefore draw
     on a timer once that fade completes, and scroll takes over by `Math.max` -- never by replacing
     the timed value, or scrolling back to the top would erase what the opening just drew.
     Skipped when the page loads already scrolled: the sequence is an ENTRANCE, and re-running it
     under a reader who is midway down the page hides the thread they are actually looking at.

     "Scroll takes over by `Math.max`" is now the ratchet's job rather than a second floor kept
     here: the timed draw advances the same ratchet every scroll frame advances, so the higher of
     the two wins by construction and there is one mechanism holding the line instead of two. */
  const openingCompleteRef = useRef(false);
  const stopOpeningRef = useRef<() => void>(() => {});

  useEffect(() => {
    let running = false;
    let stopCurrent = () => {};

    const start = (delay: number) => {
      let rafId: number | null = null;
      let startedAt = 0;
      running = true;
      const finish = () => {
        running = false;
      };

      const timer = window.setTimeout(() => {
        if (reducedMotion()) return finish();
        /* The invite stops its own last connector at 75%, exactly as every other group does, so the
         line is already reaching toward Event Info when the reader starts scrolling. Drawing it to
         100% here made the thread look stuck for the whole first screen of scroll -- there was
         nothing left in the invite to draw and the next group had not opened yet. */
        const target = openingFloor(rangesRef.current, true);
        if (target <= 0) return finish();
        const step = (now: number) => {
          if (reducedMotion()) return finish();
          if (startedAt === 0) startedAt = now;
          const t = Math.min(1, (now - startedAt) / OPENING_DRAW_DURATION);
          commit(target * t);
          if (t < 1) rafId = window.requestAnimationFrame(step);
          else {
            finish();
            openingCompleteRef.current = true;
            /* A signal for harnesses, not for styling: the opening draw is timed on its own rAF, and a
               gate that parks a section before it lands measures the race, not the thread
               (`check-thread-joins.mjs`). Never set under reduced motion, where no opening runs. */
            liveSvgRef.current?.setAttribute("data-thread-opened", "true");
          }
        };
        rafId = window.requestAnimationFrame(step);
      }, delay);

      stopCurrent = () => {
        window.clearTimeout(timer);
        if (rafId !== null) window.cancelAnimationFrame(rafId);
        finish();
      };
    };
    stopOpeningRef.current = () => stopCurrent();

    /* Reduced motion cuts the opening short, or keeps it from starting at all; when motion comes back
       while the reader is still at the top, the opening runs then, at once, rather than leaving the
       invite's stretch undrawn until the first scroll. */
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMotionChange = () => {
      if (motion.matches || running || openingCompleteRef.current) return;
      if (window.scrollY > 0) return;
      start(0);
    };
    motion.addEventListener("change", onMotionChange);
    if (!reducedMotion() && window.scrollY === 0) start(OPENING_DRAW_DELAY);
    return () => {
      motion.removeEventListener("change", onMotionChange);
      stopCurrent();
    };
  }, [commit]);

  useEffect(() => {
    let rafId: number | null = null;

    function onScroll() {
      if (rafId !== null || reducedMotion()) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        commitScrolled(
          pageDrawnLength(
            groupRectsRef.current,
            rangesRef.current,
            viewportHeightRef.current,
            terminalWindowRef.current,
          ),
        );
      });
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", onScroll);
    };
  }, [commitScrolled]);

  /* A hidden tab stops the sway; coming back resumes it unless the page has gone idle, since a tab coming
     back is not an interaction. */
  useEffect(() => {
    function onVisibility() {
      setSwayAwake(document.visibilityState !== "hidden" && !idleRef.current);
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  /* A tap, click or key wakes the page as a scroll does. The idle clock starts at load. */
  useEffect(() => {
    const onInteraction = () => wake();
    wake();
    const events = ["pointerdown", "keydown", "wheel", "touchstart"] as const;
    for (const name of events)
      window.addEventListener(name, onInteraction, { passive: true });
    return () => {
      for (const name of events)
        window.removeEventListener(name, onInteraction);
      if (idleTimerRef.current !== null)
        window.clearTimeout(idleTimerRef.current);
    };
  }, [wake]);

  useEffect(
    () => () => {
      swayRef.current?.stop();
    },
    [],
  );

  return (
    <span aria-hidden="true" className={styles.pageWrapper} ref={wrapperRef}>
      <style>{FALLBACK_STYLE}</style>
      {/* The page's one copy of the shadow and halo filters; Wishes' card thread names them too. */}
      <ThreadFilters />
      <svg
        className={styles.pageRoot}
        data-thread-svg="true"
        preserveAspectRatio="none"
        ref={fallbackSvgRef}
        role="presentation"
        viewBox="0 0 1 1"
      >
        {FALLBACKS.map((fallback) => (
          <path
            className={styles.pageInk}
            d={fallback.d}
            data-thread-fallback={fallback.band}
            key={fallback.band}
            /* The fallback's `d` lives in a normalised 0-1 square (`thread-fallback.ts`'s
               `normalise`), stretched by `.pageRoot`'s real box to cover `<main>` -- a coordinate
               system nothing like the live path's, which is already in real page pixels 1:1
               (which is why THAT path carries no `vector-effect`). Without it,
               `--stroke-thread`'s raw px value is read as that many USER-SPACE units in a space
               where one unit is now ~1500px, which paints not a thread but a solid rectangle --
               found on the first real no-JS render once `.pageWrapper` had a box to paint in at
               all. */
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      <svg
        className={styles.pageRoot}
        data-thread-svg="true"
        preserveAspectRatio="none"
        ref={liveSvgRef}
        role="presentation"
      >
        {/* ONE `<path>` PER PIECE -- fixed at `MAIN_PIECE_COUNT`, filled and dashed imperatively by
            `measureLayout()`/`onScroll` above. `key`s are stable indices, not piece identity, exactly
            like the fallback's own `band` keys above: the SET of pieces this page draws is fixed
            (structural, band-invariant -- `MAIN_PIECE_COUNT`'s own header), so index and identity
            never diverge here. */}
        <TaperCutMask cutRef={cutRef} id={TRUNK_CUT_ID} />
        <defs ref={shadowDefsRef} />
        {Array.from({ length: MAIN_PIECE_COUNT }, (_, index) => (
          <ThreadInk
            cutId={index === 0 ? TRUNK_CUT_ID : undefined}
            index={index}
            // biome-ignore lint/suspicious/noArrayIndexKey: MAIN_PIECE_COUNT is a fixed structural constant -- these never reorder or change count.
            key={index}
            pathRef={(el) => {
              pathsRef.current[index] = el;
            }}
          />
        ))}
        <g className={styles.pageTaper} data-thread-taper ref={taperGroupRef} />
        <g className={styles.pageHead} data-thread-head ref={headGroupRef} />
      </svg>
    </span>
  );
}

/* `<main>` needs `position: relative` so `.pageWrapper`'s `inset: 0` (`thread.module.css`) resolves
   against `<main>`'s box rather than whatever positioned ancestor is next up the chain. Every
   JS-driven measurement (`thread-measure.ts`) reads real rects and does not depend on any containing
   block, so this matters only to the no-JS reader. `position: relative` adds no z-index, so it opens
   no stacking context and cannot touch the botanical blend layer. */
