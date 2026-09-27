import styles from "./thread.module.css";
import { THREAD_BANDS } from "./thread-bands";
import {
  bandMarkup,
  HEAD_LAYERS,
  MOTIF_SIDE,
  THREAD_CLASS,
  threadCss,
  threadScopeClass,
} from "./thread-css";
import type { ThreadId } from "./thread-geometry";

/* One section's red thread. A SERVER component: the scrub is CSS on the section's own named view
   timeline, so nothing here needs the browser.

   ONE BOX PER BAND, CARD-ANCHORED. Each of the three aspect bands mounts its OWN, self-contained
   subtree -- one `<svg>` holding every connector of that band as subpaths of ONE combined path, plus
   one small `<div>` per motif that band places. Bands are mutually exclusive by aspect
   (`thread-css.ts`'s `aspectQuery`), so unlike the retired per-connector-box model there is no union
   of elements to build and no spare mount to hide: a band that does not match simply is not
   displayed, and the one that does carries nothing another band needs.

   Every reveal is a dashed, butt-capped stroked COPY of the path it reveals -- motif and connector
   alike -- so nothing is wiped into view and a route may double back as freely as the owner draws
   it. The connector reveal is ONE copy of the WHOLE band's combined path; a `moveto` between two
   connectors contributes no length, so the dash advances continuously across the gap a motif sits
   in.

   The markup is TWO layers of the same box: the ink, which carries the bleed as a static filter,
   and the light above it, which carries the drawing head and the resting re-trace. The split is
   what keeps the moving light out of the blurred buffer.

   The section must be a positioned ancestor, and must gain no `contain`, `content-visibility` or
   `isolation` -- each isolates the page's `mix-blend-mode` botanical layer. Wishes mounts TWICE,
   once `weave="under"` before the illustration and once `weave="over"` after it; document order
   alone puts the two copies either side of it, and neither takes a z-index. */

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
  const maskId = (bandId: string, key: string, layer: string) =>
    `thread-${instance}-${bandId}-${key}-${layer}`;

  /* The head and the re-trace are the same stack of stroked copies of the path on two different
     clocks -- the scrub for one, a loop gated to the hold band for the other -- so one function
     draws both. A copy of the PATH, never an element travelling along it: an element is rigid and
     its far end leaves the line on a bend, measured at 4.16px of departure against 0.21px here. */
  const lightStack = (
    bandId: string,
    key: string,
    ink: string,
    reveal: string,
    region: { min: number; max: number; width: number; height: number },
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
              id={maskId(bandId, key, `${kind}-${layer.name}`)}
              maskUnits="userSpaceOnUse"
              x={region.min}
              y={region.min}
              width={region.width}
              height={region.height}
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
              mask={`url(#${maskId(bandId, key, `${kind}-${layer.name}`)})`}
            />
          </g>
        ))}
      </g>
    ));

  const bands = THREAD_BANDS.map((band) => ({
    band,
    markup: bandMarkup(id, band),
  }));

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
        <div className={`${styles.inkLayer} ${THREAD_CLASS.inkLayer}`}>
          {bands.map(({ band, markup }) => {
            const region = {
              min: markup.region.min,
              max: markup.region.max,
              width: markup.region.box.width + markup.region.max * 2,
              height: markup.region.box.height + markup.region.max * 2,
            };
            return (
              <div
                key={band.id}
                className={`${THREAD_CLASS.band} ${THREAD_CLASS.band}--${band.id}`}
              >
                <svg
                  aria-hidden
                  className={`${styles.field} ${markup.fieldClassName}`}
                  preserveAspectRatio="none"
                  role="presentation"
                  viewBox={`0 0 ${markup.region.box.width} ${markup.region.box.height}`}
                >
                  {["ink", "wisp"].map((layer) => (
                    <mask
                      key={layer}
                      id={maskId(band.id, "field", layer)}
                      maskUnits="userSpaceOnUse"
                      x={region.min}
                      y={region.min}
                      width={region.width}
                      height={region.height}
                    >
                      <path
                        className={`${styles.reveal} ${
                          layer === "ink"
                            ? THREAD_CLASS.inkReveal
                            : THREAD_CLASS.wispReveal
                        }`}
                        d={markup.revealD}
                        pathLength="1"
                      />
                    </mask>
                  ))}
                  <path
                    className={`${styles.ink} ${THREAD_CLASS.connector}`}
                    d={markup.connectorD}
                    mask={`url(#${maskId(band.id, "field", "ink")})`}
                  />
                  <path
                    className={`${styles.wisp} ${THREAD_CLASS.wisp}`}
                    d={markup.connectorD}
                    mask={`url(#${maskId(band.id, "field", "wisp")})`}
                  />
                  {markup.stubs.map((stub) => (
                    <path
                      key={stub.key}
                      className={`${styles.stub} ${stub.className}`}
                      d={stub.d}
                    />
                  ))}
                </svg>
                {markup.motifs.map((motif) => (
                  <div
                    key={motif.key}
                    className={`${styles.motif} ${THREAD_CLASS.motif} ${motif.className}`}
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
                          id={maskId(band.id, motif.key, layer)}
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
                            d={motif.d}
                            pathLength="1"
                          />
                        </mask>
                      ))}
                      <path
                        className={`${styles.motifPath} ${THREAD_CLASS.motifPath}`}
                        d={motif.d}
                        mask={`url(#${maskId(band.id, motif.key, "ink")})`}
                      />
                      <path
                        className={`${styles.wisp} ${THREAD_CLASS.wisp}`}
                        d={motif.d}
                        mask={`url(#${maskId(band.id, motif.key, "wisp")})`}
                      />
                    </svg>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
        <div className={`${styles.lightLayer} ${THREAD_CLASS.lightLayer}`}>
          {bands.map(({ band, markup }) => {
            const region = {
              min: markup.region.min,
              max: markup.region.max,
              width: markup.region.box.width + markup.region.max * 2,
              height: markup.region.box.height + markup.region.max * 2,
            };
            return (
              <div
                key={band.id}
                className={`${THREAD_CLASS.band} ${THREAD_CLASS.band}--${band.id}`}
              >
                <svg
                  aria-hidden
                  className={`${styles.field} ${markup.fieldClassName}`}
                  preserveAspectRatio="none"
                  role="presentation"
                  viewBox={`0 0 ${markup.region.box.width} ${markup.region.box.height}`}
                >
                  {lightStack(
                    band.id,
                    "field",
                    markup.connectorD,
                    markup.revealD,
                    region,
                  )}
                </svg>
                {markup.motifs.map((motif) => (
                  <div
                    key={motif.key}
                    className={`${styles.motif} ${THREAD_CLASS.motif} ${motif.className}`}
                  >
                    <svg
                      aria-hidden
                      className={styles.motifField}
                      role="presentation"
                      viewBox={`0 0 ${MOTIF_SIDE} ${MOTIF_SIDE}`}
                    >
                      {lightStack(band.id, motif.key, motif.d, motif.d, {
                        min: -MOTIF_SIDE,
                        max: MOTIF_SIDE,
                        width: MOTIF_SIDE * 3,
                        height: MOTIF_SIDE * 3,
                      })}
                    </svg>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
