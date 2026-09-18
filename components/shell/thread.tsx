"use client";

import { useEffect, useId, useRef, useState } from "react";
import styles from "./thread.module.css";

/* A client component because the gesture is a discrete transition fired once on entry, which
   `animation-timeline: view()` cannot express: it is progress-linked, ignores duration and replays on
   re-entry. The observed element is the thread's own box, which covers its positioned parent.

   The two paths are placeholders, not doc data. They route through the section's empty bands so
   the thread never crosses a name, which is why the viewBox is the whole section. The segment is
   section-anchored because the fixed `thread-overlay` cannot anchor to page content. */

const MOBILE_PATH =
  "M 3 4 C 3 20 4 32 10 44 C 18 56 30 52 27 45 C 24 38 12 41 8 52 C 5 62 4 76 5 88 C 6 94 10 97 16 97";

const DESKTOP_PATH =
  "M 2 78 C 8 92 24 96 30 86 C 35 78 24 72 18 80 C 12 88 20 96 34 96 C 52 96 62 88 74 84 C 84 81 92 84 98 90";

interface ThreadProps {
  className?: string;
}

export function Thread({ className }: ThreadProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const activatedRef = useRef(false);
  const [activated, setActivated] = useState(false);
  const instanceId = useId();
  const mobileMaskId = `family-thread-mobile-${instanceId}`;
  const desktopMaskId = `family-thread-desktop-${instanceId}`;

  useEffect(() => {
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let observer: IntersectionObserver | null = null;

    const activate = () => {
      activatedRef.current = true;
      setActivated(true);
      observer?.disconnect();
      observer = null;
    };

    const sync = () => {
      if (activatedRef.current) {
        return;
      }
      if (motionQuery.matches) {
        /* The stylesheet already draws the thread; flipping the flag keeps the markup in step. */
        activate();
        return;
      }
      const element = svgRef.current;
      if (element === null || observer !== null) {
        return;
      }
      observer = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          activate();
        }
      });
      observer.observe(element);
    };

    sync();
    motionQuery.addEventListener("change", sync);
    return () => {
      motionQuery.removeEventListener("change", sync);
      observer?.disconnect();
    };
  }, []);

  return (
    <svg
      aria-hidden="true"
      className={`${styles.thread} ${className ?? ""}`}
      data-activated={activated}
      preserveAspectRatio="none"
      ref={svgRef}
      viewBox="0 0 100 100"
    >
      <mask
        height="120"
        id={mobileMaskId}
        maskUnits="userSpaceOnUse"
        width="120"
        x="-10"
        y="-10"
      >
        <path className={styles.reveal} d={MOBILE_PATH} pathLength="1" />
      </mask>
      <mask
        height="120"
        id={desktopMaskId}
        maskUnits="userSpaceOnUse"
        width="120"
        x="-10"
        y="-10"
      >
        <path className={styles.reveal} d={DESKTOP_PATH} pathLength="1" />
      </mask>
      <path
        className={`${styles.path} stroke-(length:--stroke-thread) lg:hidden`}
        d={MOBILE_PATH}
        mask={`url(#${mobileMaskId})`}
        vectorEffect="non-scaling-stroke"
      />
      <path
        className={`${styles.path} hidden stroke-(length:--stroke-thread) lg:inline`}
        d={DESKTOP_PATH}
        mask={`url(#${desktopMaskId})`}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
