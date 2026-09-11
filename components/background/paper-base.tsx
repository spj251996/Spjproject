/* DESIGN.md → Background → Paper Base.

   The ivory fill. Its paper grain arrives with the surface token rather than being applied here —
   anything painted as this surface is grained by being it, so this component declares no texture of
   its own (DESIGN.md → Foundations → Paper Grain).

   `app/globals.css` already paints the same token on `body`; this layer is the addressable base of
   the background subsystem the doc describes, and the overlap is reported. */

interface PaperBaseProps {
  className?: string;
}

export function PaperBase({ className }: PaperBaseProps) {
  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 z-(--z-base) bg-surface-base ${className ?? ""}`}
    />
  );
}
