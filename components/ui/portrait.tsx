import Image from "next/image";
import type { ReactNode } from "react";
import { ImagePlaceholder } from "./image-placeholder";

/* Flat props rather than `FamilyMember`: a portable component may not name a domain type.

   The composing section sets the photo's diameter as `--portrait-diameter`, and the gap between
   photo and name through `className`. `--portrait-overrun` is how far each text line may run past
   the photo on either side before it wraps; the section sets it from the gap beside the portrait,
   so the real roster's text never meets.

   No `sizes`: the export serves images unoptimized, so there is no srcset for it to choose from.

   The placeholder is a base layer under the image rather than behind a data check, because
   "still loading" is a render-time state no data check can see; this keeps the component
   server-rendered. An image with transparent regions lets the placeholder show through. */

interface PortraitProps {
  name: string;
  relationship: string;
  src: string | null;
  className?: string;
}

/* The negative margins keep the column at the photo's width while the line runs wider. */
function TextLine({
  className,
  children,
}: {
  className: string;
  children: ReactNode;
}) {
  return (
    <span className="-mx-(--portrait-overrun,0px) flex w-[calc(var(--portrait-diameter)+2*var(--portrait-overrun,0px))] justify-center">
      <span className={`${className} text-balance text-center`}>
        {children}
      </span>
    </span>
  );
}

export function Portrait({
  name,
  relationship,
  src,
  className,
}: PortraitProps) {
  return (
    <figure
      className={`flex w-(--portrait-diameter) flex-col items-center ${className ?? ""}`}
    >
      <div className="relative size-(--portrait-diameter) shrink-0 rounded-full ring-(length:--stroke-divider) ring-accent-gold ring-offset-(length:--stroke-rim-offset) ring-offset-surface-elevated">
        <div className="absolute inset-0 overflow-hidden rounded-full">
          <ImagePlaceholder
            className="absolute inset-0 h-full"
            height={1}
            width={1}
          />
          {src === null ? null : (
            <Image alt={name} className="object-cover" fill src={src} />
          )}
        </div>
      </div>
      <figcaption className="flex flex-col items-center">
        <TextLine className="type-body text-ink">{name}</TextLine>
        <span className="-mt-space-3xs flex">
          <TextLine className="type-caption text-ink">{relationship}</TextLine>
        </span>
      </figcaption>
    </figure>
  );
}
