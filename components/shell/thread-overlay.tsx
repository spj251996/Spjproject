import { type CSSProperties, useId } from "react";
import styles from "./thread-overlay.module.css";

/* DESIGN.md → Components → Shell → `thread-overlay`.

   Server-rendered, no JavaScript: the reveal, the reduced-motion gate and the resting state are all
   declared in thread-overlay.module.css, which carries the reasoning for both mechanism choices.

   PROVISIONAL GEOMETRY. DESIGN.md states that paths are predefined per layout system and that the
   timeline spine is generated to fit measured node positions, but supplies no path data for either.
   The two curves below are stand-ins with the documented shape only — one continuous line entering
   the top edge and leaving the bottom edge — and are not transcribed from the doc. They are placed
   here so the component renders; they are expected to be replaced once layouts are settled.

   The breakpoint switch is expressed as framework `lg:` variants rather than a media query in the
   stylesheet, because a media query cannot read `{breakpoints.lg}` as a token and would have to
   restate its value. Stroke width rides the same variants for the same reason.

   Both curves share one reveal mask, but the mask id is per-instance: ids are document-scoped, so
   two overlays posed at different progress values would otherwise both resolve to the first mask. */

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
        className={`${styles.path} stroke-(length:--stroke-thread-mobile) lg:hidden`}
        d={MOBILE_PATH}
        mask={`url(#${maskId})`}
        vectorEffect="non-scaling-stroke"
      />
      <path
        className={`${styles.path} hidden stroke-(length:--stroke-thread-desktop) lg:inline`}
        d={DESKTOP_PATH}
        mask={`url(#${maskId})`}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
