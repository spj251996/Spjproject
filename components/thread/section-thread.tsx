import styles from "./thread.module.css";
import { THREAD_BANDS } from "./thread-bands";
import {
  MOTIF_SIDE,
  THREAD_CLASS,
  threadCss,
  threadMaskRegions,
  threadScopeClass,
  threadSegments,
  threadStubs,
} from "./thread-css";
import type { ThreadId } from "./thread-geometry";

/* One section's red thread. A SERVER component: the scrub is CSS on the section's own named view
   timeline, so nothing here needs the browser.

   Every connector and every stub is its OWN svg, in a box the generated sheet pins to that
   connector's two ends — in `%` of the section and `svmin`, the same two units the motif's square
   is placed and sized in, so a join lands on the motif at every window rather than only where the
   section's aspect matches the band it was composed for. The curve inside the box is normalised to
   the box's own corners, so only its SHAPE still varies per band; the sheet swaps that `d`. A
   waypoint between the two ends may fall outside the box, which `overflow: visible` renders. The
   `d` attributes below are the first band's, so a browser without the CSS `d` property still paints
   a complete thread rather than nothing.

   Every reveal is a dashed, butt-capped stroked COPY of the path it reveals — motif and connector
   alike — so nothing is wiped into view and a route may double back as freely as the owner draws
   it.

   Two contracts bind a caller:
   - The section must be a positioned ancestor, and must gain no `contain`, `content-visibility` or
     `isolation` — each isolates the page's `mix-blend-mode` botanical layer.
   - Wishes mounts TWICE, once `weave="under"` before the illustration and once `weave="over"`
     after it. Document order alone puts the two copies either side of it; neither takes a z-index,
     because a stacking context between them would put both on the same side. */

interface SectionThreadProps {
  id: ThreadId;
  weave?: "under" | "over";
}

const WEAVE_CLASS = {
  under: THREAD_CLASS.weaveUnder,
  over: THREAD_CLASS.weaveOver,
} as const;

/* The first band decides the element set and the fallback `d`s; every other band overrides those
   values through the generated stylesheet. */
const BASE_BAND = THREAD_BANDS[0];

export function SectionThread({ id, weave }: SectionThreadProps) {
  const instance = weave === undefined ? id : `${id}-${weave}`;
  const maskId = (index: number, layer: string) =>
    `thread-${instance}-${index}-${layer}`;

  const segments = threadSegments(id, BASE_BAND);
  const stubs = threadStubs(id, BASE_BAND);
  /* One region per connector, wide enough for the widest band's curve and mask — a `<mask>`'s
     region is markup and cannot be swapped per band the way the geometry is. */
  const regions = threadMaskRegions(id);
  const region = (index: number) => regions.get(index) ?? { min: -1, max: 2 };

  return (
    <>
      <style>{threadCss(id)}</style>
      <div
        aria-hidden="true"
        className={[
          styles.root,
          THREAD_CLASS.root,
          threadScopeClass(id),
          weave === undefined ? "" : `${styles.weave} ${WEAVE_CLASS[weave]}`,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {segments.map((segment) =>
          segment.kind !== "connector" ? null : (
            <svg
              key={segment.index}
              aria-hidden
              className={`${styles.field} ${THREAD_CLASS.field} thread__seg-${segment.index}`}
              preserveAspectRatio="none"
              role="presentation"
              viewBox="0 0 1 1"
            >
              {["ink", "wisp"].map((layer) => (
                <mask
                  key={layer}
                  id={maskId(segment.index, layer)}
                  maskUnits="userSpaceOnUse"
                  x={region(segment.index).min}
                  y={region(segment.index).min}
                  width={region(segment.index).max - region(segment.index).min}
                  height={region(segment.index).max - region(segment.index).min}
                >
                  <path
                    className={`${styles.reveal} ${
                      layer === "ink"
                        ? THREAD_CLASS.inkReveal
                        : THREAD_CLASS.wispReveal
                    }`}
                    d={segment.revealD}
                    pathLength="1"
                  />
                </mask>
              ))}
              <path
                className={`${styles.ink} ${THREAD_CLASS.connector}`}
                d={segment.d}
                mask={`url(#${maskId(segment.index, "ink")})`}
              />
              <path
                className={`${styles.wisp} ${THREAD_CLASS.wisp}`}
                d={segment.d}
                mask={`url(#${maskId(segment.index, "wisp")})`}
              />
            </svg>
          ),
        )}
        {stubs.map((stub) => (
          <svg
            key={stub.which}
            aria-hidden
            className={`${styles.field} ${THREAD_CLASS.stub}--${stub.which}`}
            preserveAspectRatio="none"
            role="presentation"
            viewBox="0 0 1 1"
          >
            <path className={styles.stub} d={stub.d} />
          </svg>
        ))}
        {segments.map((segment) =>
          segment.kind !== "motif" ? null : (
            <div
              key={segment.index}
              className={`${styles.motif} ${THREAD_CLASS.motif} thread__seg-${segment.index}`}
            >
              <svg
                aria-hidden
                className={styles.motifField}
                role="presentation"
                viewBox={`0 0 ${MOTIF_SIDE} ${MOTIF_SIDE}`}
              >
                {["ink", "wisp"].map((layer) => (
                  <mask
                    key={layer}
                    id={maskId(segment.index, layer)}
                    maskUnits="userSpaceOnUse"
                    x={-MOTIF_SIDE}
                    y={-MOTIF_SIDE}
                    width={MOTIF_SIDE * 3}
                    height={MOTIF_SIDE * 3}
                  >
                    <path
                      className={`${styles.reveal} ${
                        layer === "ink"
                          ? THREAD_CLASS.inkReveal
                          : THREAD_CLASS.wispReveal
                      }`}
                      d={segment.place.motif.d}
                      pathLength="1"
                    />
                  </mask>
                ))}
                <path
                  className={`${styles.motifPath} ${THREAD_CLASS.motifPath}`}
                  d={segment.place.motif.d}
                  mask={`url(#${maskId(segment.index, "ink")})`}
                />
                <path
                  className={`${styles.wisp} ${THREAD_CLASS.wisp}`}
                  d={segment.place.motif.d}
                  mask={`url(#${maskId(segment.index, "wisp")})`}
                />
              </svg>
            </div>
          ),
        )}
      </div>
    </>
  );
}
