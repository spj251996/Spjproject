import { Fragment } from "react";

export interface BarItem {
  /** Token key WITHOUT the namespace prefix, e.g. "space-md" or the bare zero step "0". */
  token: string;
  /** Resolved pixel value, shown in the label. */
  px: number;
}

interface BarScaleProps {
  items: BarItem[];
  /** Namespace the token keys hang off, e.g. "--spacing-". */
  varPrefix: string;
}

export function BarScale({ items, varPrefix }: BarScaleProps) {
  return (
    <div className="grid grid-cols-[auto_1fr] items-center gap-space-2xs">
      {items.map(({ token, px }) => (
        <Fragment key={token}>
          <span className="type-body whitespace-nowrap text-ink">
            {token} · {px}px
          </span>
          {/* 20px bar height: gallery layout constant. The width is the live token. */}
          <span
            aria-hidden="true"
            className="h-[20px] bg-accent-gold"
            style={{ width: `var(${varPrefix}${token})` }}
          />
        </Fragment>
      ))}
    </div>
  );
}
