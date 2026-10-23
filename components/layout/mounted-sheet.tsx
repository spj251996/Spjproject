import type { ReactNode } from "react";
import type { MeasuredFit } from "./mounted-sheet-frame";
import {
  FRAME_CLASS,
  frameScopeClass,
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
   `{breakpoints.md}` to reveal one on. On a fitted card the hero's rungs come from here rather than
   from the generated stylesheet. */
const MOUNT_REVEAL = {
  hero: "p-space-sm md:p-space-xs lg:p-space-sm xl:p-space-md",
  section: "p-0 md:p-space-xs lg:p-space-sm xl:p-space-md",
} as const;

/* The ladder's FILL, split out from its padding so the two can be gated separately. Padding is
   geometry and is never gated; paint always is. The section's `bg-transparent` below `{breakpoints.md}` is what keeps
   a non-hero card bare where it shows no mount. The hero has no rung here: it paints nothing. */
const MOUNT_REVEAL_FILL = {
  section: "bg-transparent md:bg-surface-mount",
} as const;

const SHEET_PADDING = "p-space-lg md:p-space-2xl lg:p-space-3xl";

/* The mount keeps `{rounded.card}` where it reveals a mat and where it hugs the stock with none,
   because it casts the shadow either way and the cast takes the shape of the box it leaves. */
const CARD_CORNERS = "rounded-card";

const SHEET = "bg-surface-elevated shadow-stock";

/* A card's paint follows its ROLE (DESIGN.md → Foundations → Layout →
   `mounted-sheet` → The card's two states): the hero is unpainted, every other framed card mounted.

   Only the PAINT differs: the frame's geometry is identical either way, because the invite's height
   contract and the thread's measured card box (`page-thread.tsx`'s `measureSections`) both ride on
   the box staying exactly where it was measured. The hero's reveal is the one piece of
   geometry this file carries for a fitted card: the generator emits no mount rule for the hero, so the
   fitted branch gives its mount `MOUNT_REVEAL.hero`, held equal to `revealFor` by a test.

   Hoisted into constants so a framed branch never names a paint utility inline, where the role could
   not gate it. */
type CardRole = "hero" | "section";

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
    /* The section's generated sheet (`app/_frame/sheets/`, imported by the section) sets the reveal and
       padding and removes the mount's fill where it does not show, so neither element carries a
       padding utility. */
    return (
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
    );
  }

  if (fit !== undefined) {
    /* The section's generated sheet (`app/_frame/sheets/`, imported by the section) sets the sheet's
       padding and a section's reveal, stripping its fill where it does not show. The hero's reveal
       is the ladder on its mount instead: the sheet is unlayered, so a rule there would beat the
       ladder's utilities. */
    return (
      <div className={frameScopeClass(fit)}>
        <div className={FRAME_CLASS.box}>
          <div
            className={[
              FRAME_CLASS.mount,
              MOUNT_PAINT[role],
              hero ? MOUNT_REVEAL.hero : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <div
              className={`${FRAME_CLASS.sheet} ${SHEET_PAINT[role]} ${className ?? ""}`}
            >
              {children}
            </div>
          </div>
        </div>
      </div>
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
