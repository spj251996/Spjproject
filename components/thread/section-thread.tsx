import styles from "./thread.module.css";
import { ThreadAnchors } from "./thread-anchors";
import {
  HEAD_LAYERS,
  MOTIF_SIDE,
  THREAD_CLASS,
  threadCss,
  threadMounts,
  threadScopeClass,
} from "./thread-css";
import type { ThreadId } from "./thread-geometry";
import { sectionAnchors } from "./thread-grid";

/* One section's red thread. A SERVER component: the scrub is CSS on the section's own named view
   timeline, so nothing here needs the browser.

   Every connector and every stub is its OWN svg, in a box the generated sheet pins to that
   connector's two ends — in `%` of the section and `svmin`, the same two units the motif's square
   is placed and sized in, so a join lands on the motif at every window rather than only where the
   section's aspect matches the band it was composed for. The curve inside the box is normalised to
   the box's own corners, so only its SHAPE still varies per band; the sheet swaps that `d`. A
   waypoint between the two ends may fall outside the box, which `overflow: visible` renders. The
   `d` attributes below are the first band that mounts each element, so a browser without the CSS
   `d` property still paints a complete thread rather than nothing.

   The element set is the UNION of every band's, never one band's — `threadMounts`. A band's route
   may carry a different number of stops and a different sequence of motifs, and a motif's own `d`
   is markup rather than CSS, so markup built from a single band would leave every other band's
   rules addressing elements that do not exist. The sheet hides whatever its own band does not use.

   Every reveal is a dashed, butt-capped stroked COPY of the path it reveals — motif and connector
   alike — so nothing is wiped into view and a route may double back as freely as the owner draws
   it.

   The markup is TWO layers of the same box: the ink, which carries the bleed as a static filter,
   and the light above it, which carries the drawing head and the resting re-trace. The split is
   what keeps the moving light out of the blurred buffer. The light is stroked copies of the same
   `d`, never an element travelling along it — an element is rigid and its far end leaves the line
   on a bend.

   Two contracts bind a caller:
   - The section must be a positioned ancestor, and must gain no `contain`, `content-visibility` or
     `isolation` — each isolates the page's `mix-blend-mode` botanical layer.
   - Wishes mounts TWICE, once `weave="under"` before the illustration and once `weave="over"`
     after it. Document order alone puts the two copies either side of it; neither takes a z-index,
     because a stacking context between them would put both on the same side.

   Three motifs wrap real content rather than sitting on their grid cell, and those carry the one
   piece of client JavaScript the thread has — `thread-anchors.ts`, which measures the content and
   writes two custom properties the generated sheet already reads THROUGH the cell. A section that
   anchors nothing ships no client component at all. */

interface SectionThreadProps {
  id: ThreadId;
  weave?: "under" | "over";
}

const WEAVE_CLASS = {
  under: THREAD_CLASS.weaveUnder,
  over: THREAD_CLASS.weaveOver,
} as const;

