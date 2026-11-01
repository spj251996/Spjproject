import styles from "./thread.module.css";
import { TAPER_CUT_WIDTH } from "./thread-taper";

/* One piece's ink. A piece that carries a taper is cut BEFORE its bleed, not after: the filter sits on
   a group around the masked path, so the halo is the halo of the ink that is left and falls away
   naturally at the cut. Masking the filter's output instead leaves the halo of the full-width ink
   standing up to a straight edge, a visible rectangle beside the taper. */
export function ThreadInk({
  cutId,
  index,
  pathRef,
}: {
  cutId: string | undefined;
  index: number;
  pathRef: React.Ref<SVGPathElement>;
}) {
  if (cutId === undefined) {
    return (
      <path
        className={styles.pageInk}
        d=""
        data-thread-piece={index}
        ref={pathRef}
      />
    );
  }
  return (
    <g className={styles.pageBleed}>
      <path
        className={styles.pageInkBare}
        d=""
        data-thread-piece={index}
        mask={`url(#${cutId})`}
        ref={pathRef}
      />
    </g>
  );
}

/* The mask that cuts the ink away under a taper. One per `<svg>`, so its id is fixed: the trunk's,
   and the card thread's. `maskUnits` is the user space because the default
   region is a percentage margin around the piece's bounding box, which is not a margin the cut can
   rely on. Without a `region` the mask takes this extent, which is only the region before the page is
   measured: `fitMaskRegion` narrows it to the piece, which is what keeps the mask cheap. A caller that
   never measures through the page (the gallery) passes the fitted `region` itself, because a mask
   this large costs 27.1ms mean frame time and 116 dropped frames on the page. */
const MASK_EXTENT = 100000;
export const TRUNK_CUT_ID = "thread-taper-cut-trunk";
export const CARD_CUT_ID = "thread-taper-cut-card";

interface MaskRegion {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

const UNMEASURED_REGION: MaskRegion = {
  x: -MASK_EXTENT,
  y: -MASK_EXTENT,
  width: 2 * MASK_EXTENT,
  height: 2 * MASK_EXTENT,
};

export function TaperCutMask({
  id,
  cutRef,
  region = UNMEASURED_REGION,
}: {
  id: string;
  cutRef: React.Ref<SVGPathElement>;
  region?: MaskRegion;
}) {
  return (
    <defs>
      <mask
        height={region.height}
        id={id}
        maskUnits="userSpaceOnUse"
        width={region.width}
        x={region.x}
        y={region.y}
      >
        <rect
          fill="white"
          height={region.height}
          width={region.width}
          x={region.x}
          y={region.y}
        />
        <path
          fill="none"
          ref={cutRef}
          stroke="black"
          strokeLinecap="butt"
          strokeLinejoin="round"
          strokeWidth={TAPER_CUT_WIDTH}
        />
      </mask>
    </defs>
  );
}
