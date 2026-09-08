/* DESIGN.md → Components → UI → `image-placeholder`.

   Tone is inferred, not transcribed: the doc says "ivory-family tone" and names no token. The two
   ivory tokens (surface-base, surface-elevated) differ by ~1% and would be invisible as a held
   space, so the tone is derived from the nearest stated case — the elevated shadow's ink tint at
   6% (`{elevated-paper.shadow-far}` = rgba(15, 61, 46, 0.06)) — expressed as the ink token at the
   same alpha. Translucent, so it reads correctly over both ivory surfaces. */

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
