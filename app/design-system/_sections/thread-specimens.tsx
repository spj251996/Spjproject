"use client";

import {
  type ReactNode,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  headOptions,
  retraceOptions,
  TaperCutMask,
  tokenLength,
} from "@/components/thread/page-thread";
import styles from "@/components/thread/thread.module.css";
import {
  type HeadOptions,
  type HeadSegment,
  headSegments,
  type PieceSamples,
  type PieceSpan,
  polylineBetween,
  retraceFade,
  retraceGlow,
  retraceSegments,
  retraceSpan,
  samplePath,
  TAPER_STEPS,
  taperCut,
  taperSegments,
} from "@/components/thread/thread-light";
import { dashForPiece, pieceProgress } from "@/components/thread/thread-line";
import { THREAD_PATHS } from "@/components/thread/thread-paths";

/* Four specimens of the thread's light, each laid on a stretch of the page's own authored geometry
   (`thread-paths.ts`, `wide` band) rather than on a stand-in drawing. The arithmetic is
   `thread-light.ts`'s, imported; the classes are the page's own (`thread.module.css`), so the filters
   are the same ones, not copies. Static: a pose of each layer, never a loop. */

/* A connector from the middle of the page, so neither of its ends is a free end and the ink, the head
   and the re-trace show on a line that is not tapered. The two tapered ends are the pieces the page
   itself tapers (`page-thread.tsx`): the invite's first, at its start, and Wishes' last, at its end. */
const WIDE = THREAD_PATHS.wide;
const MID_PAGE = WIDE.contact[1].d;
const INVITE_START = WIDE.invite[0].d;
const WISHES_CLOSE = WIDE.wishes[WIDE.wishes.length - 1].d;

/* Gallery layout constants. The margin clears the halo's widest shadow (33px) so no panel clips it. */
const MARGIN = 48;
/* How far along its stretch the head's tip, and the re-trace's segment, are posed. The head's tip sits
   where the stretch bends; the loop position (0 to 1) puts the re-trace near its peak length. */
const HEAD_POSED_AT = 0.33;
const RETRACE_POSED_AT = 0.42;
/* The tapered ends are 24px long: a crop this wide holds one with its halo, at 1x and at TAPER_ZOOM. */
const TAPER_CROP = 96;
const TAPER_ZOOM = 4;

interface Measured {
  readonly length: number;
  readonly samples: PieceSamples;
  readonly pieces: readonly PieceSpan[];
  readonly box: DOMRect;
  readonly head: HeadOptions;
  readonly retrace: HeadOptions;
  readonly taperLength: number;
  readonly strokeWidth: number;
}

function useMeasured(d: string) {
  const ref = useRef<SVGPathElement>(null);
  const [measured, setMeasured] = useState<Measured>();
  useLayoutEffect(() => {
    const path = ref.current;
    if (path === null) return;
    const length = path.getTotalLength();
    const strokeWidth = tokenLength("--stroke-thread");
    setMeasured({
      length,
      samples: samplePath(d, length),
      pieces: [{ start: 0, end: length }],
      box: path.getBBox(),
      head: headOptions(),
      retrace: retraceOptions(),
      taperLength: tokenLength("--length-thread-taper"),
      strokeWidth,
    });
  }, [d]);
  return [ref, measured] as const;
}

function boundsOfPrefix({ xy }: PieceSamples, arc: number) {
  let [left, top, right, bottom] = [xy[0], xy[1], xy[0], xy[1]];
  for (let i = 1; i <= Math.ceil(arc); i += 1) {
    left = Math.min(left, xy[2 * i]);
    right = Math.max(right, xy[2 * i]);
    top = Math.min(top, xy[2 * i + 1]);
    bottom = Math.max(bottom, xy[2 * i + 1]);
  }
  return { left, top, right, bottom };
}

interface Crop {
  readonly at: "start" | "end";
  readonly span: number;
  readonly zoom: number;
}

interface FragmentProps {
  readonly d: string;
  readonly label: string;
  readonly crop?: Crop;
  /* Frames only the first part of the stretch (a fraction of its length), for a pose that draws no
     more than that. */
  readonly drawnTo?: number;
  readonly children: (measured: Measured) => ReactNode;
}

/* One `<svg>` at 1:1 CSS pixels: the page draws the thread in pixels, so its strokes and filters are
   the size they are on the page. A crop shows one end of the stretch, and may magnify it. */
