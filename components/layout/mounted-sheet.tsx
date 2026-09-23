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
   tokens of its own. */

interface MountedSheetProps {
  children: ReactNode;
  hero?: boolean;
  fit?: MeasuredFit;
  tall?: boolean;
  className?: string;
}

const MOUNT_SHADOW = "shadow-mount";

/* Unmounted is the base, so a non-hero section never paints a mount and then loses it. The reveal
   ladder's four rungs, in `{spacing.*}` utilities: `{reveal.base}` · `{reveal.md}` · `{reveal.lg}` ·
   `{reveal.xl}`. Only the hero reaches the first — an ordinary section has no mount below
   `{breakpoints.md}` to reveal one on. */
const MOUNT_REVEAL = {
  hero: "bg-surface-mount p-space-sm md:p-space-xs lg:p-space-sm xl:p-space-md",
  section:
    "bg-transparent p-0 md:bg-surface-mount md:p-space-xs lg:p-space-sm xl:p-space-md",
} as const;

const SHEET_PADDING = "p-space-lg md:p-space-2xl lg:p-space-3xl";

/* The mount keeps `{rounded.card}` where it reveals a mat and where it hugs the stock with none,
   because it casts the shadow either way and the cast takes the shape of the box it leaves. */
const CARD_CORNERS = "rounded-card";

const SHEET = "bg-surface-elevated shadow-sheet";

export function MountedSheet({
  children,
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
              className={`${FRAME_CLASS.mount} ${MOUNT_SHADOW} ${CARD_CORNERS} bg-surface-mount`}
            >
              <div
                className={`${FRAME_CLASS.sheet} ${SHEET} ${CARD_CORNERS} ${className ?? ""}`}
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
              className={`${FRAME_CLASS.mount} ${MOUNT_SHADOW} ${CARD_CORNERS} bg-surface-mount`}
            >
              <div
                className={`${FRAME_CLASS.sheet} ${SHEET} ${CARD_CORNERS} ${className ?? ""}`}
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
      className={`${MOUNT_SHADOW} ${CARD_CORNERS} ${hero ? MOUNT_REVEAL.hero : MOUNT_REVEAL.section}`}
    >
      <div
        className={`${SHEET} ${SHEET_PADDING} ${CARD_CORNERS} ${className ?? ""}`}
      >
        {children}
      </div>
    </div>
  );
}
