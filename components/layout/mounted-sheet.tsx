import type { ReactNode } from "react";

/* DESIGN.md → Foundations → Layout → `mounted-sheet`.

   Two elements because there are two sheets: the mount, and the stock laid onto it. No state, no
   effects, no handlers, so no client boundary.

   The mount keeps `shadow-mount` at every width even where it loses its fill and reveal. Below the
   md breakpoint a non-hero section has no mount, but the sheet still has to lift off the ground —
   the wrapper stops being a visible mount and goes on casting.

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
  /* The opening section is the one that keeps its mount below the md breakpoint. */
  hero?: boolean;
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
  className,
}: MountedSheetProps) {
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
