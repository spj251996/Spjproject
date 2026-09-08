import { ImagePlaceholder } from "./image-placeholder";

/* The presentational half of DESIGN.md → Components → UI → `gallery-modal`.

   This file exists because `'use client'` is file-scoped: `gallery-modal` retains the focus trap,
   scroll lock, keyboard dismissal and swipe handling, and this panel carries no directive, no hooks
   and no side-effects, so it renders from a server page and demos inside a plain bounded box. It is
   the extraction pattern's output, not a component DESIGN.md names — the doc gives it no entry.

   The panel establishes the system's first deep-green contrast ground (the `modal-scrim` block, which
   emits no variables and resolves as one `bg-<color>/<opacity>` here). Per the interaction rules it
   therefore rebinds `--focus-ring-color` on its own subtree; the global `:focus-visible` rule reads
   the variable, so no second ring definition exists.

   `<img>` rather than `next/image` is a documented exception: masonry needs each tile's intrinsic
   height, and the content schema carries no image dimensions, so neither the width/height form nor
   the `fill` form is available. Residue, reported as a spec gap: a failed image collapses its figure
   because nothing supplies the dimensions the doc's own no-reflow requirement depends on. */

/* An image list is a plain `string[]`, so the same URL can legitimately appear twice and a
   src-keyed list collapses. Keys are the URL plus its occurrence ordinal — derived from the data
   rather than from the array index, which identifies a position instead of a thing. */
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
      className={`absolute inset-0 flex flex-col gap-space-md overflow-y-auto bg-surface-contrast/92 p-space-md [--focus-ring-color:var(--focus-ring-color-on-contrast)] ${className ?? ""}`}
    >
      <header className="flex items-start justify-between gap-space-md">
        <h2 className="type-heading-lg text-ink-on-contrast" id={titleId}>
          {title}
        </h2>
        <button
          className="type-action inline-flex min-h-(--touch-target) min-w-(--touch-target) shrink-0 items-center justify-center rounded-sm text-ink-on-contrast"
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
