import type { ReactNode } from "react";

/* curate-gallery scaffold kit — catalog primitives (skill → references/scaffold-kit.md).

   P2 alignment for the whole kit, resolved from DESIGN.md rather than the skill's portfolio example
   token names. This project's type scale has 7 roles and no mono/code, caption or emphasis role, so
   several of the skill's label roles fall back to `type-body` per visualizer-kit.md → Generic
   fallbacks. Hierarchy is carried by color instead: `text-ink` for content (headings, names, prose)
   and `text-accent-gold` for reference marks (doc paths, code paths, token names, spec
   notes) — DESIGN.md → Colors assigns gold to "eyebrow labels ... and link accent details" and to
   "meaning-bearing marks on ivory", which is exactly what those lines are.

   Specimen headings take `type-heading-lg` at h3/h4 following the project's own precedent:
   A domain section renders its `<h3>` name at that role, which DESIGN.md → Typography defines as "H2 and
   event names" — a name role, not a level role. */

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
        <p className="type-body text-ink">→ DESIGN.md → {mapsTo}</p>
        {source === undefined ? null : (
          <p className="type-body text-ink">{source}</p>
        )}
        <p className="type-body text-ink">{intro}</p>
      </div>

      <div className="flex flex-col gap-space-xl">{children}</div>
    </section>
  );
}

interface SpecimenGroupProps {
  /** Mirrors a DESIGN.md sub-group heading; rendered as an eyebrow, per the skill's h3 group role. */
  title: string;
  children: ReactNode;
}

export function SpecimenGroup({ title, children }: SpecimenGroupProps) {
  return (
    <div className="flex flex-col gap-space-md">
      <h3 className="type-eyebrow text-accent-gold">{title}</h3>
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
  description?: string;
  /** Token list or variant note; always rendered LAST, because it annotates the demo above it. */
  spec?: string;
  /** 3 at section level, 4 inside a SpecimenGroup. Never skips a level. */
  headingLevel?: 3 | 4;
  children: ReactNode;
}

export function Specimen({
  id,
  name,
  source,
  description,
  spec,
  headingLevel = 3,
  children,
}: SpecimenProps) {
  const Heading = headingLevel === 4 ? "h4" : "h3";

  return (
    <div className="flex scroll-mt-space-3xl flex-col gap-space-2xs" id={id}>
      <Heading className="type-heading-lg text-ink">{name}</Heading>

      {source === undefined ? null : (
        <p className="type-body text-ink">{source}</p>
      )}
      {description === undefined ? null : (
        <p className="type-body text-ink">{description}</p>
      )}

      {children}

      {spec === undefined ? null : <p className="type-body text-ink">{spec}</p>}
    </div>
  );
}
