import { SprigIcon } from "@/components/icons";
import styles from "./ornamental-divider.module.css";

/* Two even hairlines with the sprig mark in the gap between them. Decoration only: no separator
   role, since an `<hr>` here would announce a division the reading order does not have — which is
   the whole difference between this and `divider`. */

/* The mark is sized in px per tier rather than drawn into a shared viewBox with the rules: a shared
   box is scale-bound by its WIDTH, which put the mark below the Iconography floor and gave a phone a
   smaller mark than a laptop (sizes per tier: DESIGN.md → `ornamental-divider`).

   The outer two bands are open-ended and safe: they never overlap each other or the bounded middle
   band, so string order can't make one beat another here. The risk is real only between two
   open-ended rules that DO overlap — Tailwind emits arbitrary variants in string order, so an open
   `>=48rem` rule would be written before `>=64rem` and beat it wherever both match; that pattern is
   what the middle band's explicit bound guards against.

   The tablet band keeps the smallest mark on purpose: its landscape card stands within a few px of
   its height cap, so it is the one tier with no height to give. */
const DIVIDER_MARK_SIZES = [
  { size: 32, show: "[@media(width<48rem)]:block hidden" },
  { size: 23, show: "hidden [@media(48rem<=width<64rem)]:block" },
  { size: 48, show: "hidden [@media(width>=64rem)]:block" },
] as const;

interface OrnamentalDividerProps {
  className?: string;
}

export function OrnamentalDivider({ className }: OrnamentalDividerProps) {
  return (
    <div
      aria-hidden
      className={`${styles.rule} ${className ?? ""}`}
      role="presentation"
    >
      <span className={styles.hairline} />
      {DIVIDER_MARK_SIZES.map(({ size, show }) => (
        <span className={`${show} *:block`} key={size}>
          <SprigIcon size={size} />
        </span>
      ))}
      <span className={styles.hairline} />
    </div>
  );
}
