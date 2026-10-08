import { IconBase } from "./icon-base";

/* A stock line drawing brought into the set, squared at its ends and set to the set's own weight
   (DESIGN.md → Foundations → Iconography). Stroke-drawn, because the source could not stay a fill:
   it arrived as a line drawing already converted to outlines, so its paths bounded 2-unit-wide
   BANDS rather than shapes, at twice the set's weight. A band cannot be thinned on a transparent
   ground, and stroking a band's contour draws both edges of the line and reads hollow.

   The three signal arcs are therefore the centrelines recovered from each band's paired edge
   curves, which the source states exactly: every band is one cubic per edge between r=1 caps.
   The handset is a closed band, so it takes `map`'s treatment instead — its outer contour stroked,
   the inner discarded — there being no edge correspondence to average across its round joins. */

export function CallIcon({
  size,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <IconBase
      className={className}
      nudge={0.8448}
      size={size}
      viewBox="0.82 0.82 29.48 30.35"
    >
      <g
        fill="none"
        stroke="currentColor"
        strokeLinecap="butt"
        strokeLinejoin="round"
        strokeWidth={1.029}
        transform="translate(-156,-292)"
      >
        <path d="M 173.9092,302.8945 C 176.0709,303.35 177.4535,305.4721 176.998,307.6338" />
        <path d="M 174.7334,298.9805 C 179.0568,299.8913 181.823,304.1347 180.9121,308.458" />
        <path d="M 175.5576,295.0664 C 182.0427,296.4327 186.1925,302.7972 184.8262,309.2822" />
        <path d="m 162.98047,294.01172 c -0.98492,-0.0178 -1.90172,0.43314 -2.45117,1.34375 -3.28962,5.4519 -3.39002,12.29826 -0.18164,17.87305 a 1.0001,1.0001 0 0 0 0.002,0.006 c 3.23676,5.55933 9.22998,8.89168 15.60742,8.77539 1.21528,-0.0221 2.15131,-0.75945 2.57227,-1.83399 l 1.4375,-3.66797 c 0.51477,-1.31399 0.12221,-2.82162 -0.96875,-3.71679 l -2.58008,-2.11524 c -1.32752,-1.08929 -3.35959,-0.72448 -4.22656,0.75781 l -0.9668,1.65039 c -1.64502,-0.85898 -3.11472,-2.085 -4.08984,-3.76562 v -0.002 c -1.01959,-1.76568 -1.33095,-3.74687 -1.19727,-5.6836 l 1.83008,0.11719 c 1.70931,0.1098 3.11184,-1.44331 2.83008,-3.13281 l -0.54688,-3.2793 c -0.2321,-1.39165 -1.3395,-2.48347 -2.73437,-2.69531 l -3.91016,-0.59375 c -0.14259,-0.0217 -0.28508,-0.0346 -0.42578,-0.0371 z" />
      </g>
    </IconBase>
  );
}
