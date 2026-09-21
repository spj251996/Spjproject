import { IconBase } from "./icon-base";

/* Outer contours only, drawn as a stroke rather than the source's filled ring — see DESIGN.md →
   Foundations → Iconography: the added stroke is the only way to thicken a filled outline, and
   here it's the only way to thin the source's own heavy ring down to the set's line weight. */

export function MapIcon({
  size,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <IconBase
      className={className}
      nudge={0.7127}
      size={size}
      viewBox="66.68 -9.42 378.57 531.45"
    >
      <g
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={368}
        transform="translate(0.000000,512.000000) scale(0.050000,-0.050000)"
      >
        <path d="M4720 10218 c-1670 -189 -2994 -1523 -3179 -3202 -115 -1054 276 -2274 1225 -3816 319 -517 547 -853 1344 -1980 276 -390 571 -810 656 -932 281 -409 432 -403 729 30 95 138 359 513 585 832 1152 1622 1544 2235 1949 3045 624 1248 815 2250 608 3204 -388 1795 -2098 3025 -3917 2819z" />
        <path d="M4760 8403 c-1406 -308 -1919 -2025 -907 -3037 879 -879 2362 -612 2898 520 622 1312 -576 2826 -1991 2517z" />
      </g>
    </IconBase>
  );
}
