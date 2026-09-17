/* Every plane is the kit panel; its opaque fill and sheet shadow keep the overlapping stack
   legible. The inline z-index orders the diagram's own planes and is not the scale being shown. */

/* Diagram geometry. OFFSET_Y clears each plane's three text lines so the next plane never hides
   them; OFFSET_X stays well under it so every plane keeps its text width. */
const PLANE_H = 120;
const OFFSET_Y = 112;
const OFFSET_X = 32;
const MIN_W = 640;

export interface LayerItem {
  token: string;
  /** Numeric z-index as a string. */
  value: string;
  role: string;
}

interface LayerStackProps {
  items: LayerItem[];
}

export function LayerStack({ items }: LayerStackProps) {
  const ordered = [...items].sort((a, b) => Number(a.value) - Number(b.value));
  const count = ordered.length;

  return (
    <div className="overflow-x-auto pb-space-md">
      <div
        className="relative"
        style={{
          height: PLANE_H + (count - 1) * OFFSET_Y,
          minWidth: MIN_W,
        }}
      >
        {ordered.map((item, index) => (
          <div
            className="absolute flex flex-col gap-space-3xs overflow-hidden bg-surface-elevated shadow-sheet p-space-sm"
            key={item.token}
            style={{
              top: index * OFFSET_Y,
              left: index * OFFSET_X,
              width: `calc(100% - ${(count - 1) * OFFSET_X}px)`,
              minHeight: PLANE_H,
              zIndex: index,
            }}
          >
            <span className="type-body text-ink">{item.role}</span>
            <span className="type-body text-ink">{item.token}</span>
            <span className="type-eyebrow">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