function Fragment({ d, label, crop, drawnTo = 1, children }: FragmentProps) {
  const [ref, measured] = useMeasured(d);
  let view = { x: 0, y: 0, width: 0, height: 0, zoom: 1 };
  if (measured !== undefined) {
    const { box, samples, length, taperLength } = measured;
    if (crop === undefined) {
      const { left, top, right, bottom } =
        drawnTo >= 1
          ? {
              left: box.x,
              top: box.y,
              right: box.x + box.width,
              bottom: box.y + box.height,
            }
          : boundsOfPrefix(samples, length * drawnTo);
      view = {
        x: left - MARGIN,
        y: top - MARGIN,
        width: right - left + 2 * MARGIN,
        height: bottom - top + 2 * MARGIN,
        zoom: 1,
      };
    } else {
      /* Centred on the middle of the taper, so the whole of it and its bleed lie inside the crop. */
      const middle = Math.round(taperLength / 2);
      const index = crop.at === "start" ? middle : Math.floor(length) - middle;
      view = {
        x: samples.xy[2 * index] - crop.span / 2,
        y: samples.xy[2 * index + 1] - crop.span / 2,
        width: crop.span,
        height: crop.span,
        zoom: crop.zoom,
      };
    }
  }
  return (
    <svg
      aria-label={label}
      className="max-w-full"
      height={view.height * view.zoom}
      role="img"
      viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`}
      width={view.width * view.zoom}
    >
      <path d={d} fill="none" ref={ref} visibility="hidden" />
      {measured === undefined ? null : children(measured)}
    </svg>
  );
}

function Panel({
  caption,
  children,
}: {
  caption: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-space-2xs">
      {children}
      <span className="type-caption text-ink">{caption}</span>
    </div>
  );
}

/* Runs in paint order: `rank` is how the page orders its elements, later over earlier. */
function Runs({
  segments,
  samples,
}: {
  segments: readonly HeadSegment[];
  samples: PieceSamples;
}) {
  return [...segments]
    .sort((a, b) => a.rank - b.rank)
    .map((segment) => (
      <path
        d={polylineBetween(samples, segment.start, segment.end)}
        key={`${segment.step}:${segment.cap}`}
        stroke={segment.stroke}
        strokeLinecap={segment.cap}
        strokeWidth={segment.width}
      />
    ));
}

/* ---------------------------------------------------------------------------------------------
   1. THE INK AND ITS BLEED */

export function ThreadInkSpecimen() {
  return (
    <div className="flex flex-wrap gap-space-lg">
      <Panel caption="The ink alone, with the bleed switched off. A comparison, not a state the page is ever in.">
        <Fragment d={MID_PAGE} label="The thread's ink without its bleed">
          {() => <path className={styles.pageInkBare} d={MID_PAGE} />}
        </Fragment>
      </Panel>
      <Panel caption="The ink as the page draws it, with --bleed-thread.">
        <Fragment d={MID_PAGE} label="The thread's ink with its bleed">
          {() => <path className={styles.pageInk} d={MID_PAGE} />}
        </Fragment>
      </Panel>
    </div>
  );
}

/* ---------------------------------------------------------------------------------------------
   2. THE DRAWING HEAD */

export function ThreadHeadSpecimen() {
  return (
    <Fragment
      d={MID_PAGE}
      drawnTo={HEAD_POSED_AT}
      label="The drawing head at the tip of a part-drawn stretch"
    >
      {(m) => {
        const drawn = m.length * HEAD_POSED_AT;
        const { dasharray, dashoffset } = dashForPiece(
          m.length,
          pieceProgress(drawn, m.pieces[0]),
        );
        return (
          <>
            <path
              className={styles.pageInk}
              d={MID_PAGE}
              strokeDasharray={dasharray}
              strokeDashoffset={dashoffset}
            />
            <g className={styles.pageHead}>
              <Runs
                samples={m.samples}
                segments={headSegments(drawn, m.pieces, m.head)}
              />
            </g>
          </>
        );
      }}
    </Fragment>
  );
}

/* ---------------------------------------------------------------------------------------------
   3. A TAPERED END */

interface TaperedEndProps {
  readonly d: string;
  readonly label: string;
  readonly at: "start" | "end";
  readonly zoom: number;
}

/* The ink is cut under the taper by a mask on its own path and bled as a group, so the halo is the
   halo of the ink that is left (`page-thread.tsx`, `ThreadInk`); the runs take the bleed on a group
   of their own, as the page's do. */
function TaperedEnd({ d, label, at, zoom }: TaperedEndProps) {
  const maskId = `ds-thread-taper-cut-${useId().replaceAll(":", "")}`;
  return (
    <Fragment crop={{ at, span: TAPER_CROP, zoom }} d={d} label={label}>
      {(m) => {
        const endAt = at === "start" ? 0 : m.length;
        const direction = at === "start" ? -1 : 1;
        const cut = taperCut(endAt, m.length, direction, m.taperLength);
        const runs = taperSegments(endAt, m.length, direction, {
          steps: TAPER_STEPS,
          taperLength: m.taperLength,
          strokeWidth: m.strokeWidth,
        });
        return (
          <>
            <TaperCutMask
              cutRef={(cutPath) =>
                cutPath?.setAttribute(
                  "d",
                  polylineBetween(m.samples, cut.from, cut.to),
                )
              }
              id={maskId}
              region={{
                x: m.box.x - MARGIN,
                y: m.box.y - MARGIN,
                width: m.box.width + 2 * MARGIN,
                height: m.box.height + 2 * MARGIN,
              }}
            />
            <g className={styles.pageBleed}>
              <path
                className={styles.pageInkBare}
                d={d}
                mask={`url(#${maskId})`}
              />
            </g>
            <g className={styles.pageTaper}>
              {runs.map((run) => (
                <path
                  d={polylineBetween(m.samples, run.start, run.end)}
                  key={run.index}
                  strokeWidth={run.width}
                />
              ))}
            </g>
          </>
        );
      }}
    </Fragment>
  );
}

