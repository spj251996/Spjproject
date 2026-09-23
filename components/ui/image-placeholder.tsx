/* Ink at 6% rather than an ivory token: the ivory tokens are too close to each other to show a held
   space, and a translucent tone reads over every surface. */

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
      className={`w-full rounded-card bg-ink/6 ${className ?? ""}`}
      style={{ aspectRatio: width / height }}
    />
  );
}
