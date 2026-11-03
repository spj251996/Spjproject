"use client";

import {
  type ReactNode,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import styles from "@/components/thread/thread.module.css";
import {
  type HeadOptions,
  type HeadSegment,
  headSegments,
  type PieceSpan,
} from "@/components/thread/thread-head";
import { TaperCutMask } from "@/components/thread/thread-ink";
import { THREAD_PATHS } from "@/components/thread/thread-paths";
import {
  dashForPiece,
  pieceProgress,
} from "@/components/thread/thread-progress";
import {
  type PieceSamples,
  polylineBetween,
  samplePath,
} from "@/components/thread/thread-samples";
import { createThreadSway } from "@/components/thread/thread-sway";
import {
  TAPER_STEPS,
  taperCut,
  taperSegments,
} from "@/components/thread/thread-taper";
import { headOptions, tokenLength } from "@/components/thread/thread-tokens";
import { gapWidth, ropeGaps } from "@/components/thread/thread-twist";

/* The thread's layers — ink, twist, head, tapered ends, sway — each laid on a stretch of the page's own authored
   geometry (`thread-paths.ts`, `wide` band) rather than on a stand-in drawing. The arithmetic is
   `thread-head.ts`'s, `thread-taper.ts`'s and `thread-samples.ts`'s,
   imported; the classes are the page's own (`thread.module.css`), so the filters are the same ones,
   not copies. Static: a pose of each layer, never a loop — except the sway, which is motion or nothing,
   and runs on the page's own `createThreadSway`. */

/* A connector from the middle of the page, so neither of its ends is a free end and the ink and the head
   show on a line that is not tapered. The two tapered ends are the pieces the page
   itself tapers: the invite's first, at its start (`PageThread`), and Wishes' last, at its end
   (`CardThread`). */
const WIDE = THREAD_PATHS.wide;
const MID_PAGE = WIDE.family[1].d;
const INVITE_START = WIDE.invite[0].d;
const WISHES_CLOSE = WIDE.wishes[WIDE.wishes.length - 1].d;

/* Gallery layout constants. The margin clears the halo's widest shadow (33px) so no panel clips it. */
const MARGIN = 48;
/* How far along its stretch the head's tip is posed: where the stretch bends. */
const HEAD_POSED_AT = 0.33;
/* The tapered ends are 24px long: a crop this wide holds one with its contact shadow, at 1x and at TAPER_ZOOM. */
const TAPER_CROP = 96;
const TAPER_ZOOM = 4;

interface Measured {
  readonly length: number;
  readonly samples: PieceSamples;
  readonly pieces: readonly PieceSpan[];
  readonly box: DOMRect;
  readonly head: HeadOptions;
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

interface PathFragmentProps {
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
function PathFragment({
  d,
  label,
  crop,
  drawnTo = 1,
  children,
}: PathFragmentProps) {
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
      /* Centred on the middle of the taper, so the whole of it and its contact shadow lie inside the crop. */
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

export function ThreadInkSpecimen() {
  return (
    <div className="flex flex-wrap gap-space-lg">
      <Panel caption="The ink alone, with the contact shadow switched off. A comparison, not a state the page is ever in.">
        <PathFragment
          d={MID_PAGE}
          label="The thread's ink without its contact shadow"
        >
          {() => <path className={styles.pageInkBare} d={MID_PAGE} />}
        </PathFragment>
      </Panel>
      <Panel caption="The ink as the page draws it, with --bleed-thread.">
        <PathFragment
          d={MID_PAGE}
          label="The thread's ink with its contact shadow"
        >
          {() => <path className={styles.pageInk} d={MID_PAGE} />}
        </PathFragment>
      </Panel>
    </div>
  );
}

/* The twist's gaps over the ink, as the painter lays them (`thread-twist.ts`), on one end of a mid-page
   connector at 1x and magnified: whole, as the page shows them once the ink has drawn past. */
function TwistedEnd({ zoom }: { zoom: number }) {
  return (
    <PathFragment
      crop={{ at: "start", span: TAPER_CROP, zoom }}
      d={MID_PAGE}
      label={`The twist on the thread's ink${zoom > 1 ? `, magnified ${zoom}×` : ""}`}
    >
      {(m) => {
        const half = m.strokeWidth / 2;
        return (
          <>
            <path className={styles.pageInk} d={MID_PAGE} />
            <path
              d={ropeGaps(m.samples, 0, m.length, m.length, half)}
              fill="none"
              stroke="var(--color-thread-twist)"
              strokeLinecap="butt"
              strokeWidth={gapWidth(half)}
            />
          </>
        );
      }}
    </PathFragment>
  );
}

export function ThreadTwistSpecimen() {
  return (
    <div className="flex flex-wrap items-end gap-space-lg">
      <Panel caption="At its own size.">
        <TwistedEnd zoom={1} />
      </Panel>
      <Panel caption={`Magnified ${TAPER_ZOOM}×.`}>
        <TwistedEnd zoom={TAPER_ZOOM} />
      </Panel>
    </div>
  );
}

export function ThreadHeadSpecimen() {
  return (
    <PathFragment
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
    </PathFragment>
  );
}

interface TaperedEndProps {
  readonly d: string;
  readonly label: string;
  readonly at: "start" | "end";
  readonly zoom: number;
}

/* The ink is cut under the taper by a mask on its own path and shadowed as a group, so the contact
   shadow is the shadow of the ink that is left (`thread-ink.tsx`, `ThreadInk`); the runs take the
   contact shadow on a group of their own, as the page's do. */
function TaperedEnd({ d, label, at, zoom }: TaperedEndProps) {
  const maskId = `ds-thread-taper-cut-${useId().replaceAll(":", "")}`;
  return (
    <PathFragment crop={{ at, span: TAPER_CROP, zoom }} d={d} label={label}>
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
    </PathFragment>
  );
}

export function ThreadTaperSpecimen() {
  return (
    <div className="flex flex-wrap items-start gap-space-lg">
      <Panel
        caption={`The invite's top terminal, at its own size and magnified ${TAPER_ZOOM}x.`}
      >
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
      <Panel
        caption={`Wishes' closing end, at its own size and magnified ${TAPER_ZOOM}x.`}
      >
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

/* The sway reads its `<svg>`'s user units as pixels from the top of the element it is measured against
   (on the page, `<main>`), so the stretch is moved to that frame's origin: the svg sits at the host's
   top-left at 1:1, and the gust travels the window down it as it does down the page. */
function atOrigin(d: string, margin: number) {
  const numbers = (d.match(/-?\d*\.?\d+(?:[eE][-+]?\d+)?/g) ?? []).map(Number);
  const xs = numbers.filter((_, i) => i % 2 === 0);
  const ys = numbers.filter((_, i) => i % 2 === 1);
  const dx = margin - Math.min(...xs);
  const dy = margin - Math.min(...ys);
  let index = 0;
  const moved = d.replace(/-?\d*\.?\d+(?:[eE][-+]?\d+)?/g, (n) => {
    const value = Number(n) + (index % 2 === 0 ? dx : dy);
    index += 1;
    return String(Math.round(value * 100) / 100);
  });
  return {
    d: moved,
    width: Math.max(...xs) + dx + margin,
    height: Math.max(...ys) + dy + margin,
  };
}

const SWAYING = atOrigin(MID_PAGE, MARGIN);

/* The host holds no type, so no stretch here is held still, as one near type is on the page. */
export function ThreadSwaySpecimen() {
  const host = useRef<HTMLDivElement>(null);
  const [ref, measured] = useMeasured(SWAYING.d);
  useEffect(() => {
    const frame = host.current;
    const svg = frame?.querySelector("svg");
    if (frame == null || svg == null) return;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const sway = createThreadSway(svg, reduced);
    /* The sway moves only the stretch it reads as near the window, from where the host sat when it was
       measured; the specimens above grow as they measure themselves, so it is measured again whenever
       the gallery's height changes, as the page re-measures on a resize. */
    const resized = new ResizeObserver(() => sway.measured(frame));
    resized.observe(document.body);
    return () => {
      resized.disconnect();
      sway.stop();
    };
  }, []);
  const half = (measured?.strokeWidth ?? 0) / 2;
  return (
    <Panel caption="Moving, at its own size; still under reduced motion.">
      <div className="max-w-full" ref={host}>
        <svg
          aria-label="The sway, on the thread's ink and twist"
          /* Marks it as the thread, which the sway never treats as type to hold still beside. */
          data-thread-svg="true"
          height={SWAYING.height}
          role="img"
          viewBox={`0 0 ${SWAYING.width} ${SWAYING.height}`}
          width={SWAYING.width}
        >
          <path className={styles.pageInk} d={SWAYING.d} ref={ref} />
          {measured === undefined ? null : (
            <path
              d={ropeGaps(
                measured.samples,
                0,
                measured.length,
                measured.length,
                half,
              )}
              fill="none"
              stroke="var(--color-thread-twist)"
              strokeLinecap="butt"
              strokeWidth={gapWidth(half)}
            />
          )}
        </svg>
      </div>
    </Panel>
  );
}
