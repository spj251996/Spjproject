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
  createDrawRatchet,
  dashForPiece,
  drawnLength,
  pieceProgress,
  type SectionAnchors,
  type SectionRange,
  type SectionRect,
  type SectionSubdivisions,
  type ThreadPiece,
  threadLine,
} from "./thread-line";
import { MOTIF_PLACEMENTS, THREAD_IDS } from "./thread-paths";
import type { MeasuredSection, Rect } from "./thread-warp";

/* THE MODEL — read this before touching anything below.

   ONE PATH PER PIECE, ONE DASH PER PATH, MEASURED NOT DERIVED. `thread-line.ts` bakes the whole
   page's thread — every section's connectors and motifs, invite's free start to wishes' exit —
   into one `d`, in PAGE-ABSOLUTE pixels (relative to `<main>`'s own top-left), same as before. What
   changed (Task 1): `stroke-dasharray` restarts at every `M` subpath, so ONE `<path>` driving that
   whole `d` with ONE `stroke-dashoffset` put 19 independent draw heads on the page — every
   connector and motif growing from its own start at once — which is exactly the defect the owner
   reported at every prior round ("all parts of thread starting to draw at same time in all
   sections", `task-1-report.md`). The fix is architectural, not a bigger dash: this component now
   renders one `<path>` PER PIECE (`splitSubpaths(d)`, already one entry per connector/motif, zipped
   1:1 against `threadLine`'s own `pieces` list), and drives each one from its OWN
   `pieceProgress(drawn, piece)` — `drawn` is still the single page-level scalar `drawnLength`
   produces below, unchanged; only what CONSUMES it changed. Piece ranges are contiguous and
   disjoint by construction, so "exactly one piece mid-draw" follows without a second rule to keep
   in sync (`thread-line.ts`'s own header on `ThreadPiece`/`pieceProgress`).

   This component's job is to feed `threadLine` real numbers: the layout the browser has already
   computed, read with `getBoundingClientRect()`, never
   reconstructed from CSS custom properties. That reconstruction is exactly what this replaces — it
   was exact on paper (48/48 cells at 0.000px) and still produced four owner-visible faults, because
   it resolved only where a real frame existed and inherited (`session.md`, 2026-09-27).

   NOT NORMALISED. `threadLine`'s `length` (and every piece's own `end - start`) is a raw PIXEL
   estimate (256-sample chord sum, accurate to ~0.00003% per its own header), and `d` is already
   emitted in real page pixels — there is no arbitrary unit space to normalise INTO for the live
   path. Using `pathLength="1"` here would buy nothing and would reintroduce a bug this project has
   already been bitten by: Chromium does not paint a dash covering a whole `pathLength="1"` path —
   `stroke-dasharray="0 0 1 1"` stops about 7% short, while a raw-pixel dasharray with a trailing gap
   of zero runs to the end (`lessons.md`, 2026-09-25). So EACH PIECE's dash lives entirely in that
   piece's own px units: `stroke-dasharray: Lk` (one on-length, which a single value repeats as
   `Lk Lk`), `stroke-dashoffset: Lk - drawnK`, `drawnK` = `pieceProgress(drawn, piece) * Lk` —
   `drawn` is `thread-line.ts`'s `drawnLength`, one scalar for the whole page, and `pieceProgress`
   is what turns it into "how much of THIS piece has drawn" without the piece needing to know
   anything about its neighbours (each section's own scroll window is itself mapped onto that
   section's OWN stretch of the page total, not one global fraction of the whole path — the owner's
   review, `session.md` 2026-09-27: a single `scrollY / (scrollHeight - innerHeight)` advances every
   section's thread at once, because total path length has no relationship to where a section's
   scroll window falls) — with a small epsilon added to each `Lk` so a piece's trailing edge
   overshoots its own end rather than exactly meeting it.

   MEASURE, NEVER ASSUME A POSITIONED ANCESTOR EITHER. Every SVG here sits inside its OWN small
   wrapper span, measured at the same instant as its real target (`<main>`, or Wishes' card), and
   positioned by inline style computed from that measurement — not by `position:absolute; inset:0`
   trusting some ancestor to be the right positioned box. That is the same "measure, don't derive"
   rule applied one level up: a page this size cannot assume WHICH ancestor Task 6 mounts it under is
   positioned, any more than the thread's geometry can assume a card's width from a CSS variable. The
   one place this project still needs a real positioned ancestor is the static, no-JS fallback below
   — CSS alone cannot self-measure, so it relies on `.pageWrapper` covering `<main>` by `inset: 0`
   rather than by measurement (`thread.module.css`; see this file's closing comment).

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
/* THE MAIN TRUNK'S OWN PIECE COUNT -- 19, per `task-1-brief.md`'s own reproduction (22 total pieces
   across the six sections, minus `wishes`' own 3, which `WishesWeave` draws separately below). Fixed
   at every band: `THREAD_PATHS`/`MOTIF_PLACEMENTS` carry the same connector/motif COUNTS per section
   in all three bands (only the coordinates differ per band) -- confirmed directly against the data,
   not assumed, so this can be a plain module constant, letting `PageThread` render a FIXED number of
   `<path>` elements in JSX rather than growing/shrinking a list from measured state on every band
   change. Read structurally, off `subpathRange` (already exported for exactly this kind of count),
   never off a live `threadLine()` call, so it costs nothing at measure time. */
