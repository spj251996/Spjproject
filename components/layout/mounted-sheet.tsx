import type { ReactNode } from "react";
import type { MeasuredFit } from "./mounted-sheet-frame";
import {
  FRAME_CLASS,
  frameScopeClass,
  mountedSheetFrameCss,
  tallFrameCss,
  tallScopeClass,
} from "./mounted-sheet-frame-css";

/* With a fit, the generated stylesheet sets every frame step; without one, the static card is for a
   surface with no window to fit — a specimen box. A long scrolling section takes `tall` instead,
   which keeps the frame but drops every height threshold.

   Two contracts bind a framed card's caller:
   - No horizontal padding, margin or width cap around the frame: its ground is decided against the
     window's width.
   - The frame's unlayered sheet rules set `display`, `flex-direction`, `flex`, `justify-content`,
     `align-items` and `padding`, so a `className` utility for any of them is discarded.

   The reveal uses spacing utilities directly: `{reveal.*}` only aliases spacing steps, so it has no
   tokens of its own.

   `contrast` rebinds `--focus-ring-color` on its subtree, which the global `:focus-visible` rule
   reads. */

type Stock = "paper" | "contrast";

interface MountedSheetProps {
  children: ReactNode;
  stock?: Stock;
  hero?: boolean;
  fit?: MeasuredFit;
  tall?: boolean;
  className?: string;
}

/* The mount's cast depends on the stock it carries: against an ivory ground the ivory mount reads
   as page under the green stock, so that one is lifted with a deeper shadow rather than a second
   mount colour. */
const MOUNT_SHADOW: Record<Stock, string> = {
  paper: "shadow-mount",
  contrast: "shadow-mount-contrast",
};

/* Unmounted is the base, so a non-hero section never paints a mount and then loses it. */
const MOUNT_REVEAL = {
  hero: "bg-surface-mount p-space-xs xl:p-space-sm",
  section: "bg-transparent p-0 md:bg-surface-mount md:p-space-xs xl:p-space-sm",
} as const;

const SHEET_PADDING = "p-space-lg md:p-space-2xl lg:p-space-3xl";

const SHEET: Record<Stock, string> = {
  paper: "bg-surface-elevated shadow-sheet",
  contrast:
    "bg-surface-contrast text-ink-on-contrast shadow-sheet-contrast [--focus-ring-color:var(--focus-ring-color-on-contrast)]",
};

export function MountedSheet({
  children,
  stock = "paper",
  hero = false,
  fit,
  tall = false,
  className,
}: MountedSheetProps) {
  if (tall) {
    if (fit !== undefined) {
      throw new Error(
        "mounted-sheet: a tall card takes no measured fit. The fitted frame is defined only for a card that fits its tier's height cap; a tall section is taller than every window.",
      );
    }
    /* The frame's stylesheet sets the reveal and padding and removes the mount's fill where it does
       not show, so neither element carries a padding utility. */
    return (
      <>
        <style>{tallFrameCss(hero)}</style>
        <div className={tallScopeClass(hero)}>
          <div className={FRAME_CLASS.box}>
            <div
              className={`${FRAME_CLASS.mount} ${MOUNT_SHADOW[stock]} bg-surface-mount`}
            >
              <div
                className={`${FRAME_CLASS.sheet} ${SHEET[stock]} ${className ?? ""}`}
              >
                {children}
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (fit !== undefined) {
    /* The frame's stylesheet sets the reveal and padding and removes the mount's fill where it does
       not show, so neither element carries a padding utility. */
    return (
      <>
        <style>{mountedSheetFrameCss(fit, hero)}</style>
        <div className={frameScopeClass(fit)}>
          <div className={FRAME_CLASS.box}>
            <div
              className={`${FRAME_CLASS.mount} ${MOUNT_SHADOW[stock]} bg-surface-mount`}
            >
              <div
                className={`${FRAME_CLASS.sheet} ${SHEET[stock]} ${className ?? ""}`}
              >
                {children}
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <div
      className={`${MOUNT_SHADOW[stock]} ${hero ? MOUNT_REVEAL.hero : MOUNT_REVEAL.section}`}
    >
      <div className={`${SHEET[stock]} ${SHEET_PADDING} ${className ?? ""}`}>
        {children}
      </div>
    </div>
  );
}
