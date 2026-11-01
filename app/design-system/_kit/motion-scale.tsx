/* Both visualizers are static, so reduced motion holds without a gate.

   Gold marks the measurement (bar fill, curve); the mount colour marks the scaffolding (track,
   diagonal, handles). Gold on both would render every duration bar as one solid bar. */

/* Plot geometry. */
const CANVAS = 180;
const PLOT_PAD = 12;

export interface DurationToken {
  token: string;
  ms: number;
}

export interface EasingToken {
  token: string;
  /** cubic-bezier control points [x1, y1, x2, y2]. */
  curve: [number, number, number, number];
}

interface DurationScaleProps {
  items: DurationToken[];
}

export function DurationScale({ items }: DurationScaleProps) {
  const maxMs = Math.max(...items.map((item) => item.ms));

  /* Gallery layout constants: a 160px token label and a 280px track from md; below md the label sits
     above a track that takes the row's width. The value cell is fixed so every track ends together. */
  return (
    <div className="overflow-x-auto">
      <div className="flex flex-col gap-space-md p-space-md md:w-fit">
        {items.map(({ token, ms }) => (
          <div
            className="flex flex-col items-start gap-space-3xs md:flex-row md:items-center md:gap-space-sm"
            key={token}
          >
            <span className="type-body shrink-0 text-ink md:w-[160px]">
              {token}
            </span>

            <div className="flex w-full items-center gap-space-sm md:w-auto">
              {/* 6px track height: plot geometry. */}
              <div className="h-[6px] min-w-0 flex-1 bg-surface-mount md:w-[280px] md:flex-none">
                <div
                  className="h-full bg-accent-gold"
                  style={{ width: `${(ms / maxMs) * 100}%` }}
                />
              </div>

              <span className="type-eyebrow w-[4.5em] shrink-0 whitespace-nowrap">
                {ms}ms
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EasingPlot({ token, curve }: EasingToken) {
  const [x1, y1, x2, y2] = curve;
  const inner = CANVAS - PLOT_PAD * 2;
  const sx = (value: number) => PLOT_PAD + value * inner;
  /* y is flipped: 0 sits at the bottom of the plot, 1 at the top. */
  const sy = (value: number) => PLOT_PAD + (1 - value) * inner;

  return (
    <div className="flex flex-col gap-space-3xs">
      <div
        className="bg-surface-elevated shadow-stock"
        style={{ width: CANVAS, height: CANVAS }}
      >
        <svg
          aria-label={`Easing ${token}: cubic-bezier(${x1}, ${y1}, ${x2}, ${y2})`}
          height={CANVAS}
          role="img"
          viewBox={`0 0 ${CANVAS} ${CANVAS}`}
          width={CANVAS}
        >
          {/* Stroke widths, dash pattern and point radii below are plot geometry, not stroke tokens. */}
          <line
            className="stroke-surface-mount"
            strokeDasharray="2 2"
            x1={sx(0)}
            x2={sx(1)}
            y1={sy(0)}
            y2={sy(1)}
          />
          <line
            className="stroke-surface-mount"
            x1={sx(0)}
            x2={sx(x1)}
            y1={sy(0)}
            y2={sy(y1)}
          />
          <line
            className="stroke-surface-mount"
            x1={sx(1)}
            x2={sx(x2)}
            y1={sy(1)}
            y2={sy(y2)}
          />
          <path
            className="fill-none stroke-accent-gold"
            d={`M ${sx(0)} ${sy(0)} C ${sx(x1)} ${sy(y1)} ${sx(x2)} ${sy(y2)} ${sx(1)} ${sy(1)}`}
            strokeLinecap="round"
            strokeWidth={2}
          />
          <circle className="fill-ink" cx={sx(0)} cy={sy(0)} r={3} />
          <circle className="fill-ink" cx={sx(1)} cy={sy(1)} r={3} />
          <circle
            className="fill-none stroke-accent-gold"
            cx={sx(x1)}
            cy={sy(y1)}
            r={2.5}
          />
          <circle
            className="fill-none stroke-accent-gold"
            cx={sx(x2)}
            cy={sy(y2)}
            r={2.5}
          />
        </svg>
      </div>

      <span className="type-body text-ink">{token}</span>
      <span className="type-body text-ink">
        cubic-bezier({x1}, {y1}, {x2}, {y2})
      </span>
    </div>
  );
}

interface EasingCurvesProps {
  items: EasingToken[];
}

export function EasingCurves({ items }: EasingCurvesProps) {
  return (
    <div className="flex flex-wrap gap-space-md">
      {items.map((item) => (
        <EasingPlot key={item.token} {...item} />
      ))}
    </div>
  );
}
