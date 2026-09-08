import type { ReactNode } from "react";

/* DESIGN.md → Components → UI → `eyebrow-label`.

   The two grounds the doc names are the ivory base and the deep-green contrast section; `onContrast`
   selects between the two gold tokens rather than letting a caller pass a color. */

interface EyebrowLabelProps {
  children: ReactNode;
  onContrast?: boolean;
  className?: string;
}

export function EyebrowLabel({
  children,
  onContrast = false,
  className,
}: EyebrowLabelProps) {
  return (
    <p
      className={`type-eyebrow ${onContrast ? "text-accent-gold" : "text-accent-gold-on-base"} ${className ?? ""}`}
    >
      {children}
    </p>
  );
}
