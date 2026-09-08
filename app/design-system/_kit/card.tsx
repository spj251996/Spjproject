import type { ReactNode } from "react";

/* curate-gallery scaffold kit — Card (skill → references/scaffold-kit.md → catalog).

   Deferred by G3 because no sanctioned use existed then; built here for the one that does —
   `eyebrow-label` documents two grounds, and rendering the gold that belongs on the deep-green
   contrast section requires a painted panel. Hand-rolling that panel is the dogfood violation the
   primitive exists to prevent.

   P2, resolved from DESIGN.md rather than the skill's portfolio token names. Card's law is that it
   adopts the project's existing card treatment; this project's only stated card level is elevated
   paper (`event-card`), which is a meaning-bearing raise, so a neutral demo well may not borrow it.
   It takes the deep-well fallback instead — the deepest surface plus the documented divider, which
   is this system's only stated hairline — matching ChromeFrame so a well and a frame read as
   siblings. Padding is the project's own container padding (`event-card` uses the same step); radius
   is omitted rather than invented, again matching ChromeFrame. */

interface CardProps {
  /** Token name or slug shown below the box. */
  label?: string;
  /** Merged into the inner box — the slot a ground override uses. */
  className?: string;
  children: ReactNode;
}

export function Card({ label, className, children }: CardProps) {
  return (
    <div className="flex flex-col gap-space-2xs">
      <div
        className={`flex min-h-space-3xl items-center justify-center border-(length:--stroke-divider) border-accent-gold-on-base bg-surface-base p-space-md ${className ?? ""}`}
      >
        {children}
      </div>

      {label === undefined ? null : (
        <span className="type-body text-accent-gold-on-base">{label}</span>
      )}
    </div>
  );
}
