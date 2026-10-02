"use client";

import { useCallback, useEffect, useRef } from "react";
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
  HEAD_LENGTH_RATIO,
  HEAD_STEP_OVERLAP,
  type HeadOptions,
  type HeadSegment,
  headSegments,
  type PieceSamples,
  paintedLength,
  parseCssTime,
  polylineBetween,
  RETRACE_LENGTH_RATIO,
  type RetracePhase,
  type Rgb,
  retraceFade,
  retraceGlow,
  retracePhase,
  retraceSegments,
  retraceSpan,
  retraceTargets,
  samplePath,
  TAPER_CUT_WIDTH,
  TAPER_STEPS,
  type TaperSegment,
  taperCut,
  taperReached,
  taperSegments,
  tipGroupIndex,
} from "./thread-light";
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

/* ---------------------------------------------------------------------------------------------
   THE DRAWING HEAD — light laid over the leading end of the ink while a piece draws. The arithmetic
   is `thread-light.ts`'s and has no DOM; what is here is what needs one: reading the tokens and
   keeping a pool of `<path>`s.

   Each step of the head is a polyline through only its own run of the piece, never a dash on a copy
   of the whole piece. Measured: at equal radius and one grouped filter, dashed copies of whole pieces
   cost 54 dropped frames against 10 for the polylines. Inferred, not observed: that a dashed path's
   bounding box is the whole piece however short the visible dash is, so the head's halo filter
   processes far more than the head. A piece's points are computed from its own `d` (`samplePath`),
   once, the first time the head reaches it, and a frame slices those numbers. */

const SVG_NS = "http://www.w3.org/2000/svg";

/* How close to a piece's own end counts as being at it: a run is clipped to the piece's length, so
   this only absorbs floating-point rounding. */
const END_TOLERANCE = 0.01;

/* Read from the built stylesheet rather than copied, so a token edit cannot leave the head behind. */
function tokenLength(token: string): number {
  return Number.parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue(token),
  );
}

function tokenColour(token: string): Rgb {
  const probe = document.createElement("span");
  probe.style.color = `var(${token})`;
  document.body.append(probe);
  const [r = 0, g = 0, b = 0] =
    getComputedStyle(probe)
      .color.match(/[\d.]+/g)
      ?.map(Number) ?? [];
  probe.remove();
  return [r, g, b];
}

let resolvedHeadOptions: HeadOptions | undefined;

function headOptions(): HeadOptions {
  if (resolvedHeadOptions !== undefined) return resolvedHeadOptions;
  const baseWidth = tokenLength("--stroke-thread");
  resolvedHeadOptions = {
    length: HEAD_LENGTH_RATIO * baseWidth,
    tipWidth: tokenLength("--stroke-thread-head"),
    baseWidth,
    tailColor: tokenColour("--color-thread-red"),
    midColor: tokenColour("--color-thread-vermilion"),
    tipColor: tokenColour("--color-thread-core"),
  };
  return resolvedHeadOptions;
}

/* Writes an attribute only when it changed: the head repaints every frame, and re-setting an
   identical attribute still costs a call. */
function setAttribute(element: Element, name: string, value: string) {
  if (element.getAttribute(name) !== value) element.setAttribute(name, value);
}

/* One painter per `<svg>` that carries a share of the head. `pathOf` maps a piece's index in the
   WHOLE chain to that piece's `d` in this `<svg>`, or nothing when the piece lives in another
   one — so the trunk and the weave call `paint` with the same chain and each draws its own runs,
   which is what lets the head cross the join between them. */
