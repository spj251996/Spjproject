"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { cssTimeMs } from "./css-time";
import { GalleryModalPanel } from "./gallery-modal-panel";
import motion from "./gallery-motion.module.css";
import {
  containedRect,
  insideRect,
  isDeliberateTap,
  type Point,
} from "./gallery-pointer";
import {
  back,
  type GalleryState,
  openGallery,
  showGrid,
  stepViewer,
  tapTile,
} from "./gallery-state";
import { PhotoViewerPanel } from "./photo-viewer";

/* Not a native `<dialog>`: its top layer sits outside the z-index scale, so the dialog role and its
   attributes are declared by hand.

   Two layers — the grid and the full-screen viewer — and the history contract between them is
   `gallery-state.ts`'s: every forward step is one history entry, so the phone's back button pops one
   layer. Every close therefore goes THROUGH `history.back()` and is finished by the `popstate`
   listener, never by calling `onClose` directly — a direct close would strand the entry, and the next
   back press would land on the page doing nothing. The entries are pushed without a URL, and Next's
   router patches `pushState` to copy its own state into them, so popping between them re-renders
   nothing.

   The scroll lock captures and replays the offset rather than using `overflow: hidden`, which
   discards the offset on some platforms. The browser's own scroll restoration is held off while the
   modal is open, or a back press would restore its remembered offset on top of the captured one.

   Swipe and the arrow keys belong to the viewer; in the grid, scrolling is the only gesture.

   `onClose` and the state are read through refs because the history listener is mount-scoped.
   Focus and scroll lock are mount-scoped too, so they never share an effect with the key listener.

   Motion (`gallery-motion.module.css`): the pop that empties the history does not unmount at once —
   it starts the closing fade, and `onClose` runs when that fade ends, so the scroll lock and focus are
   released only once the gallery has gone. A timeout one beat past the fade stands in case
   `animationend` never arrives (a hidden tab), and under reduced motion there is no fade to wait
   for. While closing, every input is ignored and a further pop is not ours to handle.

   A tap on empty space goes back one layer, like Close. It must be deliberate: down AND up both on
   empty space, less than 10px apart, so a swipe that ends in the dark never closes. The photograph is
   where it is DRAWN — `object-contain` letterboxes it inside a box the save cover fills, so the box
   cannot answer "is this the photograph". The listener sits here rather than on the grid panel so
   that panel still renders from a server page. */

const SWIPE_THRESHOLD_PX = 40;

const FOCUSABLE =
  'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

interface GalleryModalProps {
  title: string;
  /** Display paths, in strip order. */
  images: string[];
  /** Display path to its viewer copy (bounded 2000×2000). */
  fulls: Record<string, string>;
  /** The photograph to open full screen, or `null` for the grid. */
  start: number | null;
  onClose: () => void;
}

