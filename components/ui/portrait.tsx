import Image from "next/image";
import { ImagePlaceholder } from "./image-placeholder";

/* DESIGN.md → Components → UI → `portrait`.

   Props are flat scalars rather than the `FamilyMember` object: this lives in the portable layer,
   which may not name a domain type without reversing the dependency direction the structure rule
   sets. The composing Family section destructures.

   `image-placeholder` renders as a base layer underneath the image rather than behind a data check.
   The doc scopes the placeholder to "missing or still loading" — a render-time state no data check
   can observe — and a base layer satisfies both without a hook, keeping this component server-
   rendered. Known weakness: an image with transparent regions lets the placeholder tone show through.

   `size` has no token behind it; the doc states no portrait dimension. The default is inferred. */

interface PortraitProps {
  name: string;
  relationship: string;
  src: string | null;
  /** Rendered diameter in px. Inferred default — DESIGN.md states no portrait dimension. */
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
        <span className="type-eyebrow text-accent-gold">{relationship}</span>
      </figcaption>
    </figure>
  );
}
