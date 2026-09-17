/* The right-hand sample carries only the role class — no colour, size, weight, line-height or
   family utility beside it — so it renders at the role's own scale for the current window tier. */

interface TierMetric {
  size: number;
  lh: number;
}

export interface TypeToken {
  /** The `.type-*` class name, without the leading dot. */
  token: string;
  family: string;
  weight: number;
  /** The role's use, from DESIGN.md → Typography → The scale → Use. Rendered in the role itself. */
  sample: string;
  /** Size and line height in px at each width tier. */
  phone: TierMetric;
  tablet: TierMetric;
  laptop: TierMetric;
}

function tiersOf(token: TypeToken) {
  return [
    { label: "Phone", metric: token.phone },
    { label: "Tablet", metric: token.tablet },
    { label: "Laptop", metric: token.laptop },
  ];
}

interface TypeScaleListProps {
  tokens: TypeToken[];
}

export function TypeScaleList({ tokens }: TypeScaleListProps) {
  return (
    <div className="flex flex-col">
      {tokens.map((token) => (
        /* 280px metadata column: gallery layout constant. */
        <div
          className="grid grid-cols-1 gap-space-2xs border-accent-gold border-b-(length:--stroke-divider) py-space-md last:border-b-0 md:grid-cols-[280px_1fr] md:items-baseline md:gap-space-md"
          key={token.token}
        >
          <div className="flex flex-col gap-space-3xs">
            <span className="type-body text-ink">.{token.token}</span>
            <span className="type-eyebrow">
              {token.family} · {token.weight}
            </span>
            <dl className="grid grid-cols-[auto_auto] justify-start gap-x-space-sm">
              {tiersOf(token).map((tier) => (
                <div className="contents" key={tier.label}>
                  <dt className="type-caption text-ink">{tier.label}</dt>
                  <dd className="type-caption text-ink">
                    {tier.metric.size} / {tier.metric.lh}px
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div className={`${token.token} min-w-0`}>{token.sample}</div>
        </div>
      ))}
    </div>
  );
}
