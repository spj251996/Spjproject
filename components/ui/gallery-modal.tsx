"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { GalleryModalPanel } from "./gallery-modal-panel";

/* DESIGN.md → Components → UI → `gallery-modal`.

   Client boundary, and what forces it: focus management, keyboard dismissal, a scroll lock, and
   swipe navigation — four behaviors that need the browser at runtime. The visual surface is split
   out into `gallery-modal-panel`; everything here is side-effect.

   Not a native `<dialog>`: the doc places the modal on `{z-index.modal}` in an explicit layer table
   and requires simple stacking contexts, while `<dialog>`'s top layer sits outside the z-index
   system entirely. Native semantics were rejected on that constraint, so the dialog role and every
   attribute its pattern requires are declared explicitly.

   Scroll lock is capture-and-replay, not `overflow: hidden`: hiding overflow discards the scroll
   offset on some platforms, which is exactly the outcome "closing returns the page to the same
   scroll position" forbids.

   Effect split is deliberate. `onClose` is read through a ref because a caller writing the idiomatic
   inline arrow passes a fresh reference on every parent render; focus acquisition and the scroll
   lock are mount-scoped and must run exactly twice, so they never share an effect with the key
   listener, which legitimately re-creates when `step` changes.

   No motion is attached here, so there is no reduced-motion gate to discharge: the reveal the doc
   assigns the modal ({motion.duration.base}) belongs to the composing section's open/close
   transition, and the active-image scroll uses the instant default. */

const SWIPE_THRESHOLD_PX = 40;

const FOCUSABLE =
  'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

interface GalleryModalProps {
  title: string;
  images: string[];
  onClose: () => void;
}

export function GalleryModal({ title, images, onClose }: GalleryModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const touchStartXRef = useRef<number | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const titleId = useId();
  const count = images.length;

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  const step = useCallback(
    (delta: number) => {
      if (count === 0) {
        return;
      }
      setActiveIndex((current) =>
        Math.min(count - 1, Math.max(0, current + delta)),
      );
    },
    [count],
  );

  /* Mount-scoped: focus acquisition, scroll capture, and their exact inverses on release. */
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

    return () => {
      body.style.position = previous.position;
      body.style.top = previous.top;
      body.style.width = previous.width;
      window.scrollTo(0, scrollY);
      if (previouslyFocused instanceof HTMLElement) {
        previouslyFocused.focus();
      }
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key === "ArrowRight") {
        step(1);
        return;
      }
      if (event.key === "ArrowLeft") {
        step(-1);
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
  }, [step]);

  useEffect(() => {
    containerRef.current
      ?.querySelector(`[data-gallery-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  return (
    <div
      aria-labelledby={titleId}
      aria-modal="true"
      className="fixed inset-0 z-(--z-modal)"
      onTouchEnd={(event) => {
        const startX = touchStartXRef.current;
        touchStartXRef.current = null;
        const endX = event.changedTouches[0]?.clientX;
        if (startX === null || endX === undefined) {
          return;
        }
        const delta = endX - startX;
        if (Math.abs(delta) < SWIPE_THRESHOLD_PX) {
          return;
        }
        step(delta < 0 ? 1 : -1);
      }}
      onTouchStart={(event) => {
        touchStartXRef.current = event.changedTouches[0]?.clientX ?? null;
      }}
      ref={containerRef}
      role="dialog"
      tabIndex={-1}
    >
      <GalleryModalPanel
        activeIndex={activeIndex}
        images={images}
        onClose={onClose}
        title={title}
        titleId={titleId}
      />
    </div>
  );
}
