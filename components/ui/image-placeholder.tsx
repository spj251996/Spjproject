/* DESIGN.md → Components → UI → `image-placeholder`.

   Tone is inferred, not transcribed: the doc says "ivory-family tone" and names no token. The two
   ivory tokens (surface-base, surface-elevated) differ by ~1% and would be invisible as a held
   space, so the tone is the ink token at 6% alpha. Translucent, so it reads correctly over the
   ground, the mount and both stocks.

   The derivation originally cited `{elevated-paper.shadow-far}`, a doc block retired when the
   elevation recipes were rewritten. The 6% alpha is kept because it works, not because that block
   still sanctions it — and it is recorded as inferred rather than left looking transcribed. */

interface ImagePlaceholderProps {
  /** Intrinsic width of the image being held. A ratio term, not a rendered width. */
  width: number;
  /** Intrinsic height of the image being held. */
  height: number;
  className?: string;
}

export function ImagePlaceholder({
  width,
  height,
  className,
}: ImagePlaceholderProps) {
  return (
    <div
      aria-hidden="true"
      className={`w-full bg-ink/6 ${className ?? ""}`}
      style={{ aspectRatio: width / height }}
    />
  );
}
