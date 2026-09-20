import { ImagePlaceholder } from "./image-placeholder";

/* The presentational half of `gallery-modal`, split out because `'use client'` is file-scoped: with
   no hooks it renders from a server page and demos in a plain bounded box.

   `<img>` rather than `next/image`: masonry needs each tile's intrinsic height, and the content
   schema carries no image dimensions, so neither the sized nor the `fill` form works. A failed image
   therefore collapses its figure. */

/* The same URL can appear twice, so keys are the URL plus its occurrence count rather than the
   array index. */
function withKeys(images: string[]) {
  const seen = new Map<string, number>();
  return images.map((src) => {
    const occurrence = seen.get(src) ?? 0;
    seen.set(src, occurrence + 1);
    return { src, key: occurrence === 0 ? src : `${src}#${occurrence}` };
  });
}

interface GalleryModalPanelProps {
  title: string;
  images: string[];
  /** Index the wrapper's swipe/arrow navigation currently points at. */
  activeIndex?: number;
  titleId?: string;
  onClose?: () => void;
  className?: string;
}

export function GalleryModalPanel({
  title,
  images,
  activeIndex,
  titleId,
  onClose,
  className,
}: GalleryModalPanelProps) {
  return (
    <div
      className={`absolute inset-0 flex flex-col gap-space-md overflow-y-auto bg-shadow-warm/92 p-space-md [--focus-ring-color:var(--focus-ring-color-inverse)] ${className ?? ""}`}
    >
      <header className="flex items-start justify-between gap-space-md">
        <h2 className="type-heading-lg text-ink-inverse" id={titleId}>
          {title}
        </h2>
        <button
          className="type-action inline-flex min-h-(--touch-target) min-w-(--touch-target) shrink-0 items-center justify-center rounded-sm text-ink-inverse"
          onClick={onClose}
          type="button"
        >
          Close
        </button>
      </header>

      <div className="columns-2 gap-space-2xs lg:columns-3">
        {withKeys(images).map(({ src, key }, index) => (
          <figure
            aria-current={index === activeIndex ? "true" : undefined}
            className="relative mb-space-2xs block break-inside-avoid overflow-hidden rounded-sm"
            data-gallery-index={index}
            key={key}
          >
            <ImagePlaceholder
              className="absolute inset-0 h-full"
              height={5}
              width={4}
            />
            <img
              alt=""
              className="relative block w-full"
              loading="lazy"
              src={src}
            />
          </figure>
        ))}
      </div>
    </div>
  );
}