export function GalleryModal({
  title,
  images,
  fulls,
  start,
  onClose,
}: GalleryModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const touchStartXRef = useRef<number | null>(null);
  /* Where a press began, kept only when it began on empty space. */
  const pressRef = useRef<Point | null>(null);
  const [state, setState] = useState<GalleryState>(() => openGallery(start));
  const stateRef = useRef(state);
  /* Survives React's development-only double mount, which would otherwise push a second entry. */
  const pushedRef = useRef(false);
  /* `history.back()` lands asynchronously, so a double tap on Close would otherwise go back twice
     and take the guest off the invitation. Cleared when the pop arrives. */
  const closingRef = useRef(false);
  /* The fade-out in progress: `closing` drives the class, the ref gates the listeners, and
     `closedRef` makes the animation end and the fallback timeout finish the close only once. */
  const [closing, setClosing] = useState(false);
  const closingPhaseRef = useRef(false);
  const closedRef = useRef(false);
  const closeTimerRef = useRef<number | undefined>(undefined);
  const finishCloseRef = useRef<() => void>(() => {});
  /* The first layer rises with the gallery; every later one only fades. */
  const [swapped, setSwapped] = useState(false);
  const [direction, setDirection] = useState<1 | -1 | 0>(0);
  const shownIndex = state.layer === "viewer" ? state.index : -1;
  const titleId = useId();
  const count = images.length;

  useEffect(() => {
    onCloseRef.current = onClose;
    stateRef.current = state;
  });

  /* Mount-scoped: focus acquisition, scroll capture, the first history entry, and their exact
     inverses on release. */
  useEffect(() => {
    const previouslyFocused = document.activeElement;
    containerRef.current?.focus();

    const body = document.body;
    const scrollY = window.scrollY;
    const previous = {
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
    };
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    const previousRestoration = history.scrollRestoration;
    history.scrollRestoration = "manual";

    if (!pushedRef.current) {
      pushedRef.current = true;
      history.pushState({ gallery: 1 }, "");
    }
    const finishClose = () => {
      if (closedRef.current) return;
      closedRef.current = true;
      onCloseRef.current();
    };
    finishCloseRef.current = finishClose;
    const onPopState = () => {
      if (closingPhaseRef.current) return;
      closingRef.current = false;
      const next = back(stateRef.current);
      if (next === null) {
        closingPhaseRef.current = true;
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          finishClose();
          return;
        }
        setClosing(true);
        const fade = cssTimeMs(
          getComputedStyle(document.documentElement).getPropertyValue(
            "--duration-base",
          ),
          400,
        );
        closeTimerRef.current = window.setTimeout(finishClose, fade + 100);
        return;
      }
      /* `showLayer`, inlined: this listener is mount-scoped and the setters are all it needs. */
      setSwapped(true);
      setDirection(0);
      setState(next);
    };
    window.addEventListener("popstate", onPopState);

    return () => {
      window.clearTimeout(closeTimerRef.current);
      window.removeEventListener("popstate", onPopState);
      body.style.position = previous.position;
      body.style.top = previous.top;
      body.style.width = previous.width;
      window.scrollTo(0, scrollY);
      history.scrollRestoration = previousRestoration;
      if (previouslyFocused instanceof HTMLElement) {
        previouslyFocused.focus();
      }
    };
  }, []);

  /* Every layer change goes through here: the new layer fades rather than rises, and a photograph
     opened fresh shows without a slide. */
  const showLayer = (next: GalleryState) => {
    setSwapped(true);
    setDirection(0);
    setState(next);
  };

  const isEmptySpace = (event: React.PointerEvent) => {
    const target = event.target as Element;
    if (target.closest("button, h2, p") !== null) return false;
    const photo = containerRef.current?.querySelector<HTMLImageElement>(
      "img[data-viewer-photo]",
    );
    if (photo == null) return true;
    const drawn = containedRect(photo.getBoundingClientRect(), {
      width: photo.naturalWidth,
      height: photo.naturalHeight,
    });
    return !insideRect({ x: event.clientX, y: event.clientY }, drawn);
  };

  const goBack = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    history.back();
  };
  const close = goBack;
  /* Only a step that actually moves sets the side to slide from: at either end the photograph stays,
     and a changed class on it would replay the slide in place. */
  const step = useCallback(
    (delta: number) => {
      const current = stateRef.current;
      const next = stepViewer(current, delta, count);
      if (
        next.layer !== "viewer" ||
        current.layer !== "viewer" ||
        next.index === current.index
      ) {
        return;
      }
      setDirection(delta > 0 ? 1 : -1);
      setState(next);
    },
    [count],
  );
  const openPhoto = (index: number) => {
    history.pushState({ gallery: 2 }, "");
    showLayer(tapTile(index));
  };
  /* From a grid-opened viewer the grid is one entry back, so going there consumes it; from a
     strip-opened viewer there is no grid entry, so the layer swaps in place and adds none. */
  const toGrid = () => {
    if (state.layer === "viewer" && state.fromGrid) {
      goBack();
      return;
    }
    showLayer(showGrid(state));
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (closingPhaseRef.current) {
        event.preventDefault();
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        if (closingRef.current) return;
        closingRef.current = true;
        history.back();
        return;
      }
      if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        if (state.layer === "viewer") {
          step(event.key === "ArrowRight" ? 1 : -1);
        }
        return;
      }
      if (event.key !== "Tab") {
        return;
      }
      const container = containerRef.current;
      if (container === null) {
        return;
      }
      const focusable = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE),
      );
      if (focusable.length === 0) {
        event.preventDefault();
        container.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === container)) {
        event.preventDefault();
        last.focus();
        return;
      }
      if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [state.layer, step]);

  /* A layer swap unmounts the control that had focus — the tapped tile, "All photos", or Next on
     reaching the last photograph — and focus falls to <body>, where the next Tab reaches the page
     behind the modal. Put it back on the dialog whenever the shown layer or photograph changes. */
  // biome-ignore lint/correctness/useExhaustiveDependencies: the layer and photograph are the TRIGGER, read from the DOM rather than the closure.
  useEffect(() => {
    const container = containerRef.current;
    if (container !== null && !container.contains(document.activeElement)) {
      container.focus();
    }
  }, [state.layer, shownIndex]);

  return (
    <div
      aria-labelledby={titleId}
      aria-modal="true"
      className={`fixed inset-0 z-(--z-modal) ${closing ? `pointer-events-none ${motion.closing}` : motion.open}`}
      onAnimationEnd={(event) => {
        if (closing && event.target === event.currentTarget) {
          finishCloseRef.current();
        }
      }}
      onTouchEnd={(event) => {
        const startX = touchStartXRef.current;
        touchStartXRef.current = null;
        const endX = event.changedTouches[0]?.clientX;
        if (
          closingPhaseRef.current ||
          state.layer !== "viewer" ||
          startX === null ||
          endX === undefined
        ) {
          return;
        }
        const delta = endX - startX;
        if (Math.abs(delta) < SWIPE_THRESHOLD_PX) {
          return;
        }
        step(delta < 0 ? 1 : -1);
      }}
      onPointerCancel={() => {
        pressRef.current = null;
      }}
      onPointerDown={(event) => {
        pressRef.current =
          event.isPrimary && isEmptySpace(event)
            ? { x: event.clientX, y: event.clientY }
            : null;
      }}
      onPointerUp={(event) => {
        const down = pressRef.current;
        pressRef.current = null;
        if (
          down !== null &&
          !closingPhaseRef.current &&
          isDeliberateTap(down, { x: event.clientX, y: event.clientY }) &&
          isEmptySpace(event)
        ) {
          goBack();
        }
      }}
      onTouchStart={(event) => {
        touchStartXRef.current = event.changedTouches[0]?.clientX ?? null;
      }}
      ref={containerRef}
      role="dialog"
      tabIndex={-1}
    >
      <div
        className={`absolute inset-0 ${swapped ? motion.fade : motion.rise}`}
        key={state.layer}
      >
        {state.layer === "viewer" ? (
          <PhotoViewerPanel
            direction={direction}
            count={count}
            index={state.index}
            onClose={close}
            onShowGrid={toGrid}
            onStep={step}
            src={fulls[images[state.index]] ?? images[state.index]}
            title={title}
            titleId={titleId}
          />
        ) : (
          <GalleryModalPanel
            images={images}
            onClose={close}
            onOpenPhoto={openPhoto}
            title={title}
            titleId={titleId}
          />
        )}
      </div>
    </div>
  );
}
