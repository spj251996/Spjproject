import styles from "./ornamental-divider.module.css";

/* Two even hairlines with a small four-pointed star in the gap between them. Decoration only: no
   separator role, since an `<hr>` here would announce a division the reading order does not have —
   which is the whole difference between this and `divider`. Drawn rather than bordered so the star
   keeps its proportion to the line at every width; the ornament scales as one. */

interface OrnamentalDividerProps {
  className?: string;
}

export function OrnamentalDivider({ className }: OrnamentalDividerProps) {
  return (
    <svg
      aria-hidden
      className={`${styles.rule} ${className ?? ""}`}
      role="presentation"
      viewBox="0 0 600 20"
    >
      <rect height="1" width="272" x="0" y="9.5" />
      <rect height="1" width="272" x="328" y="9.5" />
      <path d="M300 3 C 300.8 8.2 301.8 9.2 307 10 C 301.8 10.8 300.8 11.8 300 17 C 299.2 11.8 298.2 10.8 293 10 C 298.2 9.2 299.2 8.2 300 3 Z" />
    </svg>
  );
}
