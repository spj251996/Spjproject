"use client";

import {
  type ReactNode,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import styles from "@/components/thread/thread.module.css";
import { THREAD_BANDS } from "@/components/thread/thread-bands";
import {
  lineCrossings,
  type OrderedCrossing,
} from "@/components/thread/thread-crossings";
import {
  cordDrawn,
  type FrayShape,
  frayShape,
} from "@/components/thread/thread-fray";
import {
  type HeadOptions,
  type HeadSegment,
  headSegments,
  type PieceSpan,
} from "@/components/thread/thread-head";
import { EndCutMask } from "@/components/thread/thread-ink";
import { MOTIFS } from "@/components/thread/thread-motifs";
import {
  createCrossingPainter,
  createEndFrayPainter,
  createTipFrayPainter,
} from "@/components/thread/thread-painters";
import {
  MOTIF_PLACEMENTS,
  THREAD_PATHS,
} from "@/components/thread/thread-paths";
import {
  dashForPiece,
  pieceProgress,
} from "@/components/thread/thread-progress";
import {
  type PieceSamples,
  polylineBetween,
  samplePath,
} from "@/components/thread/thread-samples";
import { createThreadShadows } from "@/components/thread/thread-shadow-regions";
import { createThreadSway } from "@/components/thread/thread-sway";
import { headOptions, tokenLength } from "@/components/thread/thread-tokens";
import { gapWidth, ropeGaps } from "@/components/thread/thread-twist";

/* The thread's layers — ink, twist, head, frayed ends, crossings, sway — each laid on the page's own
   authored geometry (`thread-paths.ts`, `wide` band) rather than on a stand-in drawing. The arithmetic
   is `thread-head.ts`'s, `thread-fray.ts`'s, `thread-crossings.ts`'s and `thread-samples.ts`'s, and
   the frayed ends, the tip and the crossings are built by the page's own painters
   (`thread-painters.ts`); the classes are the page's own (`thread.module.css`), so the filters are the
   same ones, not copies. Static: a pose of each layer, never a loop — except the sway, which is motion
   or nothing, and runs on the page's own `createThreadSway`. */

/* A connector from the middle of the page, so neither of its ends is a free end and the ink and the head
   show on a line with no frayed end. The two frayed ends at rest are the pieces the page itself ends:
   the invite's first, at its start (`PageThread`), and Wishes' last, at its end (`CardThread`). */
const WIDE = THREAD_PATHS.wide;
const MID_PAGE = WIDE.family[1].d;
const INVITE_START = WIDE.invite[0].d;
const WISHES_CLOSE = WIDE.wishes[WIDE.wishes.length - 1].d;

/* Gallery layout constants. The margin holds the halo's 33px blur at most of its strength, so a panel clips only
   its faintest reach. */
const MARGIN = 48;
/* How far along its stretch the head's tip is posed: where the stretch bends. */
const HEAD_POSED_AT = 0.33;
/* A frayed end reaches about 8px past its cut: a crop this wide holds one with its contact shadow, at 1x
   and at END_ZOOM. */
const END_CROP = 96;
const END_ZOOM = 4;

interface Measured {
  readonly length: number;
  readonly samples: PieceSamples;
  readonly pieces: readonly PieceSpan[];
  readonly box: DOMRect;
  readonly head: HeadOptions;
  readonly fray: FrayShape;
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
      fray: frayShape(strokeWidth),
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
    const { box, samples, length, fray } = measured;
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
      /* Centred on the middle of the fray, so the whole of it and its contact shadow lie inside the crop. */
      const middle = Math.round(fray.length / 2);
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
      crop={{ at: "start", span: END_CROP, zoom }}
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
      <Panel caption={`Magnified ${END_ZOOM}×.`}>
        <TwistedEnd zoom={END_ZOOM} />
      </Panel>
    </div>
  );
}

/* The tip is posed as the page draws it: the cord — ink and sheen — the fray's length behind the drawn
   length (`cordDrawn`), and the page's own tip painter laying the fibres at the cord's end in the
   sheen's tip colour, their contact shadow fitted to them as the page fits it. */
function PosedHead({ measured: m }: { measured: Measured }) {
  const defsRef = useRef<SVGDefsElement>(null);
  const tipRef = useRef<SVGGElement>(null);
  const drawn = m.length * HEAD_POSED_AT;
  const cord = cordDrawn(drawn, m.length, m.fray.length);
  useLayoutEffect(() => {
    const defs = defsRef.current;
    const group = tipRef.current;
    if (defs === null || group === null) return;
    createTipFrayPainter(group, () => MID_PAGE, new Map()).paint(
      cord,
      drawn,
      [{ id: "family", kind: "connector", start: 0, end: m.length }],
      m.fray,
      `rgb(${m.head.tipColor.join(",")})`,
    );
    createThreadShadows(defs, 0).tipPainted(group);
  }, [cord, drawn, m]);
  const { dasharray, dashoffset } = dashForPiece(
    m.length,
    pieceProgress(cord, m.pieces[0]),
  );
  return (
    <>
      <defs ref={defsRef} />
      <path
        className={styles.pageInk}
        d={MID_PAGE}
        strokeDasharray={dasharray}
        strokeDashoffset={dashoffset}
      />
      <g className={styles.pageTip} ref={tipRef} />
      <g className={styles.pageHead}>
        <Runs
          samples={m.samples}
          segments={headSegments(cord, m.pieces, m.head)}
        />
      </g>
    </>
  );
}

