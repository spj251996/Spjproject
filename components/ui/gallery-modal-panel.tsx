import { ImagePlaceholder } from "./image-placeholder";

/* The presentational half of `gallery-modal`, split out because `'use client'` is file-scoped: with
   no hooks it renders from a server page and demos in a plain bounded box.

   `<img>` rather than `next/image`: `next.config.ts` sets `images: { unoptimized: true }`, because a
   static export has no runtime optimiser, so `next/image` would add nothing here — and this panel
   takes paths only, not the manifest's dimensions. A failed image therefore collapses its figure —
   and that is kept deliberately: a grey box among photographs reads as broken, and the masonry
   closes over the gap.

   Each tile is a button that opens the viewer on its photograph, and carries the save cover: a
   transparent `aria-hidden` layer over a non-draggable image, so a right-click, a long-press or a
   drag lands on the cover while a tap still reaches the button. */

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
  titleId?: string;
  onClose?: () => void;
  /** Opens the viewer on the tapped photograph. Absent in a static specimen. */
  onOpenPhoto?: (index: number) => void;
  className?: string;
}

export function GalleryModalPanel({
  title,
  images,
  titleId,
  onClose,
  onOpenPhoto,
  className,
}: GalleryModalPanelProps) {
  return (
    <div
      className={`absolute inset-0 flex flex-col gap-space-md overflow-y-auto bg-shadow-warm/92 p-space-md [--focus-ring-color:var(--focus-ring-color-inverse)] ${className ?? ""}`}
    >
      <header className="flex items-start justify-between gap-space-md">
        <h2 className="type-heading-sm text-ink-inverse" id={titleId}>
          {title}
        </h2>
        <button
          className="type-action inline-flex min-h-(--touch-target) min-w-(--touch-target) shrink-0 items-center justify-center rounded-card text-ink-inverse"
          onClick={onClose}
          type="button"
        >
          Close
        </button>
      </header>

      <div className="columns-2 gap-space-2xs lg:columns-3">
        {withKeys(images).map(({ src, key }, index) => (
          <figure
            className="relative mb-space-2xs block break-inside-avoid overflow-hidden rounded-card"
            data-gallery-index={index}
            key={key}
          >
            <button
              aria-label={`Photo ${index + 1}`}
              className="relative block w-full"
              onClick={() => onOpenPhoto?.(index)}
              type="button"
            >
              <ImagePlaceholder
                className="absolute inset-0 h-full"
                height={5}
                width={4}
              />
              <img
                alt=""
                className="relative block w-full"
                draggable={false}
                loading="lazy"
                src={src}
              />
              <span aria-hidden="true" className="absolute inset-0" />
            </button>
          </figure>
        ))}
      </div>
    </div>
  );
}
