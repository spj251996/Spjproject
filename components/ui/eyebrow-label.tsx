import type { ReactNode } from "react";

/* DESIGN.md → Components → UI → `eyebrow-label`.

   The `onContrast` prop is gone: it existed only to pick between two gold tokens, and there is now
   one gold that does not vary by ground. DESIGN.md → Foundations → Colors states the eyebrow is
   always gold and never ink, so this component takes no color decision at all. */

interface EyebrowLabelProps {
  children: ReactNode;
  className?: string;
}

export function EyebrowLabel({ children, className }: EyebrowLabelProps) {
  return (
    <p className={`type-eyebrow text-accent-gold ${className ?? ""}`}>
      {children}
    </p>
  );
}