export function ThreadHeadSpecimen() {
  return (
    <PathFragment
      d={MID_PAGE}
      drawnTo={HEAD_POSED_AT}
      label="The drawing head at the tip of a part-drawn stretch"
    >
      {(m) => <PosedHead measured={m} />}
    </PathFragment>
  );
}

interface FrayedEndProps {
  readonly d: string;
  readonly label: string;
  readonly at: "start" | "end";
  readonly zoom: number;
}

/* The page's own end painter on the page's own cut mask: the ink is cut back under the fray and
   shadowed as a group, so the contact shadow is the shadow of the ink that is left (`thread-ink.tsx`,
   `ThreadInk`), and the twist's gaps take the same cut; the fibres take the contact shadow on a group of their own, fitted to the piece's box
   by the page's own fitter, as the page's are. */
function FrayedEndBody({
  d,
  at,
  measured: m,
}: {
  d: string;
  at: "start" | "end";
  measured: Measured;
}) {
  const maskId = `ds-thread-end-cut-${useId().replaceAll(":", "")}`;
  const defsRef = useRef<SVGDefsElement>(null);
  const cutRef = useRef<SVGPathElement>(null);
  const inkRef = useRef<SVGPathElement>(null);
  const fibresRef = useRef<SVGGElement>(null);
  useLayoutEffect(() => {
    const defs = defsRef.current;
    const cut = cutRef.current;
    const ink = inkRef.current;
    const fibres = fibresRef.current;
    if (defs === null || cut === null || ink === null || fibres === null)
      return;
    const painter = createEndFrayPainter(fibres, cut);
    painter.set(
      {
        d,
        length: m.length,
        endAt: at === "start" ? 0 : m.length,
        direction: at === "start" ? -1 : 1,
      },
      m.fray,
    );
    painter.paint(Number.POSITIVE_INFINITY);
    createThreadShadows(defs, 0).measured([], { group: fibres, piece: ink });
  }, [d, at, m]);
  return (
    <>
      <EndCutMask
        cutRef={cutRef}
        id={maskId}
        region={{
          x: m.box.x - MARGIN,
          y: m.box.y - MARGIN,
          width: m.box.width + 2 * MARGIN,
          height: m.box.height + 2 * MARGIN,
        }}
      />
      <defs ref={defsRef} />
      <g className={styles.pageBleed}>
        <path
          className={styles.pageInkBare}
          d={d}
          mask={`url(#${maskId})`}
          ref={inkRef}
        />
      </g>
      <path
        d={ropeGaps(m.samples, 0, m.length, m.length, m.strokeWidth / 2)}
        fill="none"
        mask={`url(#${maskId})`}
        stroke="var(--color-thread-twist)"
        strokeLinecap="butt"
        strokeWidth={gapWidth(m.strokeWidth / 2)}
      />
      <g className={styles.pageFray} ref={fibresRef} />
    </>
  );
}

function FrayedEnd({ d, label, at, zoom }: FrayedEndProps) {
  return (
    <PathFragment crop={{ at, span: END_CROP, zoom }} d={d} label={label}>
      {(m) => <FrayedEndBody at={at} d={d} measured={m} />}
    </PathFragment>
  );
}

export function ThreadFrayedEndsSpecimen() {
  return (
    <div className="flex flex-wrap items-start gap-space-lg">
      <Panel
        caption={`The invite's top terminal, at its own size and magnified ${END_ZOOM}x.`}
      >
        <div className="flex flex-wrap items-start gap-space-md">
          <FrayedEnd
            at="start"
            d={INVITE_START}
            label="The invite's top terminal, frayed, at its own size"
            zoom={1}
          />
          <FrayedEnd
            at="start"
            d={INVITE_START}
            label="The invite's top terminal, frayed, magnified"
            zoom={END_ZOOM}
          />
        </div>
      </Panel>
      <Panel
        caption={`Wishes' closing end, at its own size and magnified ${END_ZOOM}x.`}
      >
        <div className="flex flex-wrap items-start gap-space-md">
          <FrayedEnd
            at="end"
            d={WISHES_CLOSE}
            label="Wishes' closing end, frayed, at its own size"
            zoom={1}
          />
          <FrayedEnd
            at="end"
            d={WISHES_CLOSE}
            label="Wishes' closing end, frayed, magnified"
            zoom={END_ZOOM}
          />
        </div>
      </Panel>
    </div>
  );
}

