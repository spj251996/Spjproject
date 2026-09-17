"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { GalleryModalPanel } from "./gallery-modal-panel";

/* Not a native `<dialog>`: its top layer sits outside the z-index scale, so the dialog role and its
   attributes are declared by hand.

   The scroll lock captures and replays the offset rather than using `overflow: hidden`, which
   discards the offset on some platforms.

   `onClose` is read through a ref because an inline arrow is a fresh reference on every parent
   render. Focus and scroll lock are mount-scoped, so they never share an effect with the key
   listener, which re-creates when `step` changes. */

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
