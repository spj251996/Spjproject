import { type CSSProperties, useId } from "react";
import styles from "./thread-overlay.module.css";

/* The two paths are placeholders, not doc data.

   The breakpoint switch uses `lg:` variants rather than a media query in the stylesheet, because a
   media query cannot read `{breakpoints.lg}`. Stroke width rides the same variants for the same
   reason.

   The mask id is per instance: ids are document-scoped, so two overlays posed at different progress
   values would otherwise both resolve to the first mask. */

const MOBILE_PATH =
  "M 50 0 C 68 10 32 22 50 34 C 66 46 34 60 50 74 C 62 86 42 92 50 100";

const DESKTOP_PATH =
  "M 50 0 C 78 8 22 18 50 28 C 78 38 22 50 50 62 C 74 72 30 84 50 100";

interface ThreadOverlayProps {
  /**
   * Demo affordance. Poses the thread at a fixed draw progress (0–1) and suppresses the scroll
   * binding entirely, so a bounded gallery frame — which has no scrolling root — can show the
   * reveal. Production callers omit it.
   */
  demoProgress?: number;
  className?: string;
}

export function ThreadOverlay({ demoProgress, className }: ThreadOverlayProps) {
  const posed = demoProgress !== undefined;
  const maskId = `thread-reveal-${useId()}`;
  const posedStyle = posed
    ? ({
        "--thread-progress": String(Math.min(1, Math.max(0, demoProgress))),
      } as CSSProperties)
    : undefined;

  return (
    <svg
      aria-hidden="true"
      className={`${styles.overlay} ${className ?? ""}`}
      data-posed={posed ? "" : undefined}
      preserveAspectRatio="none"
      style={posedStyle}
      viewBox="0 0 100 100"
    >
      <mask
        height="120"
        id={maskId}
        maskUnits="userSpaceOnUse"
        width="120"
        x="-10"
        y="-10"
      >
        <rect
          className={styles.reveal}
          height="100"
          width="120"
          x="-10"
          y="0"
        />
      </mask>
      <path
        className={`${styles.path} stroke-(length:--stroke-thread) lg:hidden`}
        d={MOBILE_PATH}
        mask={`url(#${maskId})`}
        vectorEffect="non-scaling-stroke"
      />
      <path
        className={`${styles.path} hidden stroke-(length:--stroke-thread) lg:inline`}
        d={DESKTOP_PATH}
        mask={`url(#${maskId})`}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
