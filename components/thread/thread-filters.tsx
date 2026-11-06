import { THREAD_FILTERS } from "./thread-shadows";

/* Rendered once per page, beside every thread that names these ids: zero-size rather than hidden,
   since a `display: none` `<svg>`'s filters are not rendered for their references in every engine.
   The region here is each element's bounding box, which is what the page shows before it is measured
   and what the gallery shows; once measured, every element takes its own copy with a fitted region
   (`thread-shadow-regions.ts`). */
export function ThreadFilters() {
  return (
    <svg
      aria-hidden="true"
      height="0"
      role="presentation"
      style={{ position: "absolute" }}
      width="0"
    >
      <defs>
        {THREAD_FILTERS.map((filter) => (
          <filter
            colorInterpolationFilters="sRGB"
            height="200%"
            id={filter.id}
            key={filter.id}
            width="200%"
            x="-50%"
            y="-50%"
          >
            {filter.layers.map((layer) => (
              <feDropShadow
                dx="0"
                dy={layer.offsetY}
                key={`${layer.offsetY}-${layer.blur}`}
                stdDeviation={layer.blur}
                style={{
                  floodColor: `var(${layer.colour})`,
                  floodOpacity: layer.alpha,
                }}
              />
            ))}
          </filter>
        ))}
      </defs>
    </svg>
  );
}
