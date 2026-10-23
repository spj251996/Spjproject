import { CloseIcon } from "@/components/icons";
import { CONTROL_CIRCLE, gridColumns } from "./gallery-control";

/* The presentational half of `gallery-modal`, split out because `'use client'` is file-scoped: with
   no hooks it renders from a server page and demos in a plain bounded box. That holds only while it
   CREATES no function of its own: a server render cannot hand one to a `<button>` or an `<img>`, so
   a tile's handlers exist only when the caller passes `onOpenPhoto`, `onPhotoLoad` and
   `onPhotoError` — the live modal does, a specimen does not.

   `<img>` rather than `next/image`: `next.config.ts` sets `images: { unoptimized: true }`, because a
   static export has no runtime optimiser, so `next/image` would add nothing here. A tile holds no
   place until its photograph has loaded — no box, no margin and no Tab stop — so the grid shows only
   photographs, never an empty slot. A photograph that fails is not shown at all: a grey box among
   photographs reads as broken. The caller hears of each through `onPhotoLoad` / `onPhotoError` and
   hands them back in `loaded` / `failed`; a failed one renders no figure, and the columns are counted
   over the tiles left, so none stands empty. A specimen passes neither set, so every tile shows.

   Each tile is a button that opens the viewer on its photograph, and carries the save cover: a
   transparent `aria-hidden` layer over a non-draggable image, so a right-click, a long-press or a
   drag lands on the cover while a tap still reaches the button.

   On a device that can hover, a tile shows it opens bigger: the zoom-in cursor, and the photograph
   growing 3% inside the figure's rounded clip. */

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
  /** Indices into `images` whose photograph has loaded. Absent in a static specimen: every tile shows. */
  loaded?: ReadonlySet<number>;
  /** Indices into `images` whose photograph failed to load; their tiles are not rendered. */
  failed?: ReadonlySet<number>;
  titleId?: string;
  onClose?: () => void;
  /** Opens the viewer on the tapped photograph. Absent in a static specimen. */
  onOpenPhoto?: (index: number) => void;
  /** Reports a tile whose photograph has loaded. Absent in a static specimen. */
  onPhotoLoad?: (index: number) => void;
  /** Reports a tile whose photograph failed to load. Absent in a static specimen. */
  onPhotoError?: (index: number) => void;
  className?: string;
}

export function GalleryModalPanel({
  title,
  images,
  loaded,
  failed,
  titleId,
  onClose,
  onOpenPhoto,
  onPhotoLoad,
  onPhotoError,
  className,
}: GalleryModalPanelProps) {
  /* Keyed before the failed tiles go, so a photograph's key never depends on whether another
     failed; each keeps its index into `images`, which is what the viewer opens on. */
  const tiles = withKeys(images)
    .map((tile, index) => ({
      ...tile,
      index,
      shown: loaded === undefined || loaded.has(index),
    }))
    .filter(({ index }) => !failed?.has(index));
  return (
    <div
      className={`absolute inset-0 flex flex-col gap-space-md overflow-y-auto bg-scrim/92 p-space-md [scrollbar-color:auto] ${className ?? ""}`}
    >
      <header className="flex items-start justify-between gap-space-md">
        <h2 className="type-heading-sm text-ink-inverse" id={titleId}>
          {title}
        </h2>
        <button
          aria-label="Close"
          className={CONTROL_CIRCLE}
          onClick={onClose}
          type="button"
        >
          <CloseIcon size={20} />
        </button>
      </header>

      <div className={`gap-space-2xs ${gridColumns(tiles.length)}`}>
        {tiles.map(({ src, key, index, shown }) => (
          <figure
            className={`relative block break-inside-avoid overflow-hidden rounded-card ${shown ? "mb-space-2xs" : ""}`}
            data-gallery-index={index}
            key={key}
          >
            <button
              aria-label={`Photo ${index + 1}`}
              className="group relative block w-full cursor-zoom-in"
              onClick={onOpenPhoto && (() => onOpenPhoto(index))}
              tabIndex={shown ? undefined : -1}
              type="button"
            >
              <img
                alt=""
                className="relative block w-full motion-safe:transition-transform motion-safe:duration-(--duration-fast) motion-safe:ease-settle motion-safe:group-hover:scale-[1.03]"
                draggable={false}
                loading="lazy"
                onError={onPhotoError && (() => onPhotoError(index))}
                onLoad={onPhotoLoad && (() => onPhotoLoad(index))}
                src={src}
              />
              {/* The ring is drawn here, as `photo-row`'s frames draw it: the clipped photo and this
                  cover paint over the button's own outline at any offset. */}
              <span
                aria-hidden="true"
                className="absolute inset-0 group-focus-visible:shadow-[inset_0_0_0_var(--focus-ring-width)_var(--focus-ring-color)]"
              />
            </button>
          </figure>
        ))}
      </div>
    </div>
  );
}
