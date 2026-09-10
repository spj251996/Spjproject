/* curate-gallery visualizer kit — TypeScaleList (skill → references/visualizer-kit.md § 2).

   Dogfood, enforced: the right-hand sample carries ONLY the token class. No color, size, weight,
   line-height or family utility rides alongside it — the class IS the style, and the sample renders
   at its own scale against the inherited ink. */

export interface TypeToken {
  /** The `.type-*` class name, without the leading dot. */
  token: string;
  family: string;
  /** Desktop px value. */
  size: number;
  weight: number;
  /** Line-height in px. Optional: a role whose token declares none emits nothing rather than a
      fabricated number (rules/data-integrity.md → Missing values). */
  lh?: number;
  /** Where the role is used in the product, from DESIGN.md → Typography's Role column. */
  sample: string;
  /** Only for roles that step across viewports. */
  responsive?: { tablet: number; mobile: number };
}

interface TypeScaleListProps {
  tokens: TypeToken[];
}

export function TypeScaleList({ tokens }: TypeScaleListProps) {
  return (
    <div className="flex flex-col">
      {tokens.map((token) => (
        /* 280px metadata column is a gallery layout constant, not a design token. */
        <div
          className="grid grid-cols-1 gap-space-2xs border-b-(length:--stroke-divider) border-accent-gold py-space-md last:border-b-0 md:grid-cols-[280px_1fr] md:items-baseline md:gap-space-md"
          key={token.token}
        >
          <div className="flex flex-col gap-space-3xs">
            <span className="type-body text-ink">.{token.token}</span>
            <span className="type-eyebrow">
              {token.family} · {token.size}px / {token.weight}
              {token.lh === undefined ? "" : ` / lh ${token.lh}`}
            </span>
            {token.responsive === undefined ? null : (
              <span className="type-body text-ink">
                ↘ desktop {token.size}px → tablet {token.responsive.tablet}px →
                mobile {token.responsive.mobile}px
              </span>
            )}
          </div>

          <div className={`${token.token} min-w-0`}>{token.sample}</div>
        </div>
      ))}
    </div>
  );
}
