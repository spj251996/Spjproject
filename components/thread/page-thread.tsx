"use client";

import { useEffect, useRef } from "react";
import styles from "./thread.module.css";
import {
  authoredCard,
  familyPortraitFractions,
} from "./thread-authored-layout";
import { type BandId, THREAD_BANDS } from "./thread-bands";
import {
  aspectQuery,
  PAGE_FALLBACKS,
  splitSubpaths,
  subpathRange,
} from "./thread-fallback";
import {
  drawnLength,
  type SectionAnchors,
  type SectionRange,
  threadLine,
} from "./thread-line";
import { MOTIF_PLACEMENTS, THREAD_IDS } from "./thread-paths";
import type { MeasuredSection, Rect } from "./thread-warp";

/* THE MODEL — read this before touching anything below.

   ONE PATH, ONE DASH, MEASURED NOT DERIVED. `thread-line.ts` bakes the whole page's thread — every
   section's connectors and motifs, invite's free start to wishes' exit — into one `d`, in PAGE-
   ABSOLUTE pixels (relative to `<main>`'s own top-left). This component's job is to feed it real
   numbers: the layout the browser has already computed, read with `getBoundingClientRect()`, never
   reconstructed from CSS custom properties. That reconstruction is exactly what this replaces — it
   was exact on paper (48/48 cells at 0.000px) and still produced four owner-visible faults, because
   it resolved only where a real frame existed and inherited (`session.md`, 2026-09-27).

   NOT NORMALISED. `threadLine`'s `length` is a raw PIXEL estimate (256-sample chord sum, accurate to
   ~0.00003% per its own header), and `d` is already emitted in real page pixels — there is no
   arbitrary unit space to normalise INTO for the live path. Using `pathLength="1"` here would buy
   nothing and would reintroduce a bug this project has already been bitten by: Chromium does not
   paint a dash covering a whole `pathLength="1"` path — `stroke-dasharray="0 0 1 1"` stops about 7%
   short, while a raw-pixel dasharray with a trailing gap of zero runs to the end (`lessons.md`,
   2026-09-25). So the dash lives entirely in the SAME px units as `d`: `stroke-dasharray: L` (one
   on-length, which a single value repeats as `L L`), `stroke-dashoffset: L - drawn`, `drawn`
   `thread-line.ts`'s `drawnLength` — each section's OWN scroll window mapped onto that section's OWN
   stretch of `L`, not one global fraction of the whole path (the owner's review, `session.md`
   2026-09-27: a single `scrollY / (scrollHeight - innerHeight)` advances every section's thread at
   once, because total path length has no relationship to where a section's scroll window falls) —
   with a small epsilon added to `L` so the trailing edge overshoots the path's own end rather than
   exactly meeting it.

   MEASURE, NEVER ASSUME A POSITIONED ANCESTOR EITHER. Every SVG here sits inside its OWN small
   wrapper span, measured at the same instant as its real target (`<main>`, or Wishes' card), and
   positioned by inline style computed from that measurement — not by `position:absolute; inset:0`
   trusting some ancestor to be the right positioned box. That is the same "measure, don't derive"
   rule applied one level up: a page this size cannot assume WHICH ancestor Task 6 mounts it under is
   positioned, any more than the thread's geometry can assume a card's width from a CSS variable. The
   one place this project still needs a real positioned ancestor is the static, no-JS fallback below
   — CSS alone cannot self-measure, so `<main>` still needs `position: relative` for a no-JS reader
   to see it placed correctly (Task 6; see this file's closing comment).

   MEASURE, NEVER MODEL THE LAYOUT. Every section's `MeasuredSection` comes from two rects read at
   the same instant: the `<section>` itself (`top`/`height`) and its `.mounted-sheet-frame__box`
   (`cardLeft`/`cardWidth`) — the exact method `thread-authored-layout.ts` used to record the
   authored figures this warps FROM. A pair (Event Info, Family) has exactly one
   `.mounted-sheet-frame__box` spanning both leaves (`mounted-pair.tsx`), so the same selector serves
   singles and pairs alike.

   THE WEAVE IS THE ONE SPECIAL CASE. Wishes' own stretch is excluded from this component's drawn
   `<path>` — this SVG paints at `{z.thread}` (40) above every card's `{z.content}` (20), so it can
   only ever paint IN FRONT of the couple illustration, never behind it — and is instead drawn by
   `WishesWeave`, twice, at the two places in the DOM either side of the illustration. Both copies are
   IDENTICAL geometry and IDENTICAL dash state; the illusion of "passing behind" costs nothing beyond
   that, because natural paint order does the rest: the illustration (opaque) covers the "under" copy
   wherever they overlap, and the "over" copy — the same ink, redrawn — shows through everywhere
   including on top of it.

   ANCHORING. `family`'s two `portraitLoop` placements must translate onto Flemy's and Sebastian's
   REAL rendered portraits (owner requirement, `session.md` 2026-09-27) — found by relationship label
   ("Bride"/"Groom"), the one thing about them the content model states as a fact rather than as
   editorial copy that could read differently. The two anchors are paired to the two placements by
   nearest measured distance (nothing in `thread-paths.ts` says which drawn loop is whose — both are
   simply `motif: "portraitLoop"`), which is safe precisely because the owner's own decision record
   says the correction is small: under a pixel from 1280px up and under 18px across the whole `wide`
   band once x is card-anchored, so the plain warped position and the real portrait are never close
   enough to a THIRD point to make the nearest-pair assignment ambiguous. If a portrait cannot be
   found, that placement falls back to `familyPortraitFractions` — the anchor Task 1 built for exactly
   this case — and if even the family card cannot be measured, to the plain warped position, the same
   as every other motif. */