/* Wishes' bow at the wide band's nominal size — its square is its placement's scale of the band box's
   shorter side, as `thread-line.ts` composes it — unrotated, so its crossings are where the motif's own
   weave names them. */
const WIDE_BOX = THREAD_BANDS.find((band) => band.id === "wide")?.box;
const BOW_SIDE =
  MOTIF_PLACEMENTS.wide.wishes[0].scale *
  Math.min(WIDE_BOX?.width ?? 0, WIDE_BOX?.height ?? 0);
const BOW = atOrigin(scaled(MOTIFS.bow.d, BOW_SIDE / 100), MARGIN);
/* A crossing's crop: the upper strand's reach either side (3x the ink) and its lift shadow fit inside. */
const CROSSING_CROP = 40;

type CrossingView = "whole" | ((crossing: OrderedCrossing) => boolean);

/* The bow's ink and twist with the page's own crossing painter laid over them: every crossing it finds in the
   motif, ordered by its own weave, with the lift shadow on the filter `ThreadFilters` renders. */
function BowCrossings({
  view,
  zoom,
  label,
}: {
  view: CrossingView;
  zoom: number;
  label: string;
}) {
  const [ref, measured] = useMeasured(BOW.d);
  const defsRef = useRef<SVGDefsElement>(null);
  const underRef = useRef<SVGGElement>(null);
  const overRef = useRef<SVGGElement>(null);
  const line = useMemo(
    () =>
      measured === undefined
        ? undefined
        : lineCrossings(
            [BOW.d],
            [{ id: "wishes", kind: "bow", start: 0, end: measured.length }],
            measured.strokeWidth,
          ),
    [measured],
  );
  useLayoutEffect(() => {
    const defs = defsRef.current;
    const under = underRef.current;
    const over = overRef.current;
    if (line === undefined || measured === undefined) return;
    if (defs === null || under === null || over === null) return;
    const painter = createCrossingPainter(defs, under, over);
    painter.measured(
      line.crossings,
      (piece) => line.samples[piece],
      (piece) => (piece === 0 ? 0 : undefined),
      measured.strokeWidth / 2,
      0,
    );
    painter.painted(() => Number.POSITIVE_INFINITY);
  }, [line, measured]);
  const shown =
    view === "whole" ? undefined : line?.crossings.find((c) => view(c));
  const box =
    shown === undefined
      ? { x: 0, y: 0, width: BOW.width, height: BOW.height }
      : {
          x: shown.x - CROSSING_CROP / 2,
          y: shown.y - CROSSING_CROP / 2,
          width: CROSSING_CROP,
          height: CROSSING_CROP,
        };
  const half = (measured?.strokeWidth ?? 0) / 2;
  return (
    <svg
      aria-label={label}
      className="max-w-full"
      height={box.height * zoom}
      role="img"
      viewBox={`${box.x} ${box.y} ${box.width} ${box.height}`}
      width={box.width * zoom}
    >
      <defs ref={defsRef} />
      <path className={styles.pageInk} d={BOW.d} ref={ref} />
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
      <g className={styles.pageCrossings} ref={underRef} />
      <g className={styles.pageCrossings} ref={overRef} />
    </svg>
  );
}

export function ThreadCrossingsSpecimen() {
  return (
    <div className="flex flex-wrap items-start gap-space-lg">
      <Panel caption="Wishes' bow at its own size: the loops and the knot's outer turns lie later over earlier; the four innermost crossings are woven.">
        <BowCrossings
          label="The bow motif with its crossings laid, at its own size"
          view="whole"
          zoom={1}
        />
      </Panel>
      <Panel
        caption={`The later pass on top, as on the route. Magnified ${END_ZOOM}x.`}
      >
        <BowCrossings
          label="A crossing with the later pass on top, magnified"
          view={(crossing) => crossing.over === "second"}
          zoom={END_ZOOM}
        />
      </Panel>
      <Panel
        caption={`Woven: the earlier pass on top. Magnified ${END_ZOOM}x.`}
      >
        <BowCrossings
          label="A woven crossing with the earlier pass on top, magnified"
          view={(crossing) => crossing.over === "first"}
          zoom={END_ZOOM}
        />
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

/* A motif's `d`, drawn in its own 0-100 square, at `factor` px to the unit. */
function scaled(d: string, factor: number) {
  return d.replace(/-?\d*\.?\d+(?:[eE][-+]?\d+)?/g, (n) =>
    String(Math.round(Number(n) * factor * 100) / 100),
  );
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
