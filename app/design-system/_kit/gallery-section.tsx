import type { ReactNode } from "react";

/* Reference lines (doc path, source path, note, spec) take `type-caption`; content takes
   `type-body`. */

interface GallerySectionProps {
  /** Section slug WITHOUT the `ds-` prefix; the rendered id is always `ds-{id}`. */
  id: string;
  title: string;
  intro: string;
  /** Full DESIGN.md heading path, e.g. "Foundations → Colors". */
  mapsTo: string;
  /** Real project artifact this section reflects — a code path or token selector, never a kit file. */
  source?: string;
  children: ReactNode;
}

export function GallerySection({
  id,
  title,
  intro,
  mapsTo,
  source,
  children,
}: GallerySectionProps) {
  return (
    <section
      className="flex scroll-mt-space-3xl flex-col gap-space-lg"
      id={`ds-${id}`}
    >
      <div className="flex flex-col gap-space-2xs">
        <h2 className="type-heading-lg text-ink">{title}</h2>
        <p className="type-caption text-ink">→ DESIGN.md → {mapsTo}</p>
        {source === undefined ? null : (
          <p className="type-caption text-ink">{source}</p>
        )}
        <p className="type-body text-ink">{intro}</p>
      </div>

      <div className="flex flex-col gap-space-xl">{children}</div>
    </section>
  );
}

interface SpecimenGroupProps {
  /** Mirrors a DESIGN.md sub-group heading. */
  title: string;
  children: ReactNode;
}

export function SpecimenGroup({ title, children }: SpecimenGroupProps) {
  return (
    <div className="flex flex-col gap-space-md">
      <h3 className="type-eyebrow">{title}</h3>
      <div className="flex flex-col gap-space-lg">{children}</div>
    </div>
  );
}

interface SpecimenProps {
  /** Scroll-target id on the wrapper — no `ds-` prefix (that namespace belongs to sections). */
  id: string;
  name: string;
  /** Real import/file path the demo renders from. */
  source?: string;
  /** One line: what it is and where it is used. */
  description?: string;
  /** Only what the render cannot show: an interaction to try, an unposable state, a resize, a known gap. */
  note?: string;
  /** Terse token or trait list, rendered last because it annotates the demo above it. A string is
      one `·`-separated line; an array renders one item per line. */
  spec?: string | string[];
  /** 3 at section level, 4 inside a SpecimenGroup. Never skips a level. */
  headingLevel?: 3 | 4;
  children: ReactNode;
}

export function Specimen({
  id,
  name,
  source,
  description,
  note,
  spec,
  headingLevel = 3,
  children,
}: SpecimenProps) {
  const Heading = headingLevel === 4 ? "h4" : "h3";

  return (
    <div className="flex scroll-mt-space-3xl flex-col gap-space-2xs" id={id}>
      <Heading className="type-heading-lg text-ink">{name}</Heading>

      {source === undefined ? null : (
        <p className="type-caption text-ink">{source}</p>
      )}
      {description === undefined ? null : (
        <p className="type-body text-ink">{description}</p>
      )}
      {note === undefined ? null : (
        <p className="type-caption text-ink">{note}</p>
      )}

      {children}

      {spec === undefined ? null : Array.isArray(spec) ? (
        <ul className="flex flex-col gap-space-3xs">
          {spec.map((line) => (
            <li className="type-caption text-ink" key={line}>
              {line}
            </li>
          ))}
        </ul>
      ) : (
        <p className="type-caption text-ink">{spec}</p>
      )}
    </div>
  );
}