type Point = { x: number; y: number };

/* ---------------------------------------------------------------------------------------------
   THE STATIC FALLBACK — what a reader with no JS sees, and what every reader sees for the one
   frame before JS measures. `PAGE_FALLBACKS` (`thread-fallback.ts`) is `threadLine` fed an IDENTITY
   warp (a band's own authored card/section figures as both `from` and `to`), which reproduces the
   authored geometry exactly (proven in `thread-line.test.ts`'s own identity test), stacked into one
   page-length path in that band's own nominal pixels and normalised into a 0-1 square per band so
   all three can share ONE viewBox and the choice between them is a plain CSS `display` toggle — no
   platform assumption beyond `@media (aspect-ratio ...)`, which this project's generated
   stylesheet already relied on. `sectionRouteFallback` (the same module) is the same machinery for
   ONE section alone — what `not-found-thread.tsx` uses for its own closed, timed replay. Both live
   outside this "use client" module because a server component cannot call a function a client
   module exports, even a pure one. */
const FALLBACKS = PAGE_FALLBACKS;

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

/* ---------------------------------------------------------------------------------------------
   MEASUREMENT — the real DOM, read once per layout change, never per scroll frame. */

function currentBand(): BandId | undefined {
  for (const band of THREAD_BANDS) {
    if (window.matchMedia(aspectQuery(band.min, band.max)).matches) {
      return band.id;
    }
  }
  return undefined;
}

function rectRelativeTo(rect: DOMRect, origin: DOMRect): Rect {
  return {
    left: rect.left - origin.left,
    top: rect.top - origin.top,
    width: rect.width,
    height: rect.height,
  };
}

/* Positions `el` (already `position: absolute`) so its rendered box exactly covers `target`,
   regardless of which ancestor actually establishes `el`'s containing block — `wrapper` is `el`'s
   own small positioning span, always measured fresh alongside `target` so the two rects come from
   the same layout pass. This is the mechanism `thread.module.css`'s old `.weave` class approximated
   with a CSS `calc()` correction off the frame's own ring variables; measuring both rects directly
   needs no such correction and does not drift if the frame's ring padding ever changes. */
function coverRect(
  el: HTMLElement | SVGElement,
  wrapper: HTMLElement,
  target: DOMRect,
) {
  const wrapperRect = wrapper.getBoundingClientRect();
  el.style.position = "absolute";
  el.style.left = `${target.left - wrapperRect.left}px`;
  el.style.top = `${target.top - wrapperRect.top}px`;
  el.style.width = `${target.width}px`;
  el.style.height = `${target.height}px`;
}

function measureSections(
  main: HTMLElement,
): { sections: MeasuredSection[]; sectionEls: Element[] } | undefined {
  const sectionEls = Array.from(main.querySelectorAll(":scope > section"));
  if (sectionEls.length !== THREAD_IDS.length) return undefined;

  const mainRect = main.getBoundingClientRect();
  const sections = sectionEls.map((el): MeasuredSection => {
    const rect = el.getBoundingClientRect();
    const card = el.querySelector(".mounted-sheet-frame__box");
    const cardRect = card === null ? rect : card.getBoundingClientRect();
    const cardBox = rectRelativeTo(cardRect, mainRect);
    return {
      top: rect.top - mainRect.top,
      height: rect.height,
      cardLeft: cardBox.left,
      cardWidth: cardBox.width,
    };
  });
  return { sections, sectionEls };
}