export function SectionThread({ id, weave }: SectionThreadProps) {
  const instance = weave === undefined ? id : `${id}-${weave}`;
  const maskId = (key: string, layer: string) =>
    `thread-${instance}-${key}-${layer}`;

  /* One measurement serves both of Wishes' woven copies: the module writes to every root carrying
     the section's scope class, so mounting it on the second copy would repeat the same work. */
  const anchors = weave === "over" ? [] : sectionAnchors(id);

  /* Every element any band needs. Each carries the widest band's mask region too — a `<mask>`'s
     region is markup and cannot be swapped per band the way the geometry is. */
  const mounts = threadMounts(id);

  /* The head and the re-trace are the same stack of stroked copies of the path on two different
     clocks — the scrub for one, a loop gated to the hold band for the other — so one function
     draws both. A copy of the PATH, never an element travelling along it: an element is rigid and
     its far end leaves the line on a bend, measured at 4.16px of departure against 0.21px here. */
  const lightStack = (
    key: string,
    ink: string,
    reveal: string,
    box: { x: number; y: number; side: number },
  ) =>
    (["head", "retrace"] as const).map((kind) => (
      <g
        key={kind}
        className={
          kind === "head"
            ? THREAD_CLASS.head
            : `${styles.retrace} ${THREAD_CLASS.retrace}`
        }
      >
        {HEAD_LAYERS.map((layer) => (
          <g key={layer.name}>
            <mask
              id={maskId(key, `${kind}-${layer.name}`)}
              maskUnits="userSpaceOnUse"
              x={box.x}
              y={box.y}
              width={box.side}
              height={box.side}
            >
              <path
                className={[
                  styles.reveal,
                  kind === "head"
                    ? THREAD_CLASS.headReveal
                    : THREAD_CLASS.retraceReveal,
                  `${kind === "head" ? THREAD_CLASS.headReveal : THREAD_CLASS.retraceReveal}--${layer.name}`,
                ].join(" ")}
                d={reveal}
                pathLength="1"
              />
            </mask>
            <path
              className={`${styles.light} ${THREAD_CLASS.light} ${THREAD_CLASS.light}--${layer.name}`}
              d={ink}
              mask={`url(#${maskId(key, `${kind}-${layer.name}`)})`}
            />
          </g>
        ))}
      </g>
    ));

  return (
    <>
      <style>{threadCss(id)}</style>
      {anchors.length === 0 ? null : (
        <ThreadAnchors anchors={anchors} scope={threadScopeClass(id)} />
      )}
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
        <div className={`${styles.inkLayer} ${THREAD_CLASS.inkLayer}`}>
          {mounts.map((mount) =>
            mount.kind !== "connector" ? null : (
              <svg
                key={mount.key}
                aria-hidden
                className={`${styles.field} ${THREAD_CLASS.field} ${mount.className}`}
                preserveAspectRatio="none"
                role="presentation"
                viewBox="0 0 1 1"
              >
                {["ink", "wisp"].map((layer) => (
                  <mask
                    key={layer}
                    id={maskId(mount.key, layer)}
                    maskUnits="userSpaceOnUse"
                    x={mount.region.min}
                    y={mount.region.min}
                    width={mount.region.max - mount.region.min}
                    height={mount.region.max - mount.region.min}
                  >
                    <path
                      className={`${styles.reveal} ${
                        layer === "ink"
                          ? THREAD_CLASS.inkReveal
                          : THREAD_CLASS.wispReveal
                      }`}
                      d={mount.revealD}
                      pathLength="1"
                    />
                  </mask>
                ))}
                <path
                  className={`${styles.ink} ${THREAD_CLASS.connector}`}
                  d={mount.d}
                  mask={`url(#${maskId(mount.key, "ink")})`}
                />
                <path
                  className={`${styles.wisp} ${THREAD_CLASS.wisp}`}
                  d={mount.d}
                  mask={`url(#${maskId(mount.key, "wisp")})`}
                />
              </svg>
            ),
          )}
          {mounts.map((mount) =>
            mount.kind !== "stub" ? null : (
              <svg
                key={mount.key}
                aria-hidden
                className={`${styles.field} ${mount.className}`}
                preserveAspectRatio="none"
                role="presentation"
                viewBox="0 0 1 1"
              >
                <path className={styles.stub} d={mount.d} />
              </svg>
            ),
          )}
          {mounts.map((mount) =>
            mount.kind !== "motif" ? null : (
              <div
                key={mount.key}
                className={`${styles.motif} ${THREAD_CLASS.motif} ${mount.className}`}
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
                      id={maskId(mount.key, layer)}
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
                        d={mount.d}
                        pathLength="1"
                      />
                    </mask>
                  ))}
                  <path
                    className={`${styles.motifPath} ${THREAD_CLASS.motifPath}`}
                    d={mount.d}
                    mask={`url(#${maskId(mount.key, "ink")})`}
                  />
                  <path
                    className={`${styles.wisp} ${THREAD_CLASS.wisp}`}
                    d={mount.d}
                    mask={`url(#${maskId(mount.key, "wisp")})`}
                  />
                </svg>
              </div>
            ),
          )}
        </div>
        <div className={`${styles.lightLayer} ${THREAD_CLASS.lightLayer}`}>
          {mounts.map((mount) =>
            mount.kind !== "connector" ? null : (
              <svg
                key={mount.key}
                aria-hidden
                className={`${styles.field} ${THREAD_CLASS.field} ${mount.className}`}
                preserveAspectRatio="none"
                role="presentation"
                viewBox="0 0 1 1"
              >
                {lightStack(mount.key, mount.d, mount.revealD, {
                  x: mount.region.min,
                  y: mount.region.min,
                  side: mount.region.max - mount.region.min,
                })}
              </svg>
            ),
          )}
          {mounts.map((mount) =>
            mount.kind !== "motif" ? null : (
              <div
                key={mount.key}
                className={`${styles.motif} ${THREAD_CLASS.motif} ${mount.className}`}
              >
                <svg
                  aria-hidden
                  className={styles.motifField}
                  role="presentation"
                  viewBox={`0 0 ${MOTIF_SIDE} ${MOTIF_SIDE}`}
                >
                  {lightStack(mount.key, mount.d, mount.d, {
                    x: -MOTIF_SIDE,
                    y: -MOTIF_SIDE,
                    side: MOTIF_SIDE * 3,
                  })}
                </svg>
              </div>
            ),
          )}
        </div>
      </div>
    </>
  );
}
