/* DESIGN.md → Background → Paper Base.

   The ivory fill only. The doc calls for "a static, minimal paper or satin texture" but names no
   asset, tone token, or technique for it, so none is declared here — the absence is reported rather
   than filled with an invented pattern. This element is where that texture attaches when it exists.

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