/* Flemy is the bride and Sebastian is the groom by definition of the site, not by editorial copy
   that could read differently between sections — their `relationship` field is the one stable thing
   to match on (`content/family.ts`). The circular photo is the anchored ELEMENT, not the whole
   `<figure>`: a motif anchored to the figure would drift toward the caption text beneath the photo. */
function findPortraitCentre(
  familySection: Element,
  relationship: "Bride" | "Groom",
  mainRect: DOMRect,
): Rect | undefined {
  const figures = Array.from(familySection.querySelectorAll("figure"));
  const figure = figures.find((candidate) =>
    candidate.querySelector("figcaption")?.textContent?.includes(relationship),
  );
  const photo = figure?.firstElementChild;
  if (photo === null || photo === undefined) return undefined;
  const rect = rectRelativeTo(photo.getBoundingClientRect(), mainRect);
  return rect.width === 0 || rect.height === 0 ? undefined : rect;
}

function rectCentre(rect: Rect): Point {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

/* Two `portraitLoop` placements, two anchors — paired by nearest plain-warped position (see the
   header comment for why this pairing is safe). Falls back to `familyPortraitFractions` when a real
   portrait cannot be found, and to no anchor at all (the plain warped position) when even the card
   cannot be measured. */
function familyAnchors(
  band: BandId,
  familySection: Element,
  familyMeasured: MeasuredSection,
  mainRect: DOMRect,
): SectionAnchors {
  const from = authoredCard("family", band);
  const placements = MOTIF_PLACEMENTS[band].family;
  const fractions = familyPortraitFractions(band);

  function fallback(which: "flemy" | "sebastian"): Rect {
    const fraction = fractions[which];
    return {
      left: familyMeasured.cardLeft + fraction.x * familyMeasured.cardWidth,
      top: familyMeasured.top + fraction.y * familyMeasured.height,
      width: 0,
      height: 0,
    };
  }

  const remaining: { which: "flemy" | "sebastian"; anchor: Rect }[] = (
    ["flemy", "sebastian"] as const
  ).map((which) => ({
    which,
    anchor:
      findPortraitCentre(
        familySection,
        which === "flemy" ? "Bride" : "Groom",
        mainRect,
      ) ?? fallback(which),
  }));

  const assigned: (Rect | undefined)[] = placements.map(() => undefined);
  placements.forEach((placement, index) => {
    if (placement.motif !== "portraitLoop" || remaining.length === 0) return;
    const warpedX =
      familyMeasured.cardLeft +
      ((placement.x - from.cardLeft) * familyMeasured.cardWidth) /
        from.cardWidth;
    const warpedY = (placement.y * familyMeasured.height) / from.sectionHeight;
    let bestIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    remaining.forEach((candidate, i) => {
      const centre = rectCentre(candidate.anchor);
      const distance = Math.hypot(centre.x - warpedX, centre.y - warpedY);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = i;
      }
    });
    assigned[index] = remaining[bestIndex].anchor;
    remaining.splice(bestIndex, 1);
  });

  return assigned;
}

/* How much of the WHOLE page's dash has drawn at the current scroll position -- `sectionRects` and
   `ranges` are read once per layout change (never re-measured here) and handed in by the caller;
   `viewportHeight` is likewise captured at that same layout instant, so a scroll frame touches no
   DOM beyond `window.scrollY` itself. */
function pageDrawnLength(
  sectionRects: readonly MeasuredSection[],
  ranges: readonly SectionRange[],
  viewportHeight: number,
): number {
  return drawnLength(window.scrollY, viewportHeight, sectionRects, ranges);
}

/* The trailing edge overshoots the path's own end by this much so a whole-length dash never falls
   into the "stops short" case `lessons.md` (2026-09-25) records for an exactly-matching one. */
const DASH_EPSILON = 4;

function applyDash(path: SVGPathElement, length: number, offset: number) {
  path.style.strokeDasharray = `${length + DASH_EPSILON}`;
  path.style.strokeDashoffset = String(offset);
}

function clearDash(path: SVGPathElement) {
  path.style.strokeDasharray = "";
  path.style.strokeDashoffset = "";
}

