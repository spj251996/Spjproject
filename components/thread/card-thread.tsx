"use client";

import { useEffect, useRef } from "react";
import styles from "./thread.module.css";
import { THREAD_BANDS } from "./thread-bands";
import { createCatchUp } from "./thread-catch-up";
import { paintedLength } from "./thread-head";
import { CARD_CUT_ID, TaperCutMask, ThreadInk } from "./thread-ink";
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
  measureSections,
  measureSubdivisions,
  pageDrawnLength,
  rectRelativeTo,
  reducedMotion,
  useLayoutTriggers,
} from "./thread-measure";
import {
  applyPieceDashes,
  cardRetraces,
  clearPieceDashes,
  createHeadPainter,
  createRetracePainter,
  createTaperPainter,
  type HeadPainter,
  type RetracePainter,
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
  headOptions,
  readTerminalWindow,
  taperOptions,
  tokenTime,
} from "./thread-tokens";

/* ---------------------------------------------------------------------------------------------
   THE CARD THREAD — a stretch of the thread drawn INSIDE a card's own stacking context, so it paints
   by document order within the card: over the siblings before it, behind those after it.
   `PageThread`'s trunk paints at `{z.thread}` (40), above every card's `{z.content}` (20), so any
   stretch that must pass behind type has to be drawn in the card. Wishes is the first and so far only place that need arose; the piece range below is this
   component's one Wishes-bound part, and Phase 6b's redraw is the trigger to generalise it.

   It mounts once, after the couple illustration and before the names (`app/_sections/wishes.tsx`). It measures
   independently of `PageThread` -- wishes' own subpath never depends on
   family's anchors (celebrations sits between them, and the boundary-snap in `thread-line.ts` only
   ever copies an ADJACENT section's own endpoint), so this needs no state shared with `PageThread`,
   only the same pure functions. The reveal, though, must stay in step with the whole page's
   progress, not restart at wishes' own arc-length 0: `chainRef` is the whole page's pieces,
   `firstPieceRef` is where wishes' own begin in it, and their `start`/`end` are on the page's own
   cumulative scale. */

/* `wishes`' own piece count -- 3: a connector, its one motif `bow`, and the trailing connector every
   section ends with -- band-invariant for the same reason as `MAIN_PIECE_COUNT`
   (`page-thread.tsx`). */
const WISHES_PIECE_COUNT = Math.max(
  ...THREAD_BANDS.map((band) => {
    const range = subpathRange(band.id, "wishes");
    return range.end - range.start;
  }),
);

