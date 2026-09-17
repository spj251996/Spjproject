/* The right-hand sample carries only the role class — no colour, size, weight, line-height or
   family utility beside it — so it renders at the role's own scale for the current window tier. */

export interface TypeToken {
  /** The `.type-*` class name, without the leading dot. */
  token: string;
  family: string;
  weight: number;
  /** Laptop tier size in px. */
  size: number;
  /** Laptop tier line height in px. Omitted when the token declares none. */
  lh?: number;
  /** The role's use, from DESIGN.md → Typography → The scale → Use. Rendered in the role itself. */
  sample: string;
  /** Phone and tablet tiers, for roles that step across the width tiers. */
  responsive?: {
    tablet: number;
    mobile: number;
    tabletLh?: number;
    mobileLh?: number;
  };
}

interface Tier {
  label: string;
  size: number;
  lh: number | undefined;
}

function tiersOf(token: TypeToken): Tier[] {
  if (token.responsive === undefined) {
    return [{ label: "Every tier", size: token.size, lh: token.lh }];
  }

  return [
    {
      label: "Phone",
      size: token.responsive.mobile,
      lh: token.responsive.mobileLh,
    },
    {
      label: "Tablet",
      size: token.responsive.tablet,
      lh: token.responsive.tabletLh,
    },
    { label: "Laptop", size: token.size, lh: token.lh },
  ];
}

function tierMetric({ size, lh }: Tier): string {
  return lh === undefined ? `${size}px` : `${size} / ${lh}px`;
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
                  <dd className="type-caption text-ink">{tierMetric(tier)}</dd>
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
