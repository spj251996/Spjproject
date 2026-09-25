import styles from "./ornamental-divider.module.css";

/* Two even hairlines with the sprig mark in the gap between them. Decoration only: no
   separator role, since an `<hr>` here would announce a division the reading order does not have —
   which is the whole difference between this and `divider`. Drawn rather than bordered so the sprig
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
      {/* The sprig drawn into the rules' own 20-unit gap rather than as a `SprigIcon`: the mark and
          the two hairlines must scale as one, which is what keeps the ornament's proportion at
          every card width, and an icon sized in px alongside a viewBox-scaled rule cannot do that.
          14 units tall is the retired star's own height, so the ornament's optical weight does
          not move across the swap —
          and the drawing's height, not the box's, is what the fit was measured against. */}
      <g transform="translate(292.8 3) scale(0.08245)">
        <path d="M 114.8 5.5c -10.6 11.1 -14.8 19.8 -17.2 36 -2.2 14.3 -3.1 16.6 -7.9 20.9 -3.7 3.4 -13.3 11.2 -18.8 15.2 -1.4 1.1 -1.2 -0.1 1.3 -6.7 1.8 -4.8 3.8 -8.3 4.8 -8.6 8 -2.6 13.7 -22.1 9.6 -33.4 -2 -5.7 -3.8 -6 -9.1 -1.7 -6 5 -9.4 10.5 -10.7 17.5 -1.3 7.1 -0.5 12.2 2.7 15.9 1.7 2 2.1 3.2 1.4 4.3 -0.5 0.8 -1.6 3.9 -2.5 6.9 -2.2 7.6 -4.3 10.7 -16.4 24.5 -5.8 6.7 -11.7 13.5 -13.2 15.3 -5.8 6.9 -5.1 2.6 1.6 -10.1 7.3 -13.9 9.1 -21 9 -36.7 -0.2 -23.8 -2.6 -26.3 -10.3 -10.8 -7.5 15.2 -8.4 20.4 -7.6 42.8 0.8 21.4 0.4 23 -7.6 34 -10.1 14 -23.9 35.8 -23.9 37.9 0 0.6 0.8 1.1 1.8 1.1 1 0 2.7 -2 4.4 -5.3 4.7 -8.9 16.6 -26.5 20 -29.7 7.1 -6.4 10.5 -7.3 31.3 -8 18.1 -0.7 19.5 -0.9 29 -4.1 7 -2.4 10.1 -3.9 10.3 -5.2 0.2 -1.1 -0.3 -1.7 -1.5 -1.7 -1 0 -4.6 -0.7 -7.8 -1.6 -9.7 -2.5 -19.2 -3.3 -25.7 -2.3 -6.9 1.1 -12.2 3.6 -22.8 10.7 -4.1 2.8 -7.7 4.9 -7.9 4.7 -0.7 -0.8 6.6 -9.9 15.7 -19.6 5.5 -5.9 11.6 -9.3 18.8 -10.5 3.6 -0.5 4.1 -0.3 5.1 1.9 3 6.6 18.9 8.9 28.9 4.3 5.4 -2.5 9.4 -6.7 9.4 -9.8 0 -3.7 -6 -8.5 -12.4 -9.8 -10 -2.1 -18.8 0.2 -24.5 6.2 -2.5 2.6 -4.4 3.7 -7.5 4.1 -2.2 0.3 -5 0.8 -6.1 1.2 -3.8 1.3 14 -14.5 20 -17.7 6 -3.3 6 -3.3 25.5 -3 21.7 0.3 30.1 -1 40.3 -6.5 10 -5.4 6 -7.1 -16.3 -7.2 -14.8 -0.1 -20.3 1.1 -34.4 7.5 -5.4 2.5 -10 4.3 -10.3 4.1 -0.6 -0.7 27.5 -20 34.2 -23.5 1.1 -0.5 7.2 -2.4 13.6 -4 14.1 -3.7 22.5 -7.5 30.1 -13.6 6.9 -5.5 14.3 -14.9 13.4 -17.1 -0.7 -1.8 -1.8 -1.6 -16.1 2.7 -17.1 5.1 -23.6 8.9 -35 20.4 -8.2 8.3 -23.7 20.4 -26 20.4 -1.3 0 2.7 -6 8.5 -12.5 7 -7.9 11.8 -17.1 15.3 -29.5 2.8 -9.7 3.5 -14 2.4 -15.8 -1.3 -2 -2.1 -1.5 -8.9 5.5zm 5.2 1.1c 0 2.3 -3.4 13.2 -6 19.4 -3.1 7.2 -11.4 19.8 -13 19.8 -2 0 2 -16.1 5.9 -23.7 4.3 -8.6 13.1 -18.9 13.1 -15.5zm 45.9 14.9c -5.4 5.8 -8.1 8.1 -13.2 11.4 -5.3 3.5 -19.2 8.5 -26 9.5 -4.2 0.5 -4.2 0.5 2.1 -5.5 7 -6.8 15.6 -11.6 29 -16.1 11.4 -3.9 12.3 -3.8 8.1 0.7zm -82.5 9.5c 0.3 1.3 0.6 5.2 0.6 8.8 0 7.7 -3.3 15.8 -7.5 18.6 -2.4 1.6 -2.8 1.6 -4.2 0.1 -2.4 -2.4 -2.9 -11.8 -0.9 -17.1 1.7 -4.4 8.4 -12.6 10.3 -12.6 0.6 0 1.3 1 1.7 2.2zm -37.4 33c 0 5.9 -0.7 13.8 -1.5 17.7 -1.6 7.9 -7.3 21.3 -8.6 20.5 -1.6 -1 -1.1 -27.5 0.7 -33.5 2.4 -8.2 7.6 -18.2 8.6 -16.7 0.4 0.7 0.8 6.1 0.8 12zm 92.5 0.6c 5 0.7 5 0.7 0.5 2.4 -10.8 4 -19.9 5.2 -32.6 4.3 -5.2 -0.4 -9.2 -1.1 -8.7 -1.5 1.2 -1.1 10.7 -4.1 16.1 -5 5.8 -1 18 -1 24.7 -0.2zm -38.7 24.2c 7 3.2 6.8 6.6 -0.4 10.7 -7.5 4.3 -19.2 3.9 -24.2 -0.7 -2.9 -2.7 -2.8 -4.6 0.5 -7.6 5 -4.6 16.6 -5.8 24.1 -2.4zm -15.4 28.1c 6 1.2 6 1.2 2 2.7 -9.4 3.4 -43.6 6 -41.9 3.2 0.8 -1.3 7.9 -5 13 -6.7 4.6 -1.5 17.5 -1.1 26.9 0.8z" />
      </g>
    </svg>
  );
}