function createHeadPainter(
  group: SVGGElement,
  pathOf: (piece: number) => string | undefined,
  samples: Map<number, PieceSamples> = new Map(),
) {
  const pool = new Map<string, SVGPathElement>();
  let shown = new Set<SVGPathElement>();

  /* Elements are kept in rank order as they are created, so paint order is the DOM order. A tight
     loop crosses itself, and the tip's step has to lie over the tail steps beneath it. */
  function elementFor(segment: HeadSegment): SVGPathElement {
    const key = `${segment.piece}:${segment.step}:${segment.cap}`;
    const existing = pool.get(key);
    if (existing !== undefined) return existing;
    const element = document.createElementNS(SVG_NS, "path");
    element.dataset.rank = String(segment.rank);
    element.setAttribute("stroke-linecap", segment.cap);
    const above = Array.from(group.children).find(
      (child) => Number((child as SVGElement).dataset.rank) > segment.rank,
    );
    group.insertBefore(element, above ?? null);
    pool.set(key, element);
    return element;
  }

  function hide() {
    for (const element of shown) element.style.display = "none";
    shown = new Set();
    group.style.display = "none";
  }

  function paintSegments(
    segments: readonly HeadSegment[],
    pieces: readonly ThreadPiece[],
  ) {
    const used = new Set<SVGPathElement>();
    for (const segment of segments) {
      const d = pathOf(segment.piece);
      if (d === undefined) continue;
      const piece = pieces[segment.piece];
      const length = piece.end - piece.start;
      let sampled = samples.get(segment.piece);
      if (sampled === undefined) {
        sampled = samplePath(d, length);
        samples.set(segment.piece, sampled);
      }
      const element = elementFor(segment);
      const continuesElsewhere =
        segment.piece + 1 < pieces.length &&
        pathOf(segment.piece + 1) === undefined &&
        segment.end >= length - END_TOLERANCE;
      setAttribute(
        element,
        "d",
        polylineBetween(
          sampled,
          segment.start,
          segment.end + (continuesElsewhere ? HEAD_STEP_OVERLAP : 0),
        ),
      );
      setAttribute(element, "stroke", segment.stroke);
      setAttribute(element, "stroke-width", segment.width.toFixed(3));
      if (element.style.display !== "") element.style.display = "";
      used.add(element);
    }
    for (const element of shown) {
      if (!used.has(element)) element.style.display = "none";
    }
    shown = used;
    group.style.display = used.size === 0 ? "none" : "";
  }

  return {
    paint(drawn: number, pieces: readonly ThreadPiece[], options: HeadOptions) {
      paintSegments(headSegments(drawn, pieces, options), pieces);
    },
    paintSegments,
    /* A re-measure replaces every piece's `d`, so what was sampled describes a path that is gone. */
    reset() {
      samples.clear();
      hide();
    },
    hide,
  };
}

type HeadPainter = ReturnType<typeof createHeadPainter>;

/* ---------------------------------------------------------------------------------------------
   THE RE-TRACE — a lit segment that runs a stretch of the thread once it is already drawn
   (`thread-light.ts`; DESIGN.md -> Thread -> The re-trace). The arithmetic is `thread-light.ts`'s;
   what is here is what needs a DOM: the painters, the loop that drives them, and the tokens.

   It is the head's own stack, laid again, so each stretch that is animating gets a `<g>` and the head's
   painter inside it. The painters share the head's samples, so a piece is sampled once whichever
   layer reaches it first. Each stretch's `<g>` takes the head's halo as its one filter (`thread.module.css`). */

/* The drawing head's own settled values (the owner's ruling, 2026-10-02) with the re-trace's peak
   length: the head's options, read once from the same tokens, not a second copy of any of them. */
let resolvedRetraceOptions: HeadOptions | undefined;

function retraceOptions(): HeadOptions {
  resolvedRetraceOptions ??= {
    ...headOptions(),
    length: RETRACE_LENGTH_RATIO * tokenLength("--stroke-thread"),
  };
  return resolvedRetraceOptions;
}

function tokenTime(token: string): number | undefined {
  return parseCssTime(
    getComputedStyle(document.documentElement).getPropertyValue(token),
  );
}

interface RetraceFrame {
  readonly tail: number;
  readonly tip: number;
}