const MAIN_PIECE_COUNT = Math.max(
  ...THREAD_BANDS.map((band) => subpathRange(band.id, "wishes").start),
);

/* `wishes`' own piece count -- 3, per the same reproduction (a connector, its one motif `bow`, and
   the trailing connector every section ends with) -- band-invariant for the same reason. */
const WISHES_PIECE_COUNT = Math.max(
  ...THREAD_BANDS.map((band) => {
    const range = subpathRange(band.id, "wishes");
    return range.end - range.start;
  }),
);

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

/* THE OWNER'S CARD/ROW SPLIT (`session.md` 2026-09-28): a stacked pair is two cards, not one window,
   and a long scrolling list of ritual rows is several rows, not one. `event-info` and `family` are
   both `<MountedPair>` (`components/layout/mounted-pair.tsx`), which always renders exactly two
   `.mounted-sheet-frame__leaf` elements regardless of whether CSS currently lays them out stacked or
   side by side -- so querying that class costs nothing extra to gate on layout, and reading each
   leaf's own top tells `threadLine` which piece belongs with which card without this file ever
   asking whether the pair happens to be stacked this band. `celebrations` carries no such class (it
   is a single tall `<MountedSheet>`, not a pair), so its six ritual rows are found by
   `[data-thread-row]` -- the one attribute this task adds, on `<li>` in `CelebrationsSection`
   (`app/page.tsx`), because nothing else there identifies a row. Every other section returns no
   rects at all, which `threadLine` already reads as "no split" (`SectionSubdivisions`'s own header
   in `thread-line.ts`) -- exactly today's single-window behaviour. */
function leafRects(sectionEl: Element, mainRect: DOMRect): Rect[] {
  return Array.from(
    sectionEl.querySelectorAll(".mounted-sheet-frame__leaf"),
  ).map((leaf) => rectRelativeTo(leaf.getBoundingClientRect(), mainRect));
}

function ritualRowRects(sectionEl: Element, mainRect: DOMRect): Rect[] {
  return Array.from(sectionEl.querySelectorAll("[data-thread-row]")).map(
    (row) => rectRelativeTo(row.getBoundingClientRect(), mainRect),
  );
}

/* Shared by `PageThread` and `WishesWeave` (`useLayoutTriggers`'s own header explains why each
   measures independently) -- both must derive the SAME subdivisions from the SAME rects, or their
   two independent `threadLine` calls would chain a different `windowStart` through `celebrations`
   and hand `wishes` two disagreeing answers for where its own crossing predecessor left off. */
