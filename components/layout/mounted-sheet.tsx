import type { ReactNode } from "react";
import type { MeasuredFit } from "./mounted-sheet-frame";
import {
  FRAME_CLASS,
  frameScopeClass,
  mountedSheetFrameCss,
} from "./mounted-sheet-frame-css";

/* DESIGN.md → Foundations → Layout → `mounted-sheet`.

   The card is two elements because there are two sheets: the mount, and the stock laid onto it. No
   state, no effects, no handlers, so no client boundary.

   Given a section's measured fit, the card is framed to the window: a ground wrapper, a box the
   card's padding queries, the mount and the sheet, plus that section's generated stylesheet. Every
   step of the frame is in that stylesheet. The composing section supplies the `<section>` element
   and the content. Without a fit the card is the static card below, for a surface with no window to
   fit — a specimen box, or a long scrolling section.

   Two contracts bind a framed card's caller:
   - The frame must span the full viewport width, with no horizontal padding, margin or width cap
     around it, because its ground is decided against the window's width. A classic scrollbar already
     narrows it slightly — DESIGN.md → Iteration Notes → Known Gaps.
   - The frame's unlayered sheet rules set `display`, `flex-direction`, `flex`, `justify-content`,
     `align-items` and `padding`, so a `className` utility for any of them — per-side padding and
     flex grow, shrink or basis included — is discarded.

   The mount keeps `shadow-mount` at every width even where it loses its fill and reveal. A non-hero
   section has no mount below the md breakpoint unframed, or in the phone ground tier framed, but the
   sheet still has to lift off the ground — the wrapper stops being a visible mount and goes on
   casting.

   The reveal resolves at the point of use rather than through `{reveal.*}` tokens: those keys are
   aliases of `{spacing.space-sm}` and `{spacing.space-xs}`, and a token that only aliases another
   token earns nothing (foundations-mapping → Which keys become tokens).

   `contrast` establishes the deep-green ground, so it rebinds `--focus-ring-color` on its own
   subtree; the global `:focus-visible` rule reads the variable and inherits it. One rebinding, not a
   second ring definition. */

type Stock = "paper" | "contrast";

interface MountedSheetProps {
  children: ReactNode;
  stock?: Stock;
  /* The opening section is the one that keeps its mount at every width. */
  hero?: boolean;
  /* The section's measured fit, which frames the card to the window. */
  fit?: MeasuredFit;
  className?: string;
}

const MOUNT_BASE = "shadow-mount";

/* Two defaults, one per case, both correct on first paint — a non-hero section paints unmounted
   below md rather than painting a mount and losing it. */
const MOUNT_REVEAL = {
  hero: "bg-surface-mount p-space-xs lg:p-space-sm",
  section: "bg-transparent p-0 md:bg-surface-mount md:p-space-xs lg:p-space-sm",
} as const;

/* Foundations → Spacing. The sheet owns its padding rather than each caller choosing one: a
   caller-chosen constant is how the sheet came to hold 32px at every width, which overran its own
   margin at 320px. Climbs with the sheet so the margin stays near a tenth of its width. */
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
  className,
}: MountedSheetProps) {
  if (fit !== undefined) {
    /* The frame's stylesheet sets the mount's reveal and the sheet's padding, and removes the
       mount's fill where it does not show, so neither element carries a padding utility here. */
    return (
      <>
        <style>{mountedSheetFrameCss(fit, hero)}</style>
        <div className={frameScopeClass(fit)}>
          <div className={FRAME_CLASS.box}>
            <div
              className={`${FRAME_CLASS.mount} ${MOUNT_BASE} bg-surface-mount`}
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
      className={`${MOUNT_BASE} ${hero ? MOUNT_REVEAL.hero : MOUNT_REVEAL.section}`}
    >
      <div className={`${SHEET[stock]} ${SHEET_PADDING} ${className ?? ""}`}>
        {children}
      </div>
    </div>
  );
}
