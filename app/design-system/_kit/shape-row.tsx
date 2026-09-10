/* curate-gallery visualizer kit — ShapeRow (skill → references/visualizer-kit.md § 4).

   P2: the box adopts elevated paper (the project's raised level), so its silhouette reads against the
   ivory ground without a stroke. Radius is applied inline per item because each item differs — that
   is the value being demonstrated. */

export interface ShapeItem {
  token: string;
  /** Full CSS value, e.g. "var(--radius-lg)" or "9999px" for a shape with no token. */
  radius: string;
  /** Human-readable value, e.g. "16px". */
  value: string;
  usage: string;
}

interface ShapeRowProps {
  items: ShapeItem[];
}

export function ShapeRow({ items }: ShapeRowProps) {
  return (
    <div className="flex flex-wrap gap-space-md">
      {items.map(({ token, radius, value, usage }) => (
        /* 64px box and 140px column are gallery layout constants, not design tokens. */
        <div
          className="flex w-[140px] flex-col items-center gap-space-2xs"
          key={token}
        >
          <span
            aria-hidden="true"
            className="h-[64px] w-[64px] bg-surface-elevated shadow-sheet"
            style={{ borderRadius: radius }}
          />
          <span className="type-body whitespace-nowrap text-ink">
            {token} · {value}
          </span>
          <span className="type-body text-center text-ink">{usage}</span>
        </div>
      ))}
    </div>
  );
}