function measureSubdivisions(
  sectionEls: readonly Element[],
  mainRect: DOMRect,
): SectionSubdivisions {
  const subdivisions: Partial<
    Record<Exclude<(typeof THREAD_IDS)[number], "not-found">, Rect[]>
  > = {};
  THREAD_IDS.forEach((id, index) => {
    const el = sectionEls[index];
    if (el === undefined) return;
    const rects =
      id === "event-info" || id === "family"
        ? leafRects(el, mainRect)
        : id === "celebrations"
          ? ritualRowRects(el, mainRect)
          : [];
    if (rects.length >= 2) subdivisions[id] = rects;
  });
  return subdivisions;
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

/* How much of the WHOLE page's dash has drawn at the current scroll position -- `groupRects` and
   `ranges` are `threadLine`'s own index-aligned `groupRects`/`sections` output, read once per layout
   change (never re-measured here) and handed in by the caller; `viewportHeight` is likewise captured
   at that same layout instant, so a scroll frame touches no DOM beyond `window.scrollY` itself. One
   entry per GROUP now, not one per THREAD_ID section -- a stacked pair or a ritual-row list
   contributes more than one entry, each with its OWN card/row rect, which is the whole fix this task
   makes (`thread-line.ts`'s own header on `ThreadLine.groupRects`). */
function pageDrawnLength(
  groupRects: readonly SectionRect[],
  ranges: readonly SectionRange[],
  viewportHeight: number,
): number {
  return drawnLength(window.scrollY, viewportHeight, groupRects, ranges);
}

function applyDash(path: SVGPathElement, length: number, progress: number) {
  const { dasharray, dashoffset } = dashForPiece(length, progress);
  path.style.strokeDasharray = String(dasharray);
  path.style.strokeDashoffset = String(dashoffset);
}

function clearDash(path: SVGPathElement) {
  path.style.strokeDasharray = "";
  path.style.strokeDashoffset = "";
}

/* The opening sequence hands off at 2200ms -- ground present, then mount 200-600, stock 800-1200,
   type 1400-1800, the thread's own fade 1800-2200 (`DESIGN.md` -> Motion -> The opening sequence).
   The draw begins as that fade completes, so this is the sequence's own end, not a value of its own.
   The duration is the invite's three pieces at one `--duration-base` (400ms) each -- a token
   multiple rather than a coined number, since a fresh design value is the owner's to set.
   The thread's own fade no longer waits a beat after the type: the owner asked for less dead air
   between the names appearing and the line starting, so the fade begins as the type lands. */
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

/* Drives every piece's own `<path>` from the ONE page-level `drawn` scalar -- `pieceProgress`
   (`thread-line.ts`) is what makes "exactly one piece mid-draw" hold, by construction, from here:
   `pieces[k]` and `paths[k]` are index-aligned (`splitSubpaths(d)` emits one subpath per piece, in
   the same connection order `pieces` is built in -- proven in `thread-line.test.ts`'s own "exactly
   one subpath per connector and per motif" test), so this loop never has to match them up by name. */
function applyPieceDashes(
  paths: readonly (SVGPathElement | null)[],
  pieces: readonly ThreadPiece[],
  drawn: number,
) {
  pieces.forEach((piece, index) => {
    const path = paths[index];
    if (path === null || path === undefined) return;
    const length = piece.end - piece.start;
    applyDash(path, length, pieceProgress(drawn, piece));
  });
}

function clearPieceDashes(paths: readonly (SVGPathElement | null)[]) {
  for (const path of paths) {
    if (path !== null) clearDash(path);
  }
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
  /* One entry per main-trunk piece (`MAIN_PIECE_COUNT`, fixed), index-aligned with `piecesRef`
     below -- a callback ref per `<path>` populates this on mount/unmount rather than one ref per
     the old single trunk path. */
  const pathsRef = useRef<(SVGPathElement | null)[]>([]);
  const piecesRef = useRef<readonly ThreadPiece[]>([]);
  /* Fed to `pageDrawnLength` on every scroll frame -- all three captured at the same layout instant
     as `measured.sections` itself, never re-measured on scroll. `groupRectsRef` is `threadLine`'s own
     per-GROUP window rects (a stacked pair's own two card rects, a ritual list's own row rects, or a
     section's whole rect where nothing splits it) -- the card/row split this task adds, index-aligned
     with `rangesRef`, never the whole-section rects `measured.sections` itself carries. */
  const groupRectsRef = useRef<readonly SectionRect[]>([]);
  const rangesRef = useRef<readonly SectionRange[]>([]);
  const viewportHeightRef = useRef(0);
  /* The owner's "and then stay drawn" (`createDrawRatchet`'s own header) -- every value that
     reaches `applyPieceDashes` below goes through this, so scrolling back up can only ever hold the
     line where it was, never unravel it. `WishesWeave` owns its own; the two maxima are in
     different path lengths and would mean nothing to each other. */
  const ratchetRef = useRef(createDrawRatchet());

  function measure() {
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
    groupRectsRef.current = groupRects;
    rangesRef.current = ranges;
    viewportHeightRef.current = window.innerHeight;
    fallbackSvg.style.display = "none";

    if (reducedMotion()) {
      clearPieceDashes(pathsRef.current);
    } else {
      /* The path this ratchet's maximum was measured against no longer exists, so the maximum goes
         with it and the `advance` below re-seeds from the fresh measurement. The opening draw's own
         floor is RE-DERIVED from the new ranges rather than carried across as a stale length --
         without it, a resize at the very top after the sequence has run would unravel the invite's
         thread and leave a reader who has not scrolled looking at nothing. */
      ratchetRef.current.reset();
      const drawn = pageDrawnLength(
        groupRectsRef.current,
        rangesRef.current,
        viewportHeightRef.current,
      );
      applyPieceDashes(
        pathsRef.current,
        piecesRef.current,
        ratchetRef.current.advance(
          Math.max(
            drawn,
            openingFloor(rangesRef.current, openingCompleteRef.current),
          ),
        ),
      );
    }
  }

  useLayoutTriggers(measure);

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

  useEffect(() => {
    if (reducedMotion() || window.scrollY > 0) return;
    let rafId: number | null = null;
    let startedAt = 0;

    const timer = window.setTimeout(() => {
      /* The invite stops its own last connector at 75%, exactly as every other group does, so the
         line is already reaching toward Event Info when the reader starts scrolling. Drawing it to
         100% here made the thread look stuck for the whole first screen of scroll -- there was
         nothing left in the invite to draw and the next group had not opened yet. */
      const target = openingFloor(rangesRef.current, true);
      if (target <= 0) return;
      const step = (now: number) => {
        if (startedAt === 0) startedAt = now;
        const t = Math.min(1, (now - startedAt) / OPENING_DRAW_DURATION);
        applyPieceDashes(
          pathsRef.current,
          piecesRef.current,
          ratchetRef.current.advance(target * t),
        );
        if (t < 1) rafId = window.requestAnimationFrame(step);
        else openingCompleteRef.current = true;
      };
      rafId = window.requestAnimationFrame(step);
    }, OPENING_DRAW_DELAY);

    return () => {
      window.clearTimeout(timer);
      if (rafId !== null) window.cancelAnimationFrame(rafId);
    };
  }, []);

  useEffect(() => {
    let rafId: number | null = null;

    function onScroll() {
      if (rafId !== null || reducedMotion()) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        applyPieceDashes(
          pathsRef.current,
          piecesRef.current,
          ratchetRef.current.advance(
            pageDrawnLength(
              groupRectsRef.current,
              rangesRef.current,
              viewportHeightRef.current,
            ),
          ),
        );
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
            /* The fallback's `d` lives in a normalised 0-1 square (`thread-fallback.ts`'s
               `normalise`), stretched by `.pageRoot`'s real box to cover `<main>` -- a coordinate
               system nothing like the live path's, which is already in real page pixels 1:1
               (this file's own header comment on why THAT path omits `vector-effect`). Without it,
               `--stroke-thread`'s raw px value is read as that many USER-SPACE units in a space
               where one unit is now ~1500px, which paints not a thread but a solid rectangle --
               found on the first real no-JS render once `.pageWrapper` had a box to paint in at all
               (`final-review-fixes.md`). */
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
            `measure()`/`onScroll` above. `key`s are stable indices, not piece identity, exactly
            like the fallback's own `band` keys above: the SET of pieces this page draws is fixed
            (structural, band-invariant -- `MAIN_PIECE_COUNT`'s own header), so index and identity
            never diverge here. */}
        {Array.from({ length: MAIN_PIECE_COUNT }, (_, index) => (
          <path
            className={styles.pageInk}
            d=""
            data-thread-piece={index}
            // biome-ignore lint/suspicious/noArrayIndexKey: MAIN_PIECE_COUNT is a fixed structural constant -- these never reorder or change count.
            key={index}
            ref={(el) => {
              pathsRef.current[index] = el;
            }}
          />
        ))}
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
  /* One entry per `wishes` piece (`WISHES_PIECE_COUNT`, fixed) -- same per-piece shape as
     `PageThread`'s `pathsRef`/`piecesRef` above, for the same reason: `wishes` is not exempt from
     the one-dash-per-subpath finding just because it draws through its own weave rather than
     `PageThread`'s trunk. */
  const pathsRef = useRef<(SVGPathElement | null)[]>([]);
  const piecesRef = useRef<readonly ThreadPiece[]>([]);
  /* Same three inputs `PageThread` keeps, captured at the same layout instant as its own copy --
     each `WishesWeave` measures independently (see the header comment), so it keeps its own.
     `groupRectsRef` is `threadLine`'s own per-GROUP rects, exactly like `PageThread`'s -- `wishes`
     itself never splits, but the CHAIN leading up to it (through `celebrations`'s own groups) must
     be built from the SAME measured subdivisions `PageThread` uses, or the two components would hand
     `wishes` two different answers for where its own crossing predecessor left off
     (`measureSubdivisions`'s own header). */
  const groupRectsRef = useRef<readonly SectionRect[]>([]);
  const rangesRef = useRef<readonly SectionRange[]>([]);
  const viewportHeightRef = useRef(0);
  /* Wishes' own stretch stays drawn on the way back up exactly as the trunk does, and needs its own
     ratchet to do it: this component's maximum is a length along the WEAVE's path, which is not the
     trunk's (`PageThread`'s own `ratchetRef`). */
  const ratchetRef = useRef(createDrawRatchet());

  function reveal() {
    const pageDrawn = pageDrawnLength(
      groupRectsRef.current,
      rangesRef.current,
      viewportHeightRef.current,
    );
    if (reducedMotion()) {
      clearPieceDashes(pathsRef.current);
    } else {
      applyPieceDashes(
        pathsRef.current,
        piecesRef.current,
        ratchetRef.current.advance(pageDrawn),
      );
    }
  }

  function measure() {
    const wrapper = wrapperRef.current;
    const svg = svgRef.current;
    if (wrapper === null || svg === null) return;
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

    const subdivisions = measureSubdivisions(measured.sectionEls, mainRect);
    const {
      sections: ranges,
      groupRects,
      pieces,
      d,
    } = threadLine(band, measured.sections, undefined, subdivisions);
    const range = subpathRange(band, "wishes");
    const subpaths = splitSubpaths(d);
    const wishesSubpaths = subpaths.slice(range.start, range.end);
    const wishesPieces = pieces.slice(range.start, range.end);

    wishesSubpaths.forEach((pieceD, index) => {
      pathsRef.current[index]?.setAttribute("d", pieceD);
    });
    // `wishesPieces`' own `start`/`end` are already on the PAGE's global cumulative scale (the same
    // one `pageDrawnLength` produces), so `pieceProgress` needs no local re-basing here -- unlike
    // the retired single-dash `beforeLengthRef`, which had to subtract the page total down to
    // wishes' own local arc length because it was reasoning about ONE combined dash.
    piecesRef.current = wishesPieces;

    groupRectsRef.current = groupRects;
    rangesRef.current = ranges;
    viewportHeightRef.current = window.innerHeight;
    /* Same reason as `PageThread`'s own reset: the maximum described the path this re-measure has
       just replaced. `reveal` re-seeds it from the fresh measurement on the next line. */
    ratchetRef.current.reset();
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
        {Array.from({ length: WISHES_PIECE_COUNT }, (_, index) => (
          <path
            className={styles.pageInk}
            d=""
            data-thread-piece={index}
            // biome-ignore lint/suspicious/noArrayIndexKey: WISHES_PIECE_COUNT is a fixed structural constant -- these never reorder or change count.
            key={index}
            ref={(el) => {
              pathsRef.current[index] = el;
            }}
          />
        ))}
      </svg>
    </span>
  );
}

/* THE ONE THING TASK 6 MUST ADD BESIDES THE MOUNT ITSELF: `<main>` needs `position: relative` so
   `.pageWrapper`'s own `inset: 0` (`thread.module.css`) resolves against `<main>`'s box rather than
   walking further up the ancestor chain to whatever the next positioned element happens to be (the
   initial containing block, absent one) — the CORRECTED reason this rule exists; an earlier version
   of this comment named `.pageRoot`, the wrapper's own child, which was never the thing depending on
   `<main>` (`final-review-fixes.md`). Every JS-driven measurement above reads real rects via
   `getBoundingClientRect()` and does not depend on which element establishes any containing block, so
   `position: relative` matters only to the no-JS reader, who gets nothing else to size against.
   `position: relative` adds no z-index, so it opens no new stacking context and cannot touch the
   botanical blend layer. */
