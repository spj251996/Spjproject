import { Fragment } from "react";

/* curate-gallery visualizer kit — BarScale (skill → references/visualizer-kit.md § 3).

   The bar's width reads the LIVE token, so each bar shows the step's literal magnitude rather than a
   drawn approximation. The `auto` label column sizes to the widest label in whatever font the
   project uses, so every bar starts at the same x with no hardcoded label width. */

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
          <span className="type-body whitespace-nowrap text-accent-gold">
            {token} · {px}px
          </span>
          {/* 20px bar height is a gallery layout constant; the WIDTH is the real token value. */}
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
