/* Each card is styled with its level's real classes. Text colour is inherited, never set here: a
   dark level sets its own ink, and a pinned `text-ink` would hide the green stock's label. */

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
    <div className="grid grid-cols-1 gap-space-md md:grid-cols-2 lg:grid-cols-3">
      {levels.map(({ name, spec, className, usage }) => (
        /* 180px min-height: gallery layout constant. */
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
