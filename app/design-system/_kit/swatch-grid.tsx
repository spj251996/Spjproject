import type { ReactNode } from "react";

/* curate-gallery visualizer kit — SwatchGrid (skill → references/visualizer-kit.md § 1).

   P2: the ColorCard adopts this project's only raised level — elevated paper (surface-elevated plus
   the two green-tinted shadows composed into ONE box-shadow, as `event-card` does; two utilities
   would overwrite each other). That level defines no border, so the card frame carries the shadow
   pair instead of a stroke, and the documented divider separates swatch from text. Radius is the
   project's card radius, `{rounded.lg}`. */

export interface SwatchToken {
  /** CSS custom property, e.g. "--color-surface-base". The swatch fill reads it live. */
  token: string;
  name: string;
  usage: string;
}

export interface SwatchGroup {
  label: string;
  tokens: SwatchToken[];
  note?: ReactNode;
}

function ColorCard({ token, name, usage }: SwatchToken) {
  return (
    <div className="flex flex-col overflow-hidden rounded-lg shadow-[var(--shadow-elevated-near),var(--shadow-elevated-far)]">
      {/* 80px swatch band is a gallery layout constant, not a design token. */}
      <span
        aria-hidden="true"
        className="h-[80px] w-full border-b-(length:--stroke-divider) border-accent-gold-on-base"
        style={{ background: `var(${token})` }}
      />

      <div className="flex flex-1 flex-col gap-space-3xs bg-surface-elevated p-space-sm">
        <span className="type-body text-ink">{name}</span>
        <span className="type-body text-accent-gold-on-base">{token}</span>
        <span className="type-body text-ink">{usage}</span>
      </div>
    </div>
  );
}

interface SwatchGridProps {
  groups: SwatchGroup[];
}

export function SwatchGrid({ groups }: SwatchGridProps) {
  return (
    <div className="flex flex-col gap-space-lg">
      {groups.map((group) => (
        <div className="flex flex-col gap-space-sm" key={group.label}>
          <span className="type-eyebrow text-accent-gold-on-base">
            {group.label}
          </span>
          {group.note === undefined ? null : (
            <div className="type-body text-ink">{group.note}</div>
          )}
          {/* Column count 2 → 3 → 4 is pinned; the breakpoints are this project's only two. */}
          <div className="grid grid-cols-2 gap-space-md md:grid-cols-3 lg:grid-cols-4">
            {group.tokens.map((swatch) => (
              <ColorCard key={swatch.token} {...swatch} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
