import type { ReactNode } from "react";

/* The whole card is the kit panel; the swatch is inset so the sheet's top highlight stays visible,
   and outlined in the mount tone so the ivory swatches still show against the paper. */

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
    <div className="flex flex-col gap-space-sm bg-surface-elevated p-space-sm shadow-sheet">
      {/* 80px swatch band: gallery layout constant. */}
      <span
        aria-hidden="true"
        className="h-[80px] w-full border-(length:--stroke-divider) border-surface-mount"
        style={{ background: `var(${token})` }}
      />

      <div className="flex flex-1 flex-col gap-space-3xs">
        <span className="type-body text-ink">{name}</span>
        <span className="type-body text-ink">{token}</span>
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
          <span className="type-eyebrow">{group.label}</span>
          {group.note === undefined ? null : (
            <div className="type-body text-ink">{group.note}</div>
          )}
          <div className="grid grid-cols-1 gap-space-md md:grid-cols-3 lg:grid-cols-4">
            {group.tokens.map((swatch) => (
              <ColorCard key={swatch.token} {...swatch} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
