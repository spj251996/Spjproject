import { useEffect } from "react";
import {
  authoredCard,
  familyPortraitFractions,
} from "./thread-authored-layout.ts";
import { aspectQuery, type BandId, THREAD_BANDS } from "./thread-bands.ts";
import type {
  SectionAnchors,
  SectionRange,
  SectionRect,
  SectionSubdivisions,
} from "./thread-line.ts";
import { MOTIF_PLACEMENTS, THREAD_IDS } from "./thread-paths.ts";
import { drawnLength, type TerminalWindow } from "./thread-progress.ts";
import type { MeasuredSection, Rect } from "./thread-warp.ts";

/* ---------------------------------------------------------------------------------------------
   MEASUREMENT — the real DOM, read once per layout change, never per scroll frame. */

type Point = { x: number; y: number };

export function currentBand(): BandId | undefined {
  for (const band of THREAD_BANDS) {
    if (window.matchMedia(aspectQuery(band.min, band.max)).matches) {
      return band.id;
    }
  }
  return undefined;
}

export function rectRelativeTo(rect: DOMRect, origin: DOMRect): Rect {
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
   the same layout pass; measuring both directly needs no correction off the frame's ring variables
   and does not drift if the ring padding changes. */
export function coverRect(
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

export function measureSections(
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

/* THE OWNER'S CARD/ROW SPLIT: a stacked pair is two cards, not one window,
   and a long scrolling list of ritual rows is several rows, not one. `event-info` and `family` are
   both `<MountedPair>` (`components/layout/mounted-pair.tsx`), which always renders exactly two
   `.mounted-sheet-frame__leaf` elements regardless of whether CSS currently lays them out stacked or
   side by side -- so querying that class costs nothing extra to gate on layout, and reading each
   leaf's own top tells `threadLine` which piece belongs with which card without this file ever
   asking whether the pair happens to be stacked this band. `celebrations` carries no such class (it
   is a single tall `<MountedSheet>`, not a pair), so its six ritual rows are found by
   `[data-thread-row]` -- the one attribute this task adds, on `<li>` in `CelebrationsSection`
   (`app/_sections/celebrations.tsx`), because nothing else there identifies a row. Every other section returns no
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

/* Shared by `PageThread` and `CardThread` (`useLayoutTriggers`'s own header explains why each
   measures independently) -- both must derive the SAME subdivisions from the SAME rects, or their
   two independent `threadLine` calls would chain a different `windowStart` through `celebrations`
   and hand `wishes` two disagreeing answers for where its own crossing predecessor left off. */
export function measureSubdivisions(
  sectionEls: readonly Element[],
  mainRect: DOMRect,
): SectionSubdivisions {
  const subdivisions: Partial<Record<(typeof THREAD_IDS)[number], Rect[]>> = {};
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
export function familyAnchors(
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
export function pageDrawnLength(
  groupRects: readonly SectionRect[],
  ranges: readonly SectionRange[],
  viewportHeight: number,
  terminal: TerminalWindow,
): number {
  return drawnLength(
    window.scrollY,
    viewportHeight,
    groupRects,
    ranges,
    terminal,
  );
}

/* Shared by `PageThread` and `CardThread`: bind resize/fonts/reduced-motion and hand back a cleanup.
   Scroll is wired separately by each caller because the two draw different things on scroll (the
   whole page's offset vs. wishes' own local one).

   WHY TWO CALLBACKS. A mobile URL bar collapses when the reader scrolls down and expands when they
   scroll back up, and each is a HEIGHT-ONLY resize fired DURING the scroll. Running the full
   re-measure there reset the head, stopped the re-trace and discarded the draw ratchet mid-gesture,
   which the owner saw as glitches and as the thread un-drawing itself on the way back up. A
   height-only change moves the draw WINDOW and nothing else, so it takes the cheap path.

   THE TEST IS WHETHER THE LAYOUT MOVED, NOT WHETHER THE WIDTH DID, and getting that wrong is a
   visible defect rather than a missed optimisation. The thread's `<svg>` takes its height and its
   viewBox from `main`'s MEASURED box, and the cheap path re-measures nothing — so a height change
   that genuinely reflows the page must not take it, or the svg keeps the old box over new content
   and the whole line draws at the wrong scale, with nothing re-measuring until a width change or a
   font load. Measured on the built export: a 393x852 -> 393x912 viewport change reflows `main`
   **8632 -> 9052px**, because the sections are sized in `100svh` and `svh` follows the WINDOW. A
   width-only guard let that through and left the svg at `viewBox="0 0 393 8640"` over 9052px of
   content — the tail some 412px above the page's end.
   So the cheap path is taken only when `main`'s own box is unchanged in BOTH axes. That is exactly
   the phone case it exists for: a toolbar hiding changes `window.innerHeight` while `svh` — defined
   as the SMALL viewport height — deliberately does not move, so the sections do not reflow. When a
   phone does reflow, this falls back to the debounced re-measure, which no longer discards the
   ratchet, so the owner's "and then stay drawn" survives either path.

   BOTH listeners need the guard, measured 2026-10-07 rather than assumed: that same viewport change
   fires `window.resize` once AND the `ResizeObserver` on `main` once. Width is read from
   `documentElement.clientWidth`, never `window.innerWidth` (which reports the layout viewport under
   mobile emulation and includes the scrollbar). */
export function useLayoutTriggers(
  measureLayout: () => void,
  refreshWindow: () => void,
) {
  // biome-ignore lint/correctness/useExhaustiveDependencies: bind once -- callers close over refs by their stable `.current`, not by closure value, so the first render's copies stay correct forever.
  useEffect(() => {
    let cancelled = false;
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const main = document.querySelector("main");

    /* The layout the thread was measured against, as one value, so both listeners ask one question.
       Sub-pixel jitter would route a phone to the slow path for nothing, so each axis is rounded. */
    function layoutSignature(): string {
      const box = main?.getBoundingClientRect();
      return [
        document.documentElement.clientWidth,
        Math.round(box?.width ?? 0),
        Math.round(box?.height ?? 0),
      ].join("|");
    }

    let lastLayout = "";

    /* Recorded only when the slow path actually re-measures, so an event arriving inside the
       debounce window cannot mark the new layout as already measured and then paint the cheap path
       against the old one. */
    function remeasure() {
      lastLayout = layoutSignature();
      measureLayout();
    }

    function remeasureSoon() {
      if (resizeTimer !== null) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(remeasure, 150);
    }

    /* The cheap path is NOT debounced: it is a read plus an arithmetic recompute, and delaying it by
       150ms is what a reader would see as the thread lagging their URL bar. */
    function onLayoutEvent() {
      if (layoutSignature() === lastLayout) {
        refreshWindow();
        return;
      }
      remeasureSoon();
    }

    remeasure();
    document.fonts.ready.then(() => {
      if (!cancelled) remeasure();
    });

    let resizeObserver: ResizeObserver | null = null;
    if (main !== null) {
      resizeObserver = new ResizeObserver(onLayoutEvent);
      resizeObserver.observe(main);
    }

    window.addEventListener("resize", onLayoutEvent);
    reduceMotion.addEventListener("change", remeasure);

    return () => {
      cancelled = true;
      if (resizeTimer !== null) clearTimeout(resizeTimer);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", onLayoutEvent);
      reduceMotion.removeEventListener("change", remeasure);
    };
  }, []);
}

export function reducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
