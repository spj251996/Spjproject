import styles from "./thread.module.css";
import {
  MOTIF_SIDE,
  THREAD_CLASS,
  THREAD_TIERS,
  threadCss,
  threadMaskRegions,
  threadScopeClass,
  threadSegments,
  threadStubs,
} from "./thread-css";
import type { ThreadId } from "./thread-geometry";
import { ALL_THREADS } from "./thread-placement";

/* One section's red thread. A SERVER component: the scrub is CSS on the section's own named view
   timeline, so nothing here needs the browser.

   Every connector and every stub is its OWN svg, in a box the generated sheet pins to that
   connector's two ends — in `%` of the section and `svmin`, the same two units the motif's square
   is placed and sized in, so a join lands on the motif at every window rather than only where the
   section's aspect matches the tier it was composed for. The curve inside the box is normalised
   to the box's corners, so only its SHAPE still varies per tier; the sheet swaps that `d` and the
   wipe's frame. The `d` attributes below are the narrowest tier's, so a browser without the CSS
   `d` property still paints a complete thread rather than nothing.

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

/* The narrowest tier decides the element set and the fallback `d`s; every other tier overrides
   those values through the generated stylesheet. */
const BASE_TIER = THREAD_TIERS[0];

export function SectionThread({ id, weave }: SectionThreadProps) {
  const section = ALL_THREADS.find((thread) => thread.id === id);
  if (section === undefined) {
    throw new Error(`section-thread: no thread is placed for "${id}"`);
  }
  /* The stacked set swaps the placements, not the structure: one DOM serves both arrangements and
     the stylesheet re-places it below `{breakpoints.md}`. A set of a different size would need
     elements the other arrangement has no geometry for. */
  if (
    section.stacked !== undefined &&
    section.stacked.length !== section.placements.length
  ) {
    throw new Error(
      `section-thread: ${id}'s stacked set places ${section.stacked.length} motifs against ${section.placements.length} — one arrangement would render elements the other cannot place`,
    );
  }

  const instance = weave === undefined ? id : `${id}-${weave}`;
  const maskId = (index: number, layer: string) =>
    `thread-${instance}-${index}-${layer}`;

  const segments = threadSegments(section, BASE_TIER);
  const stubs = threadStubs(section);
  /* One region per connector, wide enough for the widest tier's curve — a `<mask>`'s region is
     markup and cannot be swapped per tier the way the geometry is. */
  const regions = threadMaskRegions(section);
  const region = (index: number) => regions.get(index) ?? { min: -1, max: 2 };

  return (
    <>
      <style>{threadCss(section)}</style>
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
                  <g
                    className={`${styles.wipeFrame} ${THREAD_CLASS.wipeFrame}`}
                  >
                    <rect
                      className={`${styles.reveal} ${
                        layer === "ink"
                          ? THREAD_CLASS.inkReveal
                          : THREAD_CLASS.wispReveal
                      }`}
                      x="0"
                      y="0"
                      width="1"
                      height="1"
                    />
                  </g>
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
                      className={`${styles.reveal} ${styles.motifMask} ${
                        layer === "ink"
                          ? THREAD_CLASS.inkReveal
                          : THREAD_CLASS.wispReveal
                      }`}
                      d={segment.motif.d}
                      pathLength="1"
                    />
                  </mask>
                ))}
                <path
                  className={`${styles.motifPath} ${THREAD_CLASS.motifPath}`}
                  d={segment.motif.d}
                  mask={`url(#${maskId(segment.index, "ink")})`}
                />
                <path
                  className={`${styles.wisp} ${THREAD_CLASS.wisp}`}
                  d={segment.motif.d}
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
