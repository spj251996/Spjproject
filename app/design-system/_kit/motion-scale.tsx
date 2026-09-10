/* curate-gallery visualizer kit — DurationScale + EasingCurves (skill → references/visualizer-kit.md § 6).

   Both are static: neither animates, so `prefers-reduced-motion` is satisfied by construction rather
   than by a gate a later edit could drop.

   P2 colour split follows DESIGN.md → Colors' own rule about the two golds. The bar fill and the
   bezier curve are meaning-bearing marks, so they take `{colors.accent-gold}`; the empty
   track, the reference diagonal, the control handles and the control-point rings are decorative
   scaffolding that carries no meaning on its own, which is exactly what `{colors.accent-gold}` is
   for. The plot well uses the sunken fallback (deepest surface + the documented divider) — this
   system defines no recessed level. */

/* Gallery layout constants (skill → visualizer-kit.md → documented bare-px exceptions). */
const TRACK_W = 280;
const LABEL_W = 160;
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

  return (
    <div className="overflow-x-auto">
      <div className="flex w-fit flex-col gap-space-md p-space-md">
        {items.map(({ token, ms }) => {
          const barPx = Math.round((ms / maxMs) * TRACK_W);

          return (
            <div className="flex items-center gap-space-sm" key={token}>
              <span
                className="type-body shrink-0 text-ink"
                style={{ width: LABEL_W }}
              >
                {token}
              </span>

              <div className="relative shrink-0" style={{ width: TRACK_W }}>
                <span
                  className="type-eyebrow -translate-x-1/2 absolute bottom-[calc(100%+4px)] whitespace-nowrap text-accent-gold"
                  style={{ left: barPx }}
                >
                  {ms}ms
                </span>

                <div className="h-[6px] w-full bg-accent-gold">
                  <div
                    className="h-full bg-accent-gold"
                    style={{ width: barPx }}
                  />
                </div>

                <span className="type-eyebrow absolute top-[calc(100%+4px)] left-0 text-accent-gold">
                  0ms
                </span>
                <span className="type-eyebrow absolute top-[calc(100%+4px)] right-0 text-accent-gold">
                  {maxMs}ms
                </span>
              </div>
            </div>
          );
        })}
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
        className="rounded-sm border-(length:--stroke-divider) border-accent-gold bg-surface-base"
        style={{ width: CANVAS, height: CANVAS }}
      >
        <svg
          aria-label={`Easing ${token}: cubic-bezier(${x1}, ${y1}, ${x2}, ${y2})`}
          height={CANVAS}
          role="img"
          viewBox={`0 0 ${CANVAS} ${CANVAS}`}
          width={CANVAS}
        >
          <line
            className="stroke-accent-gold"
            strokeDasharray="2 2"
            x1={sx(0)}
            x2={sx(1)}
            y1={sy(0)}
            y2={sy(1)}
          />
          <line
            className="stroke-accent-gold"
            x1={sx(0)}
            x2={sx(x1)}
            y1={sy(0)}
            y2={sy(y1)}
          />
          <line
            className="stroke-accent-gold"
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
