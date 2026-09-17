/* Silhouette sizes are visualization geometry supplied by the caller.

   Never pair `type-eyebrow` with `text-ink`: a utility beats the components layer and silently
   turns the always-gold eyebrow to ink. */

export interface RulerStop {
  /** Breakpoint floor in px, as a string. */
  px: string;
  device: string;
  /** Breakpoint token name, e.g. "md". */
  token: string;
  /** True when the project actually uses this breakpoint. */
  used: boolean;
  /** Silhouette geometry in px — visualization geometry, not a design token. */
  boxW: number;
  boxH: number;
}

interface DeviceRulerProps {
  stops: RulerStop[];
}

const USED_LEVEL = "bg-surface-elevated shadow-sheet";

const UNUSED_LEVEL =
  "bg-surface-base border-(length:--stroke-divider) border-surface-mount";

export function DeviceRuler({ stops }: DeviceRulerProps) {
  return (
    <div className="flex items-end gap-space-2xs overflow-x-auto pb-space-md">
      {stops.map(({ px, device, token, used, boxW, boxH }) => (
        <div
          className={`flex shrink-0 flex-col items-center justify-end gap-space-3xs p-space-3xs ${used ? USED_LEVEL : UNUSED_LEVEL}`}
          key={token}
          style={{ width: boxW, height: boxH }}
        >
          <span className="type-eyebrow">{px}</span>
          <span className="type-caption text-center text-ink">{device}</span>
          <span className="type-body text-ink">{token}</span>
        </div>
      ))}
    </div>
  );
}