function createRetracePainter(
  container: SVGGElement,
  glowContainer: SVGGElement,
  pathOf: (piece: number) => string | undefined,
  samples: Map<number, PieceSamples>,
) {
  const stretches = new Map<
    number,
    {
      element: SVGGElement;
      painter: HeadPainter;
      glowElement: SVGGElement;
      glowPainter: HeadPainter;
    }
  >();

  function stretchFor(index: number) {
    const existing = stretches.get(index);
    if (existing !== undefined) return existing;
    const element = document.createElementNS(SVG_NS, "g");
    element.dataset.threadRetraceGroup = String(index);
    container.append(element);
    const glowElement = document.createElementNS(SVG_NS, "g");
    glowElement.dataset.threadRetraceGlow = String(index);
    glowContainer.append(glowElement);
    const made = {
      element,
      painter: createHeadPainter(element, pathOf, samples),
      glowElement,
      glowPainter: createHeadPainter(glowElement, pathOf, samples),
    };
    stretches.set(index, made);
    return made;
  }

  return {
    /* One frame: the segment of each animating stretch, and every other stretch hidden. */
    paint(
      frames: ReadonlyMap<number, RetraceFrame>,
      pieces: readonly ThreadPiece[],
      options: HeadOptions,
    ) {
      for (const [index, { painter, glowPainter }] of stretches) {
        if (frames.has(index)) continue;
        painter.hide();
        glowPainter.hide();
      }
      for (const [index, { tail, tip }] of frames) {
        const { element, painter, glowElement, glowPainter } =
          stretchFor(index);
        painter.paintSegments(
          retraceSegments(tail, tip, pieces, options),
          pieces,
        );
        glowPainter.paintSegments(
          retraceGlow(tail, tip, pieces, options.midColor),
          pieces,
        );
        const opacity = retraceFade(tip - tail, options.length);
        const value = opacity >= 1 ? "" : opacity.toFixed(3);
        if (element.style.opacity !== value) element.style.opacity = value;
        if (glowElement.style.opacity !== value) {
          glowElement.style.opacity = value;
        }
      }
    },
    hide() {
      for (const { painter, glowPainter } of stretches.values()) {
        painter.hide();
        glowPainter.hide();
      }
    },
  };
}

type RetracePainter = ReturnType<typeof createRetracePainter>;

/* ---------------------------------------------------------------------------------------------
   THE TAPERED ENDS — the invite's top terminal and Wishes' close come to a point. The arithmetic is
   `thread-light.ts`'s; what is here is the DOM it needs.

   A taper is a stack of narrowing runs laid over a stretch of ink that has been cut away beneath
   them (a stroke cannot be thinned by drawing a narrower one over it). The cut is a `<mask>` on the
   piece's own `<path>`, and deliberately not a change to the piece: its `d` and its dash are what
   the draw-order gate reads, and "the light must not move the line" holds only while they stay
   exactly as `applyPieceDashes` writes them. The runs and the cut are built once, when the page is
   measured; a frame only shows the runs the ink has reached. */

interface TaperEnd {
  /* The `d` of the piece the end sits on, and its length from the model. */
  readonly d: string;
  readonly length: number;
  readonly endAt: number;
  readonly direction: -1 | 1;
}

interface TaperOptionsResolved {
  readonly taperLength: number;
  readonly strokeWidth: number;
}

/* Read at each measure rather than cached, so a retuned token takes effect on the next re-measure. */
function taperOptions(): TaperOptionsResolved {
  const root = getComputedStyle(document.documentElement);
  return {
    taperLength: Number.parseFloat(
      root.getPropertyValue("--length-thread-taper"),
    ),
    strokeWidth: Number.parseFloat(root.getPropertyValue("--stroke-thread")),
  };
}

/* The mask's region is the piece's own bounding box and a margin for the cap, not the whole svg:
   outside its region the masked ink is not painted at all, so the region must cover the piece, and
   it must be no larger than that. A region that covered every page the thread could span (100000px
   either way) made the page cost 27.1ms mean frame time and 116 dropped frames over the scrub
   against 17.0 and 6, although only three pieces carry a mask. */
const MASK_MARGIN = 4;

function fitMaskRegion(cut: SVGPathElement, { xy }: PieceSamples) {
  const mask = cut.parentElement;
  if (mask === null) return;
  let [left, top, right, bottom] = [xy[0], xy[1], xy[0], xy[1]];
  for (let i = 2; i < xy.length; i += 2) {
    left = Math.min(left, xy[i]);
    right = Math.max(right, xy[i]);
    top = Math.min(top, xy[i + 1]);
    bottom = Math.max(bottom, xy[i + 1]);
  }
  mask.setAttribute("x", String(left - MASK_MARGIN));
  mask.setAttribute("y", String(top - MASK_MARGIN));
  mask.setAttribute("width", String(right - left + 2 * MASK_MARGIN));
  mask.setAttribute("height", String(bottom - top + 2 * MASK_MARGIN));
}

