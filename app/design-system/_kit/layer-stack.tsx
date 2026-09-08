/* curate-gallery visualizer kit — LayerStack (skill → references/visualizer-kit.md § 7).

   P2: the skill's sign-map wants a sunken / flat / raised bordered level per plane. This system
   defines no bordered elevation level at all — its two levels are base paper (no border, no shadow)
   and elevated paper (shadows, no border) — so the documented uniform fallback applies: ONE simple
   bordered treatment for every plane, built from the deepest surface plus the documented divider.
   Opaque fills are what make the stacking legible, and paper-on-paper is the metaphor DESIGN.md →
   Elevation & Depth already uses. Radius stays 0: planes are structural, never dogfooded. */

/* Gallery layout constants (skill → visualizer-kit.md → documented bare-px exceptions). `dy` clears
   each plane's three-line text band so no plane's labels are hidden by the next; `dx` stays well
   under `dy` so the stack leans vertical and every plane keeps full text width. */
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
  /* Back (lowest z) to front (highest z) — the diagram's order is the scale, not the input order. */
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
            className="absolute flex flex-col gap-space-3xs overflow-hidden rounded-none border-(length:--stroke-divider) border-accent-gold-on-base bg-surface-base p-space-sm"
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
            <span className="type-body text-accent-gold-on-base">
              {item.token}
            </span>
            <span className="type-eyebrow text-accent-gold-on-base">
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
