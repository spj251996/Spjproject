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
  hero: "p-space-sm md:p-space-xs lg:p-space-sm xl:p-space-md",
  section: "p-0 md:p-space-xs lg:p-space-sm xl:p-space-md",
} as const;

/* The ladder's FILL, split out from its padding so the two can be gated separately. They were one
   string until 2026-10-05, which meant an unpainted card still painted: the prop gated the paint
   constants while the reveal went on supplying `bg-surface-mount` underneath, and the unfitted branch
   rendered an unpainted hero as a solid tan block. The padding above is geometry and is never gated;
   this is paint and always is. The section's `bg-transparent` below `{breakpoints.md}` is what keeps
   a non-hero card bare where it shows no mount. The hero has no rung here: it paints nothing. */
const MOUNT_REVEAL_FILL = {
  section: "bg-transparent md:bg-surface-mount",
} as const;

const SHEET_PADDING = "p-space-lg md:p-space-2xl lg:p-space-3xl";

/* The mount keeps `{rounded.card}` where it reveals a mat and where it hugs the stock with none,
   because it casts the shadow either way and the cast takes the shape of the box it leaves. */
const CARD_CORNERS = "rounded-card";

const SHEET = "bg-surface-elevated shadow-stock";

/* A card's paint follows its ROLE (owner, 2026-10-14 — DESIGN.md → Foundations → Layout →
   `mounted-sheet` → The card's two states): the hero is unpainted, every other framed card mounted.

   Only the PAINT differs: the frame's geometry is identical either way, because the invite's height
   contract and the thread's measured card box (`page-thread.tsx`'s `measureSections`) both ride on
   the box staying exactly where it was measured. The generated stylesheet needs no matching change —
   `mountRules` only ever strips a fill where the mount does not show, so with the utility absent that
   rule is a no-op.

   Hoisted into constants so a framed branch never names a paint utility inline, where the role could
   not gate it. */
type CardRole = "hero" | "section";

/* An EMPTY arm must stay exactly empty, and that is load-bearing rather than tidy: an empty
   interpolation emits the same string the retired `unbacked ? "" : …` ternary did, which is how the
   built markup came back byte-identical across both migrations -- `mounted-sheet-frame__mount ` keeps
   its trailing space and `mounted-sheet-frame__sheet  invite-settle` its double space. Collapsing that
   whitespace would be a visual no-op and would break the one proof the migrations rest on. */
const MOUNT_PAINT: Record<CardRole, string> = {
  hero: "",
  section: `${MOUNT_SHADOW} ${CARD_CORNERS} bg-surface-mount`,
};

const SHEET_PAINT: Record<CardRole, string> = {
  hero: "",
  section: `${SHEET} ${CARD_CORNERS}`,
};

/* The unfitted branch takes its section fill from the reveal ladder rather than from `MOUNT_PAINT`,
   because a non-hero specimen is deliberately bare below `{breakpoints.md}` and only the ladder knows
   that. Using `MOUNT_PAINT` here would fold an unconditional `bg-surface-mount` into a branch that
   never had one, painting mount grain under a card the ladder means to leave transparent. */
const UNFITTED_MOUNT_PAINT: Record<CardRole, string> = {
  hero: "",
  section: `${MOUNT_SHADOW} ${CARD_CORNERS} ${MOUNT_REVEAL_FILL.section}`,
};

export function MountedSheet({
  children,
  hero = false,
  fit,
  tall = false,
  className,
}: MountedSheetProps) {
  if (hero && tall) {
    throw new Error(
      "mounted-sheet: a hero card is the opening screen and fits its tier's height cap; a tall card scrolls past every window, so passing both is a mistake rather than a configuration.",
    );
  }
  const role: CardRole = hero ? "hero" : "section";

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
        <style>{tallFrameCss()}</style>
        <div className={tallScopeClass()}>
          <div className={FRAME_CLASS.box}>
            <div className={`${FRAME_CLASS.mount} ${MOUNT_PAINT[role]}`}>
              <div
                className={`${FRAME_CLASS.sheet} ${SHEET_PAINT[role]} ${className ?? ""}`}
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
        <style>{mountedSheetFrameCss(fit, hero, "single")}</style>
        <div className={frameScopeClass(fit)}>
          <div className={FRAME_CLASS.box}>
            <div className={`${FRAME_CLASS.mount} ${MOUNT_PAINT[role]}`}>
              <div
                className={`${FRAME_CLASS.sheet} ${SHEET_PAINT[role]} ${className ?? ""}`}
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
      className={`${UNFITTED_MOUNT_PAINT[role]} ${hero ? MOUNT_REVEAL.hero : MOUNT_REVEAL.section}`}
    >
      <div
        className={`${SHEET_PAINT[role]} ${SHEET_PADDING} ${className ?? ""}`}
      >
        {children}
      </div>
    </div>
  );
}