function createTaperPainter(group: SVGGElement, cut: SVGPathElement) {
  let runs: { element: SVGPathElement; segment: TaperSegment }[] = [];

  return {
    /* Replaces the taper for a new `d`: every run is built here, hidden until `paint` shows it. */
    set(
      end: TaperEnd | undefined,
      { taperLength, strokeWidth }: TaperOptionsResolved,
    ) {
      group.replaceChildren();
      runs = [];
      cut.removeAttribute("d");
      group.style.display = "none";
      if (end === undefined) return;
      const samples = samplePath(end.d, end.length);
      /* Fitted even when there is no taper to build, so the mask never keeps its unmeasured region. */
      fitMaskRegion(cut, samples);
      if (!(taperLength > 0) || !(strokeWidth > 0)) return;
      const span = taperCut(end.endAt, end.length, end.direction, taperLength);
      cut.setAttribute("d", polylineBetween(samples, span.from, span.to));
      for (const segment of taperSegments(
        end.endAt,
        end.length,
        end.direction,
        {
          steps: TAPER_STEPS,
          taperLength,
          strokeWidth,
        },
      )) {
        const element = document.createElementNS(SVG_NS, "path");
        element.setAttribute(
          "d",
          polylineBetween(samples, segment.start, segment.end),
        );
        element.setAttribute("stroke-width", segment.width.toFixed(3));
        element.style.display = "none";
        group.append(element);
        runs.push({ element, segment });
      }
    },
    /* `painted` is how far along the piece the ink has reached. */
    paint(painted: number) {
      let shown = 0;
      for (const { element, segment } of runs) {
        const visible = taperReached(segment, painted);
        const display = visible ? "" : "none";
        if (element.style.display !== display) element.style.display = display;
        if (visible) shown += 1;
      }
      const groupDisplay = shown === 0 ? "none" : "";
      if (group.style.display !== groupDisplay)
        group.style.display = groupDisplay;
    },
  };
}

type TaperPainter = ReturnType<typeof createTaperPainter>;

/* One piece's ink. A piece that carries a taper is cut BEFORE its bleed, not after: the filter sits on
   a group around the masked path, so the halo is the halo of the ink that is left and falls away
   naturally at the cut. Masking the filter's output instead leaves the halo of the full-width ink
   standing up to a straight edge, a visible rectangle beside the taper. */
function ThreadInk({
  cutId,
  index,
  pathRef,
}: {
  cutId: string | undefined;
  index: number;
  pathRef: React.Ref<SVGPathElement>;
}) {
  if (cutId === undefined) {
    return (
      <path
        className={styles.pageInk}
        d=""
        data-thread-piece={index}
        ref={pathRef}
      />
    );
  }
  return (
    <g className={styles.pageBleed}>
      <path
        className={styles.pageInkBare}
        d=""
        data-thread-piece={index}
        mask={`url(#${cutId})`}
        ref={pathRef}
      />
    </g>
  );
}

/* The mask that cuts the ink away under a taper. One per `<svg>`, so its id is fixed per slot: the
   trunk's, and each of the weave's two copies. `maskUnits` is the user space because the default
   region is a percentage margin around the piece's bounding box, which is not a margin the cut can
   rely on. This extent is only the region before the page is measured: `fitMaskRegion` narrows it
   to the piece, which is what keeps the mask cheap. */
const MASK_EXTENT = 100000;
const TRUNK_CUT_ID = "thread-taper-cut-trunk";