/* Shared by both components below: bind resize/fonts/reduced-motion, run `measure` once and again
   on every layout change, and hand back a cleanup. Scroll is wired separately by each caller because
   the two draw different things on scroll (the whole page's offset vs. wishes' own local one). */
function useLayoutTriggers(measure: () => void) {
  // biome-ignore lint/correctness/useExhaustiveDependencies: bind once -- callers close over refs by their stable `.current`, not by closure value, so the first render's copy of `measure` stays correct forever.
  useEffect(() => {
    let cancelled = false;
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    function onResize() {
      if (resizeTimer !== null) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(measure, 150);
    }

    measure();
    document.fonts.ready.then(() => {
      if (!cancelled) measure();
    });

    let resizeObserver: ResizeObserver | null = null;
    const main = document.querySelector("main");
    if (main !== null) {
      resizeObserver = new ResizeObserver(onResize);
      resizeObserver.observe(main);
    }

    window.addEventListener("resize", onResize);
    reduceMotion.addEventListener("change", measure);

    return () => {
      cancelled = true;
      if (resizeTimer !== null) clearTimeout(resizeTimer);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", onResize);
      reduceMotion.removeEventListener("change", measure);
    };
  }, []);
}

function reducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/* ---------------------------------------------------------------------------------------------
   THE COMPONENT */

