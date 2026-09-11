/* curate-gallery visualizer kit — DeviceRuler (skill → references/visualizer-kit.md § 8).

   Silhouette geometry is the skill's fixed proportional standard, reproduced verbatim by the caller;
   only `used` and `token` vary per project. Radius stays 0 — these are physical screens, the one
   visualizer that does not adopt the project's radius.

   P2: `used` takes the sunken fallback (deepest surface + the documented divider), `unused` takes
   elevated paper. Known weakness, reported rather than papered over: this palette's two ivories
   differ by ~1%, so the two states read apart by their stroke-versus-shadow treatment, not by fill.

   Three lines, three roles. The breakpoint value is the accent, so it takes `type-eyebrow` and the
   gold that role owns. The device name is secondary, so it takes `type-caption` at ink. Never pair
   `type-eyebrow` with `text-ink` to get that: a utility beats the components layer, so the override
   wins silently and renders the label in ink against the doc's without-exception always-gold rule.
   The distinction is drawn with a role rather than by overriding one. */

export interface RulerStop {
  /** Breakpoint floor in px, as a string. */
  px: string;
  device: string;
  /** Breakpoint token name, e.g. "md". */
  token: string;
  /** True when the project actually uses this breakpoint. */
  used: boolean;
  /** Silhouette geometry in px — the skill's fixed standard, not a design token. */
  boxW: number;
  boxH: number;
}

interface DeviceRulerProps {
  stops: RulerStop[];
}

const USED_LEVEL =
  "border-(length:--stroke-divider) border-accent-gold bg-surface-base";

const UNUSED_LEVEL = "bg-surface-elevated shadow-sheet";

export function DeviceRuler({ stops }: DeviceRulerProps) {
  return (
    <div className="flex items-end gap-space-2xs overflow-x-auto pb-space-md">
      {stops.map(({ px, device, token, used, boxW, boxH }) => (
        <div
          className={`flex shrink-0 flex-col items-center justify-end gap-[2px] rounded-none p-space-3xs ${used ? USED_LEVEL : UNUSED_LEVEL}`}
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
