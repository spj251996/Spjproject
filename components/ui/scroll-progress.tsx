"use client";

import { useEffect, useRef } from "react";
import styles from "@/components/ui/scroll-progress.module.css";
import { scrollProgress } from "@/components/ui/scroll-progress-value";

/* DESIGN.md → Components → UI → `scroll-progress`. The track is server-rendered, so with no script
   the guest still sees that the page continues; the fill is the only thing the script moves. One
   read and one write per animation frame, however many scroll events arrive. */
export function ScrollProgress() {
  const fill = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let frame = 0;
    const paint = () => {
      frame = 0;
      const value = scrollProgress(
        window.scrollY,
        document.documentElement.scrollHeight,
        window.innerHeight,
      );
      fill.current?.style.setProperty("transform", `scaleX(${value})`);
    };
    const schedule = () => {
      if (frame === 0) frame = requestAnimationFrame(paint);
    };
    paint();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div aria-hidden className={styles.track} data-scroll-progress>
      <div className={styles.fill} ref={fill} />
    </div>
  );
}