export function ThreadTaperSpecimen() {
  return (
    <div className="flex flex-wrap items-start gap-space-lg">
      <Panel caption="The invite's top terminal, at its own size and magnified 4x.">
        <div className="flex flex-wrap items-start gap-space-md">
          <TaperedEnd
            at="start"
            d={INVITE_START}
            label="The invite's top terminal, tapered, at its own size"
            zoom={1}
          />
          <TaperedEnd
            at="start"
            d={INVITE_START}
            label="The invite's top terminal, tapered, magnified"
            zoom={TAPER_ZOOM}
          />
        </div>
      </Panel>
      <Panel caption="Wishes' closing end, at its own size and magnified 4x.">
        <div className="flex flex-wrap items-start gap-space-md">
          <TaperedEnd
            at="end"
            d={WISHES_CLOSE}
            label="Wishes' closing end, tapered, at its own size"
            zoom={1}
          />
          <TaperedEnd
            at="end"
            d={WISHES_CLOSE}
            label="Wishes' closing end, tapered, magnified"
            zoom={TAPER_ZOOM}
          />
        </div>
      </Panel>
    </div>
  );
}

/* ---------------------------------------------------------------------------------------------
   4. THE RE-TRACE */

export function ThreadRetraceSpecimen() {
  return (
    <div className="flex flex-wrap gap-space-lg">
      <Panel caption="The glow alone: eight translucent strokes under the segment, no filter.">
        <Fragment d={MID_PAGE} label="The re-trace's glow strokes alone">
          {(m) => {
            const { tail, tip } = retraceSpan(
              RETRACE_POSED_AT,
              m.length,
              m.retrace.length,
            );
            return (
              <>
                <path className={styles.pageInk} d={MID_PAGE} />
                <g className={styles.pageRetraceGlow}>
                  <Runs
                    samples={m.samples}
                    segments={retraceGlow(
                      tail,
                      tip,
                      m.pieces,
                      m.retrace.midColor,
                    )}
                  />
                </g>
              </>
            );
          }}
        </Fragment>
      </Panel>
      <Panel caption="The re-trace: the glow strokes under the head's own stack, over the drawn thread.">
        <Fragment d={MID_PAGE} label="The re-trace over the drawn thread">
          {(m) => {
            const { tail, tip } = retraceSpan(
              RETRACE_POSED_AT,
              m.length,
              m.retrace.length,
            );
            const opacity = retraceFade(tip - tail, m.retrace.length);
            return (
              <>
                <path className={styles.pageInk} d={MID_PAGE} />
                <g className={styles.pageRetraceGlow} opacity={opacity}>
                  <Runs
                    samples={m.samples}
                    segments={retraceGlow(
                      tail,
                      tip,
                      m.pieces,
                      m.retrace.midColor,
                    )}
                  />
                </g>
                <g className={styles.pageRetrace} opacity={opacity}>
                  <Runs
                    samples={m.samples}
                    segments={retraceSegments(tail, tip, m.pieces, m.retrace)}
                  />
                </g>
              </>
            );
          }}
        </Fragment>
      </Panel>
    </div>
  );
}