export function PageThread() {
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const fallbackSvgRef = useRef<SVGSVGElement>(null);
  const liveSvgRef = useRef<SVGSVGElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const lengthRef = useRef(0);
  /* Fed to `pageDrawnLength` on every scroll frame -- all three captured at the same layout instant
     as `measured.sections` itself, never re-measured on scroll. */
  const sectionsRef = useRef<MeasuredSection[]>([]);
  const rangesRef = useRef<readonly SectionRange[]>([]);
  const viewportHeightRef = useRef(0);

  function measure() {
    const wrapper = wrapperRef.current;
    const fallbackSvg = fallbackSvgRef.current;
    const liveSvg = liveSvgRef.current;
    const path = pathRef.current;
    if (
      wrapper === null ||
      fallbackSvg === null ||
      liveSvg === null ||
      path === null
    ) {
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

    const {
      d,
      length,
      sections: ranges,
    } = threadLine(band, measured.sections, anchors);
    const range = subpathRange(band, "wishes");
    const subpaths = splitSubpaths(d);
    const trunk = subpaths.slice(0, range.start).join(" ");
    const totalHeight = measured.sections.reduce((sum, s) => sum + s.height, 0);

    liveSvg.setAttribute("viewBox", `0 0 ${mainRect.width} ${totalHeight}`);
    path.setAttribute("d", trunk === "" ? d : trunk);
    lengthRef.current = length;
    sectionsRef.current = measured.sections;
    rangesRef.current = ranges;
    viewportHeightRef.current = window.innerHeight;
    fallbackSvg.style.display = "none";

    if (reducedMotion()) {
      clearDash(path);
    } else {
      const drawn = pageDrawnLength(
        sectionsRef.current,
        rangesRef.current,
        viewportHeightRef.current,
      );
      applyDash(path, length, length - drawn);
    }
  }

  useLayoutTriggers(measure);

  useEffect(() => {
    let rafId: number | null = null;

    function onScroll() {
      if (rafId !== null || reducedMotion()) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        const path = pathRef.current;
        if (path === null) return;
        const drawn = pageDrawnLength(
          sectionsRef.current,
          rangesRef.current,
          viewportHeightRef.current,
        );
        applyDash(path, lengthRef.current, lengthRef.current - drawn);
      });
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <span aria-hidden="true" className={styles.pageWrapper} ref={wrapperRef}>
      <style>{FALLBACK_STYLE}</style>
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
        <path className={styles.pageInk} d="" ref={pathRef} />
      </svg>
    </span>
  );
}

/* ---------------------------------------------------------------------------------------------
   THE WEAVE — Wishes' own stretch, drawn twice, in the two places in the DOM either side of the
   couple illustration. `slot="under"` replaces the retired `<SectionThread id="wishes"
   weave="under" />`, `slot="over"` replaces `weave="over"` — same two call sites, same document
   positions either side of `wishesStyles.figureCol`, which Task 6's cutover carries across along
   with removing `SectionThread` itself. Both copies measure independently: wishes' own subpath never
   depends on family's anchors (celebrations sits between them, and the boundary-snap in
   `thread-line.ts` only ever copies an ADJACENT section's own endpoint), so this needs no state
   shared with `PageThread` — only the same pure functions, called twice. The reveal, though, must
   stay in step with the whole page's progress, not restart at wishes' own arc-length 0: `beforeLength`
   is how much of the page's total `pageDrawnLength` accounts for before wishes' own stretch begins,
   and `wishesLength` is read straight off the mounted path with `getTotalLength()` — the browser's
   own exact arc length, used here (rather than `threadLine`'s sampled estimate) because it is what
   this path's OWN dash math has to agree with. */

interface WishesWeaveProps {
  slot: "under" | "over";
}

export function WishesWeave({ slot }: WishesWeaveProps) {
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const beforeLengthRef = useRef(0);
  /* Same three inputs `PageThread` keeps, captured at the same layout instant as its own copy --
     each `WishesWeave` measures independently (see the header comment), so it keeps its own. */
  const sectionsRef = useRef<MeasuredSection[]>([]);
  const rangesRef = useRef<readonly SectionRange[]>([]);
  const viewportHeightRef = useRef(0);

  function reveal() {
    const path = pathRef.current;
    if (path === null) return;
    const wishesLength = path.getTotalLength();
    const pageDrawn = pageDrawnLength(
      sectionsRef.current,
      rangesRef.current,
      viewportHeightRef.current,
    );
    const revealed = Math.min(
      Math.max(pageDrawn - beforeLengthRef.current, 0),
      wishesLength,
    );
    if (reducedMotion()) {
      clearDash(path);
    } else {
      applyDash(path, wishesLength, wishesLength - revealed);
    }
  }

  function measure() {
    const wrapper = wrapperRef.current;
    const svg = svgRef.current;
    const path = pathRef.current;
    if (wrapper === null || svg === null || path === null) return;
    const main = wrapper.closest("main");
    if (main === null) return;
    const band = currentBand();
    if (band === undefined) return;
    const measured = measureSections(main);
    if (measured === undefined) return;

    const mainRect = main.getBoundingClientRect();
    const wishesIndex = THREAD_IDS.indexOf("wishes");
    const wishesCard = measured.sectionEls[wishesIndex]?.querySelector(
      ".mounted-sheet-frame__box",
    );
    if (wishesCard === null || wishesCard === undefined) return;
    const cardRect = wishesCard.getBoundingClientRect();

    coverRect(svg, wrapper, cardRect);
    const cardBox = rectRelativeTo(cardRect, mainRect);
    svg.setAttribute(
      "viewBox",
      `${cardBox.left} ${cardBox.top} ${cardBox.width} ${cardBox.height}`,
    );

    const { d, length, sections: ranges } = threadLine(band, measured.sections);
    const range = subpathRange(band, "wishes");
    const subpaths = splitSubpaths(d);
    path.setAttribute("d", subpaths.slice(range.start, range.end).join(" "));

    sectionsRef.current = measured.sections;
    rangesRef.current = ranges;
    viewportHeightRef.current = window.innerHeight;
    beforeLengthRef.current = length - path.getTotalLength();
    reveal();
  }

  useLayoutTriggers(measure);

  // biome-ignore lint/correctness/useExhaustiveDependencies: bind once -- `reveal` closes over refs by their stable `.current`, not by closure value, so the first render's copy stays correct forever.
  useEffect(() => {
    let rafId: number | null = null;
    function onScroll() {
      if (rafId !== null || reducedMotion()) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        reveal();
      });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <span
      aria-hidden="true"
      className={styles.pageWrapper}
      data-thread-weave={slot}
      ref={wrapperRef}
    >
      <svg
        className={styles.pageWeave}
        data-thread-svg="true"
        preserveAspectRatio="none"
        ref={svgRef}
        role="presentation"
      >
        <path className={styles.pageInk} d="" ref={pathRef} />
      </svg>
    </span>
  );
}

/* THE ONE THING TASK 6 MUST ADD BESIDES THE MOUNT ITSELF: `<main>` needs `position: relative` for
   the STATIC, no-JS fallback's `position: absolute` to anchor against — everything JS-driven above
   measures its own containing wrapper instead and does not depend on it, but CSS alone has no way to
   self-measure, so the no-JS reader still needs a real positioned ancestor. `position: relative` adds
   no z-index, so it opens no new stacking context and cannot touch the botanical blend layer. */
