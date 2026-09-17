import Image from "next/image";
import { ImagePlaceholder } from "./image-placeholder";

/* Flat props rather than `FamilyMember`: a portable component may not name a domain type.

   The placeholder is a base layer under the image rather than behind a data check, because
   "still loading" is a render-time state no data check can see; this keeps the component
   server-rendered. An image with transparent regions lets the placeholder show through. */

interface PortraitProps {
  name: string;
  relationship: string;
  src: string | null;
  /** Rendered diameter in px. The default has no design source yet. */
  size?: number;
  className?: string;
}

export function Portrait({
  name,
  relationship,
  src,
  size = 128,
  className,
}: PortraitProps) {
  return (
    <figure
      className={`flex flex-col items-center gap-space-2xs ${className ?? ""}`}
    >
      <div
        className="relative overflow-hidden rounded-full"
        style={{ width: size, height: size }}
      >
        <ImagePlaceholder
          className="absolute inset-0 h-full"
          height={size}
          width={size}
        />
        {src === null ? null : (
          <Image
            alt={name}
            className="object-cover"
            fill
            sizes={`${size}px`}
            src={src}
          />
        )}
      </div>
      <figcaption className="flex flex-col items-center gap-space-3xs text-center">
        <span className="type-body text-ink">{name}</span>
        <span className="type-eyebrow">{relationship}</span>
      </figcaption>
    </figure>
  );
}