export function CardThread() {
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  /* One entry per `wishes` piece (`WISHES_PIECE_COUNT`, fixed) -- same per-piece shape as
     `PageThread`'s `pathsRef`/`piecesRef` (`page-thread.tsx`), for the same reason: `wishes` is
     not exempt from the one-dash-per-subpath finding just because it draws through its own card
     root rather than `PageThread`'s trunk. */
  const pathsRef = useRef<(SVGPathElement | null)[]>([]);
  const piecesRef = useRef<readonly ThreadPiece[]>([]);
  /* The head's chain is the whole page's, and `firstPieceRef` is where this component's own pieces
     begin in it -- it draws the share of the head that lies in its own pieces, from the same drawn
     length the trunk uses, so the head crosses the join unbroken. Its `viewBox` is
     the card's rect in `<main>` coordinates and its box is that same rect, so its user space is
     1:1 with page pixels and the head's widths need no correction. */
  const chainRef = useRef<readonly ThreadPiece[]>([]);
  const firstPieceRef = useRef(0);
  const headGroupRef = useRef<SVGGElement>(null);
  const headRef = useRef<HeadPainter | null>(null);
  const taperGroupRef = useRef<SVGGElement>(null);
  const cutRef = useRef<SVGPathElement>(null);
  const taperRef = useRef<TaperPainter | null>(null);
  const retraceGroupRef = useRef<SVGGElement>(null);
  const retraceGlowRef = useRef<SVGGElement>(null);
  const retraceRef = useRef<RetracePainter | null>(null);
  /* The head's and the re-trace's painters share what they sample, as the trunk's do. */
  const samplesRef = useRef(new Map<number, PieceSamples>());
  /* Same three inputs `PageThread` keeps, captured at the same layout instant as its own copy --
     `CardThread` measures independently (see the header comment), so it keeps its own.
     `groupRectsRef` is `threadLine`'s own per-GROUP rects, exactly like `PageThread`'s -- `wishes`
     itself never splits, but the CHAIN leading up to it (through `celebrations`'s own groups) must
     be built from the SAME measured subdivisions `PageThread` uses, or the two components would hand
     `wishes` two different answers for where its own crossing predecessor left off
     (`measureSubdivisions`'s own header). */
  const groupRectsRef = useRef<readonly SectionRect[]>([]);
  const rangesRef = useRef<readonly SectionRange[]>([]);
  const viewportHeightRef = useRef(0);
  const terminalWindowRef = useRef<TerminalWindow>(CHAIN_TERMINAL_WINDOW);
  const catchUpSecondsRef = useRef(0);
  /* Wishes' own stretch stays drawn on the way back up exactly as the trunk does, and needs its own
     ratchet to do it: this component's maximum is a length along the card thread's path, which is not the
     trunk's (`PageThread`'s own `ratchetRef`). */
  const ratchetRef = useRef(createDrawRatchet());

  /* The `d` of a chain piece that lives in THIS `<svg>`, or nothing for the trunk's. */
  function pathOf(index: number): string | undefined {
    return index >= firstPieceRef.current
      ? (pathsRef.current[index - firstPieceRef.current]?.getAttribute("d") ??
          undefined)
      : undefined;
  }

  function head(): HeadPainter | null {
    const group = headGroupRef.current;
    if (group === null) return null;
    headRef.current ??= createHeadPainter(group, pathOf, samplesRef.current);
    return headRef.current;
  }

  function retrace(): RetracePainter | null {
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
  }

  function taper(): TaperPainter | null {
    const group = taperGroupRef.current;
    const cut = cutRef.current;
    if (group === null || cut === null) return null;
    taperRef.current ??= createTaperPainter(group, cut);
    return taperRef.current;
  }

  function paintCard(drawn: number) {
    applyPieceDashes(pathsRef.current, piecesRef.current, drawn);
    head()?.paint(drawn, chainRef.current, headOptions());
    const last = piecesRef.current[piecesRef.current.length - 1];
    if (last !== undefined) taper()?.paint(paintedLength(drawn, last));
  }

  const cardCatchUpRef = useRef<ReturnType<typeof createCatchUp> | null>(null);
  const cardPaintRef = useRef<(drawn: number) => void>(() => {});
  cardPaintRef.current = paintCard;
  cardCatchUpRef.current ??= createCatchUp((drawn) =>
    cardPaintRef.current(drawn),
  );

  /* A re-measure paints where the page already is, with no travel: the follower is for a reader's
     scroll, and easing a resize would animate a layout change the reader did not ask for. */
  function reveal() {
    const pageDrawn = pageDrawnLength(
      groupRectsRef.current,
      rangesRef.current,
      viewportHeightRef.current,
      terminalWindowRef.current,
    );
    if (reducedMotion()) {
      cardCatchUpRef.current?.stop();
      clearPieceDashes(pathsRef.current);
      taper()?.paint(Number.POSITIVE_INFINITY);
      return;
    }
    const drawn = ratchetRef.current.advance(pageDrawn);
    cardCatchUpRef.current?.seen(drawn);
    paintCard(drawn);
  }

  function revealScrolled() {
    if (reducedMotion()) {
      clearPieceDashes(pathsRef.current);
      taper()?.paint(Number.POSITIVE_INFINITY);
      return;
    }
    cardCatchUpRef.current?.to(
      ratchetRef.current.advance(
        pageDrawnLength(
          groupRectsRef.current,
          rangesRef.current,
          viewportHeightRef.current,
          terminalWindowRef.current,
        ),
      ),
      catchUpSecondsRef.current,
    );
  }

  function measureLayout() {
    /* Read BEFORE `rangesRef.current` is overwritten below -- the ratchet's peak is a length on the
       OLD path. These are the PAGE's ranges, the same quantity `PageThread` measures: this
       component's RATCHET holds a length along this card's own stretch, but its `ranges` are the
       whole chain's (see `piecesRef`'s note below -- wishes' pieces are already on the page's global
       cumulative scale). The rebase is commensurable because both totals are read the same way. */
    const previousRanges = rangesRef.current;
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
    retrace()?.hide();
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
    terminalWindowRef.current = readTerminalWindow(viewportHeightRef.current);
    catchUpSecondsRef.current = (tokenTime("--thread-catchup") ?? 0) / 1000;
    /* Same reason as `PageThread`'s own rebase: the maximum described the path this re-measure has
       just replaced, so it is scaled between the two totals rather than discarded -- discarding it
       let a phone's URL-bar resize un-draw the card thread on the way back up. `reveal` paints from it on
       the next line. */
    ratchetRef.current.rebase(totalLength(previousRanges), totalLength(ranges));
    reveal();
  }

  /* The cheap half, as in `PageThread`: a viewport-height change moves the draw window and nothing
     else, so this re-reads the two window values and re-paints. `reveal` is already the no-travel
     painter ("a re-measure paints where the page already is" -- its own header), which is exactly
     what a URL bar moving needs; `revealScrolled` would ease it. No head reset, no re-trace stop, no
     rebase. The card thread takes no `openingFloor`: the opening sequence draws the INVITE's pieces, which
     live in `PageThread`'s `<svg>`, not this one. */
  function refreshWindow() {
    if (reducedMotion()) return;
    viewportHeightRef.current = window.innerHeight;
    terminalWindowRef.current = readTerminalWindow(viewportHeightRef.current);
    reveal();
  }

  useLayoutTriggers(measureLayout, refreshWindow);

  /* Joins the page's one re-trace loop (`cardRetraces`'s header): `PageThread` drives it, and this
     paints Wishes' stretch of it into its own `<svg>`. */
  // biome-ignore lint/correctness/useExhaustiveDependencies: bind once -- `retrace` closes over refs by their stable `.current`, not by closure value, so the first render's copy stays correct forever.
  useEffect(() => {
    const painter = retrace();
    if (painter === null) return;
    cardRetraces.add(painter);
    return () => {
      cardRetraces.delete(painter);
      painter.hide();
    };
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: bind once -- `reveal` closes over refs by their stable `.current`, not by closure value, so the first render's copy stays correct forever.
  useEffect(() => {
    let rafId: number | null = null;
    function onScroll() {
      if (rafId !== null || reducedMotion()) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        revealScrolled();
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
      data-thread-card
      ref={wrapperRef}
    >
      <svg
        className={styles.cardRoot}
        data-thread-svg="true"
        preserveAspectRatio="none"
        ref={svgRef}
        role="presentation"
      >
        <TaperCutMask cutRef={cutRef} id={CARD_CUT_ID} />
        {Array.from({ length: WISHES_PIECE_COUNT }, (_, index) => (
          <ThreadInk
            cutId={index === WISHES_PIECE_COUNT - 1 ? CARD_CUT_ID : undefined}
            index={index}
            // biome-ignore lint/suspicious/noArrayIndexKey: WISHES_PIECE_COUNT is a fixed structural constant -- these never reorder or change count.
            key={index}
            pathRef={(el) => {
              pathsRef.current[index] = el;
            }}
          />
        ))}
        <g className={styles.pageTaper} data-thread-taper ref={taperGroupRef} />
        <g className={styles.pageRetraceGlow} ref={retraceGlowRef} />
        <g className={styles.pageRetrace} ref={retraceGroupRef} />
        <g className={styles.pageHead} data-thread-head ref={headGroupRef} />
      </svg>
    </span>
  );
}
