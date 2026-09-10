/* curate-gallery visualizer kit — DepthGrid (skill → references/visualizer-kit.md § 5).

   Text color is inherited rather than forced: a level whose `className` establishes a dark ground
   sets its own ink there, and hardcoding `text-ink` here painted the green stock's label invisible.

   Each card IS its own demonstration: `className` carries that level's real elevation treatment, so
   the card demonstrates the level by being styled with it rather than describing it. */

export interface DepthLevel {
  name: string;
  /** Human description of the treatment. */
  spec: string;
  /** The ACTUAL classes that apply this level — the card is styled with them. */
  className: string;
  usage: string;
}

interface DepthGridProps {
  levels: DepthLevel[];
}

export function DepthGrid({ levels }: DepthGridProps) {
  return (
    /* Column count 1 → 2 → 3 is pinned; the breakpoints are this project's only two. */
    <div className="grid grid-cols-1 gap-space-md md:grid-cols-2 lg:grid-cols-3">
      {levels.map(({ name, spec, className, usage }) => (
        /* 180px min-height is a gallery layout constant, not a design token. */
        <div
          className={`flex min-h-[180px] flex-col justify-between p-space-md ${className}`}
          key={name}
        >
          <span className="type-body">{name}</span>
          <div className="flex flex-col gap-space-3xs">
            <span className="type-eyebrow">{spec}</span>
            <span className="type-body">{usage}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