function TaperCutMask({
  id,
  cutRef,
}: {
  id: string;
  cutRef: React.Ref<SVGPathElement>;
}) {
  return (
    <defs>
      <mask
        height={2 * MASK_EXTENT}
        id={id}
        maskUnits="userSpaceOnUse"
        width={2 * MASK_EXTENT}
        x={-MASK_EXTENT}
        y={-MASK_EXTENT}
      >
        <rect
          fill="white"
          height={2 * MASK_EXTENT}
          width={2 * MASK_EXTENT}
          x={-MASK_EXTENT}
          y={-MASK_EXTENT}
        />
        <path
          fill="none"
          ref={cutRef}
          stroke="black"
          strokeLinecap="butt"
          strokeLinejoin="round"
          strokeWidth={TAPER_CUT_WIDTH}
        />
      </mask>
    </defs>
  );
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

/* Which stretches should be looping now, and in which phase. A thread still being drawn loops only
   while its tip is still, which is what `moving` records. */
function retraceNow(
  ranges: readonly SectionRange[],
  groupRects: readonly SectionRect[],
  drawn: number,
  moving: boolean,
  viewport: { scrollY: number; height: number },
): { phase: RetracePhase; targets: number[] } {
  const last = ranges[ranges.length - 1];
  if (last === undefined) return { phase: "drawing", targets: [] };
  const phase = retracePhase(drawn, last.end);
  if (phase === "drawing" && moving) return { phase, targets: [] };
  return {
    phase,
    targets: retraceTargets(
      phase,
      groupRects,
      viewport,
      tipGroupIndex(ranges, drawn),
    ),
  };
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
  /* EVERY piece of the page, weave included: the head is the last stretch of the drawn line, so
     when the tip is a few pixels into Wishes' first piece the trunk still draws the head's tail in
     its own last one (`thread-light.ts`'s header). */
  const chainRef = useRef<readonly ThreadPiece[]>([]);
  const headGroupRef = useRef<SVGGElement>(null);
  const headRef = useRef<HeadPainter | null>(null);
  const taperGroupRef = useRef<SVGGElement>(null);
  const cutRef = useRef<SVGPathElement>(null);
  const taperRef = useRef<TaperPainter | null>(null);
  const retraceGroupRef = useRef<SVGGElement>(null);
  const retraceGlowRef = useRef<SVGGElement>(null);
  const retraceRef = useRef<RetracePainter | null>(null);
  /* One sampling of each piece, whichever of the head and the re-trace reaches it first. */
  const samplesRef = useRef(new Map<number, PieceSamples>());
  /* The re-trace's state. `drawnRef` is the ratchet's held value as the last frame saw it; `moving`
     is true from any advance of it until `--retrace-settle` has passed without another. */
  const drawnRef = useRef(0);
  const movingRef = useRef(false);
  const settleTimerRef = useRef<number | null>(null);
  const retraceFrameRef = useRef<number | null>(null);
  const retraceStartRef = useRef(0);
  const retraceNowRef = useRef<ReturnType<typeof retraceNow>>({
    phase: "drawing",
    targets: [],
  });
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

  /* The `d` of a chain piece that lives in this `<svg>`, or nothing for the weave's. */
  const pathOf = useCallback(
    (index: number) =>
      index < piecesRef.current.length
        ? (pathsRef.current[index]?.getAttribute("d") ?? undefined)
        : undefined,
    [],
  );

  const head = useCallback((): HeadPainter | null => {
    const group = headGroupRef.current;
    if (group === null) return null;
    headRef.current ??= createHeadPainter(group, pathOf, samplesRef.current);
    return headRef.current;
  }, [pathOf]);

  const retrace = useCallback((): RetracePainter | null => {
    const group = retraceGroupRef.current;
    const glow = retraceGlowRef.current;
    if (group === null || glow === null) return null;
    retraceRef.current ??= createRetracePainter(
      group,
      glow,
      pathOf,
      samplesRef.current,
    );
    return retraceRef.current;
  }, [pathOf]);

  /* Nothing is painted while no frame is running, so there is nothing to hide when none is. */
  const stopRetrace = useCallback(() => {
    if (retraceFrameRef.current === null) return;
    window.cancelAnimationFrame(retraceFrameRef.current);
    retraceFrameRef.current = null;
    retrace()?.hide();
  }, [retrace]);

  /* Brings the loop in line with the state: starts it, stops it, or lets a running one pick up new
     targets on its next frame. Called at every event that can change which stretches should animate —
     an advance of the drawn length, a scroll frame, the end of the settle interval, a re-measure. */
  const syncRetrace = useCallback(() => {
    const painter = retrace();
    const state = reducedMotion()
      ? { phase: "drawing" as const, targets: [] }
      : retraceNow(
          rangesRef.current,
          groupRectsRef.current,
          drawnRef.current,
          movingRef.current,
          { scrollY: window.scrollY, height: viewportHeightRef.current },
        );
    retraceNowRef.current = state;
    if (painter === null || state.targets.length === 0) {
      stopRetrace();
      return;
    }
    if (retraceFrameRef.current !== null) return;
    const duration = tokenTime("--retrace-duration");
    if (duration === undefined) return;
    retraceStartRef.current = performance.now();
    const frame = (now: number) => {
      const { phase, targets } = retraceNowRef.current;
      const options = retraceOptions();
      const loop = (Math.max(0, now - retraceStartRef.current) / duration) % 1;
      const frames = new Map<number, RetraceFrame>();
      for (const index of targets) {
        const range = rangesRef.current[index];
        const end =
          phase === "drawing"
            ? Math.min(range.end, drawnRef.current)
            : range.end;
        if (end - range.start <= 0) continue;
        const span = retraceSpan(loop, end - range.start, options.length);
        frames.set(index, {
          tail: range.start + span.tail,
          tip: range.start + span.tip,
        });
      }
      painter.paint(frames, chainRef.current, options);
      retraceFrameRef.current = window.requestAnimationFrame(frame);
    };
    retraceFrameRef.current = window.requestAnimationFrame(frame);
  }, [retrace, stopRetrace]);

  const rest = useCallback(() => {
    if (settleTimerRef.current !== null) {
      window.clearTimeout(settleTimerRef.current);
      settleTimerRef.current = null;
    }
    movingRef.current = false;
    syncRetrace();
  }, [syncRetrace]);

  /* Every advance of the drawn length starts the thread's stillness over. A drawn length that has not
     advanced (scrolling back up over a drawn thread, or any scroll once it is complete) is not
     movement and leaves the interval alone. */
  const advanced = useCallback(
    (drawn: number) => {
      if (drawn > drawnRef.current) {
        drawnRef.current = drawn;
        movingRef.current = true;
        if (settleTimerRef.current !== null) {
          window.clearTimeout(settleTimerRef.current);
        }
        const settle = tokenTime("--retrace-settle");
        settleTimerRef.current =
          settle === undefined ? null : window.setTimeout(rest, settle);
      }
      syncRetrace();
    },
    [rest, syncRetrace],
  );

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
      head()?.paint(drawn, chainRef.current, headOptions());
      const first = piecesRef.current[0];
      if (first !== undefined) taper()?.paint(paintedLength(drawn, first));
    },
    [head, taper],
  );

  /* The one place a drawn length is taken from the scroll or the opening draw and put on the page:
     through the ratchet, drawn, and told to the re-trace. */
  const commit = useCallback(
    (value: number) => {
      const drawn = ratchetRef.current.advance(value);
      draw(drawn);
      advanced(drawn);
    },
    [draw, advanced],
  );

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
    chainRef.current = pieces;
    stopRetrace();
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
    groupRectsRef.current = groupRects;
    rangesRef.current = ranges;
    viewportHeightRef.current = window.innerHeight;
    fallbackSvg.style.display = "none";

    if (reducedMotion()) {
      clearPieceDashes(pathsRef.current);
      taper()?.paint(Number.POSITIVE_INFINITY);
    } else {
      /* The path this ratchet's maximum was measured against no longer exists, so the maximum goes
         with it and the `advance` below re-seeds from the fresh measurement. The opening draw's own
         floor is RE-DERIVED from the new ranges rather than carried across as a stale length --
         without it, a resize at the very top after the sequence has run would unravel the invite's
         thread and leave a reader who has not scrolled looking at nothing. The re-seed is not
         movement, so it does not start the re-trace's settle interval over. */
      ratchetRef.current.reset();
      const drawn = ratchetRef.current.advance(
        Math.max(
          pageDrawnLength(
            groupRectsRef.current,
            rangesRef.current,
            viewportHeightRef.current,
          ),
          openingFloor(rangesRef.current, openingCompleteRef.current),
        ),
      );
      drawnRef.current = drawn;
      draw(drawn);
    }
    syncRetrace();
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
        commit(target * t);
        if (t < 1) rafId = window.requestAnimationFrame(step);
        else {
          openingCompleteRef.current = true;
          /* The opening draw ends in a stop, not a scroll, so the cue's loop begins now rather than
             after the settle interval a reader's own scroll waits out. */
          rest();
        }
      };
      rafId = window.requestAnimationFrame(step);
    }, OPENING_DRAW_DELAY);

    return () => {
      window.clearTimeout(timer);
      if (rafId !== null) window.cancelAnimationFrame(rafId);
    };
  }, [commit, rest]);

  useEffect(() => {
    let rafId: number | null = null;

    function onScroll() {
      if (rafId !== null || reducedMotion()) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        commit(
          pageDrawnLength(
            groupRectsRef.current,
            rangesRef.current,
            viewportHeightRef.current,
          ),
        );
      });
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", onScroll);
    };
  }, [commit]);

  useEffect(
    () => () => {
      if (settleTimerRef.current !== null) {
        window.clearTimeout(settleTimerRef.current);
      }
      stopRetrace();
    },
    [stopRetrace],
  );

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
        <TaperCutMask cutRef={cutRef} id={TRUNK_CUT_ID} />
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
        <g className={styles.pageTaper} ref={taperGroupRef} />
        <g className={styles.pageRetraceGlow} ref={retraceGlowRef} />
        <g className={styles.pageRetrace} ref={retraceGroupRef} />
        <g className={styles.pageHead} ref={headGroupRef} />
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
  /* The head's chain is the whole page's, and `firstPieceRef` is where this weave's own pieces
     begin in it -- each copy draws the share of the head that lies in its own pieces, from the same
     drawn length the trunk uses, so the head crosses the join unbroken. The weave's `viewBox` is
     the card's rect in `<main>` coordinates and its box is that same rect, so its user space is
     1:1 with page pixels and the head's widths need no correction. */
  const chainRef = useRef<readonly ThreadPiece[]>([]);
  const firstPieceRef = useRef(0);
  const headGroupRef = useRef<SVGGElement>(null);
  const headRef = useRef<HeadPainter | null>(null);
  const taperGroupRef = useRef<SVGGElement>(null);
  const cutRef = useRef<SVGPathElement>(null);
  const taperRef = useRef<TaperPainter | null>(null);
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

  function head(): HeadPainter | null {
    const group = headGroupRef.current;
    if (group === null) return null;
    headRef.current ??= createHeadPainter(group, (index) =>
      index >= firstPieceRef.current
        ? (pathsRef.current[index - firstPieceRef.current]?.getAttribute("d") ??
          undefined)
        : undefined,
    );
    return headRef.current;
  }

  function taper(): TaperPainter | null {
    const group = taperGroupRef.current;
    const cut = cutRef.current;
    if (group === null || cut === null) return null;
    taperRef.current ??= createTaperPainter(group, cut);
    return taperRef.current;
  }

  function reveal() {
    const pageDrawn = pageDrawnLength(
      groupRectsRef.current,
      rangesRef.current,
      viewportHeightRef.current,
    );
    if (reducedMotion()) {
      clearPieceDashes(pathsRef.current);
      taper()?.paint(Number.POSITIVE_INFINITY);
    } else {
      const drawn = ratchetRef.current.advance(pageDrawn);
      applyPieceDashes(pathsRef.current, piecesRef.current, drawn);
      head()?.paint(drawn, chainRef.current, headOptions());
      const last = piecesRef.current[piecesRef.current.length - 1];
      if (last !== undefined) taper()?.paint(paintedLength(drawn, last));
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
    chainRef.current = pieces;
    firstPieceRef.current = range.start;
    head()?.reset();
    const closingPiece = wishesPieces[wishesPieces.length - 1];
    const closingLength =
      closingPiece === undefined ? 0 : closingPiece.end - closingPiece.start;
    taper()?.set(
      closingPiece === undefined
        ? undefined
        : {
            d: wishesSubpaths[wishesSubpaths.length - 1],
            length: closingLength,
            endAt: closingLength,
            direction: 1,
          },
      taperOptions(),
    );

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
        <TaperCutMask cutRef={cutRef} id={`thread-taper-cut-${slot}`} />
        {Array.from({ length: WISHES_PIECE_COUNT }, (_, index) => (
          <ThreadInk
            cutId={
              index === WISHES_PIECE_COUNT - 1
                ? `thread-taper-cut-${slot}`
                : undefined
            }
            index={index}
            // biome-ignore lint/suspicious/noArrayIndexKey: WISHES_PIECE_COUNT is a fixed structural constant -- these never reorder or change count.
            key={index}
            pathRef={(el) => {
              pathsRef.current[index] = el;
            }}
          />
        ))}
        <g className={styles.pageTaper} ref={taperGroupRef} />
        <g className={styles.pageHead} ref={headGroupRef} />
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
