import type { ReactNode } from "react";
import type { FramePaint, MeasuredFit } from "./mounted-sheet-frame";
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
  /** Which of the card's three paints to apply. `"mount"` is today's painted card and the default
      every framed section takes. `"none"` is the hero's unpainted option, which the invitation takes:
      no mount fill, no stock fill, no shadow, no corners. `"stock"` is the thread lab's mountless
      stock, where this element carries the stock surface and both shadows. Geometry is unchanged in
      all three (DESIGN.md -> Technical Conventions -> Variant Routes). */
  paint?: FramePaint;
}

const MOUNT_SHADOW = "shadow-mount";

/* Unmounted is the base, so a non-hero section never paints a mount and then loses it. The reveal
   ladder's four rungs, in `{spacing.*}` utilities: `{reveal.base}` · `{reveal.md}` · `{reveal.lg}` ·
   `{reveal.xl}`. Only the hero reaches the first — an ordinary section has no mount below
   `{breakpoints.md}` to reveal one on. */
const MOUNT_REVEAL = {
  hero: "p-space-sm md:p-space-xs lg:p-space-sm xl:p-space-md",
  section: "p-0 md:p-space-xs lg:p-space-sm xl:p-space-md",
} as const;

/* The ladder's FILL, split out from its padding so the two can be gated separately. They were one
   string until 2026-10-05, which meant an unpainted card still painted: the prop gated the paint
   constants while the reveal went on supplying `bg-surface-mount` underneath, and the unfitted branch
   rendered an unpainted hero as a solid tan block. The padding above is geometry and is never gated;
   this is paint and always is. The section's `bg-transparent` below `{breakpoints.md}` is what keeps
   a non-hero card bare where it shows no mount. */
const MOUNT_REVEAL_FILL = {
  hero: "bg-surface-mount",
  section: "bg-transparent md:bg-surface-mount",
} as const;

const SHEET_PADDING = "p-space-lg md:p-space-2xl lg:p-space-3xl";

/* The mount keeps `{rounded.card}` where it reveals a mat and where it hugs the stock with none,
   because it casts the shadow either way and the cast takes the shape of the box it leaves. */
const CARD_CORNERS = "rounded-card";

const SHEET = "bg-surface-elevated shadow-stock";

/* The hero card has two options, painted and unpainted, and the invitation currently takes the
   unpainted one (owner, 2026-10-05 — DESIGN.md → Foundations → Layout → `mounted-sheet` → The hero
   card's two options, which also carries the one-word restoration).

   Only the PAINT differs: the frame's geometry is identical either way, because the invite's height
   contract and the thread's measured card box (`page-thread.tsx`'s `measureSections`) both ride on
   the box staying exactly where it was measured. The generated stylesheet needs no matching change —
   `mountRules` only ever strips a fill where the mount does not show, so with the utility absent that
   rule is a no-op.

   Hoisted into constants so a framed branch never names a paint utility inline, where the paint prop
   could not gate it. `MOUNT_REVEAL` keeps its own `bg-surface-mount`: that is the unfitted path's
   reveal ladder, not the fitted card's paint. */
const MOUNT_PAINT: Record<FramePaint, string> = {
  mount: `${MOUNT_SHADOW} ${CARD_CORNERS} bg-surface-mount`,
  stock: "",
  none: "",
};

const SHEET_PAINT: Record<FramePaint, string> = {
  mount: `${SHEET} ${CARD_CORNERS}`,
  stock: "",
  none: "",
};

/* The unfitted branch takes its fill from the reveal ladder rather than from `MOUNT_PAINT`, because
   a non-hero specimen is deliberately bare below `{breakpoints.md}` and only the ladder knows that.
   Using `MOUNT_PAINT` here would fold an unconditional `bg-surface-mount` into a branch that never
   had one, painting mount grain under a card the ladder means to leave transparent. */
/* Two FLAT records rather than one keyed by hero/section, so every arm sits directly under a
   `Record<FramePaint, string>` header -- which is what the test's parser walks. A nested record would
   leave both inner arm sets invisible to it, and a guard that skips what it cannot parse reads exactly
   like a guard that passes. */
const UNFITTED_HERO_PAINT: Record<FramePaint, string> = {
  mount: `${MOUNT_SHADOW} ${CARD_CORNERS} ${MOUNT_REVEAL_FILL.hero}`,
  stock: "",
  none: "",
};

const UNFITTED_SECTION_PAINT: Record<FramePaint, string> = {
  mount: `${MOUNT_SHADOW} ${CARD_CORNERS} ${MOUNT_REVEAL_FILL.section}`,
  stock: "",
  none: "",
};

export function MountedSheet({
  children,
  hero = false,
  fit,
  tall = false,
  className,
  paint = "mount",
}: MountedSheetProps) {
  if (paint === "none" && tall) {
    throw new Error(
      'mounted-sheet: `paint="none"` selects the unpainted option for a card that fits its tier\'s height cap; a tall section has never wanted one, so passing both is a mistake rather than a configuration.',
    );
  }

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
            <div className={`${FRAME_CLASS.mount} ${MOUNT_PAINT[paint]}`}>
              <div
                className={`${FRAME_CLASS.sheet} ${SHEET_PAINT[paint]} ${className ?? ""}`}
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
            <div className={`${FRAME_CLASS.mount} ${MOUNT_PAINT[paint]}`}>
              <div
                className={`${FRAME_CLASS.sheet} ${SHEET_PAINT[paint]} ${className ?? ""}`}
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
      className={`${(hero ? UNFITTED_HERO_PAINT : UNFITTED_SECTION_PAINT)[paint]} ${hero ? MOUNT_REVEAL.hero : MOUNT_REVEAL.section}`}
    >
      <div
        className={`${SHEET_PAINT[paint]} ${SHEET_PADDING} ${className ?? ""}`}
      >
        {children}
      </div>
    </div>
  );
}
