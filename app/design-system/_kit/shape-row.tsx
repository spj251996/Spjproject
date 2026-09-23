/* The box is the kit panel. Its radius is the value being shown, applied inline per item. */

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
        /* 140px column: gallery layout constant. */
        <div
          className="flex w-[140px] flex-col items-center gap-space-2xs"
          key={token}
        >
          <span
            aria-hidden="true"
            className="size-space-2xl bg-surface-elevated shadow-stock"
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
