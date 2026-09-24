import type { BandId } from "./thread-bands.ts";
import type { MotifId, ThreadId } from "./thread-geometry.ts";
import { type Point, splineDirection } from "./thread-spline.ts";

/* The six page sections in reading order. The handoff law — a section's exit column is the next
   section's entry column — is stated against THIS order, so it is the one copy. */
export const THREAD_IDS: readonly ThreadId[] = [
  "invite",
  "event-info",
  "contact",
  "family",
  "celebrations",
  "wishes",
] as const;

export type GridCell = { col: number; row: number };

/* `nudge` turns the motif off the route's own direction of travel, in degrees; `scale` sizes the
   motif's SQUARE FIELD, not its ink, so two motifs sharing a scale do not share a visual weight. */
export type GridStop = GridCell & {
  motif?: MotifId;
  nudge?: number;
  scale?: number;
};

export type SectionRoute = {
  id: ThreadId;
  band: BandId;
  cols: number;
  rows: number;
  stops: readonly GridStop[];
};

/* The ONE routing source: where the thread goes in each section, in each band, as an ordered list
   of grid cells. A motif's ANGLE is not authored — it is the spline's own direction of travel
   there, plus that stop's `nudge`, so a re-routed thread re-angles its motifs for free.

   SEEDS. Every route below is a straight descending run down the band's centre column, satisfying
   the handoff law and nothing more; the owner authors the real ones on the grid panel in Task 12.
   Grid sizes follow the band's shape — a tall section gets few columns and a wide one gets many. */
export const THREAD_ROUTES: readonly SectionRoute[] = [
  // tall — 3 x 4, centre column 1
  {
    id: "invite",
    band: "tall",
    cols: 3,
    rows: 4,
    stops: [
      { col: 1, row: 0 },
      { col: 1, row: 1 },
      { col: 1, row: 2, motif: "heart", scale: 0.34 },
      { col: 1, row: 3 },
    ],
  },
  {
    id: "event-info",
    band: "tall",
    cols: 3,
    rows: 4,
    stops: [
      { col: 1, row: 0 },
      { col: 1, row: 1, motif: "rings", scale: 0.44 },
      { col: 1, row: 2, motif: "knot", scale: 0.29 },
      { col: 1, row: 3 },
    ],
  },
  {
    id: "contact",
    band: "tall",
    cols: 3,
    rows: 4,
    stops: [
      { col: 1, row: 0 },
      { col: 1, row: 1 },
      { col: 1, row: 2, motif: "phone", scale: 0.28 },
      { col: 1, row: 3 },
    ],
  },
  {
    id: "family",
    band: "tall",
    cols: 3,
    rows: 4,
    stops: [
      { col: 1, row: 0 },
      { col: 1, row: 1, motif: "portraitLoop", scale: 0.3 },
      { col: 1, row: 2, motif: "portraitLoop", scale: 0.3 },
      { col: 1, row: 3 },
    ],
  },
  /* No motif. Phase 6's real timeline replaces this run, so placing one now is spent work. */
  {
    id: "celebrations",
    band: "tall",
    cols: 3,
    rows: 4,
    stops: [
      { col: 1, row: 0 },
      { col: 1, row: 1 },
      { col: 1, row: 2 },
      { col: 1, row: 3 },
    ],
  },
  {
    id: "wishes",
    band: "tall",
    cols: 3,
    rows: 4,
    stops: [
      { col: 1, row: 0 },
      { col: 1, row: 1, motif: "wishesLoop", scale: 0.42 },
      { col: 1, row: 2 },
      { col: 1, row: 3, motif: "bow", scale: 0.12 },
    ],
  },

  // upright — 5 x 4, centre column 2
  {
    id: "invite",
    band: "upright",
    cols: 5,
    rows: 4,
    stops: [
      { col: 2, row: 0 },
      { col: 2, row: 1 },
      { col: 2, row: 2, motif: "heart", scale: 0.34 },
      { col: 2, row: 3 },
    ],
  },
  {
    id: "event-info",
    band: "upright",
    cols: 5,
    rows: 4,
    stops: [
      { col: 2, row: 0 },
      { col: 2, row: 1, motif: "rings", scale: 0.44 },
      { col: 2, row: 2, motif: "knot", scale: 0.29 },
      { col: 2, row: 3 },
    ],
  },
  {
    id: "contact",
    band: "upright",
    cols: 5,
    rows: 4,
    stops: [
      { col: 2, row: 0 },
      { col: 2, row: 1 },
      { col: 2, row: 2, motif: "phone", scale: 0.28 },
      { col: 2, row: 3 },
    ],
  },
  {
    id: "family",
    band: "upright",
    cols: 5,
    rows: 4,
    stops: [
      { col: 2, row: 0 },
      { col: 2, row: 1, motif: "portraitLoop", scale: 0.3 },
      { col: 2, row: 2, motif: "portraitLoop", scale: 0.3 },
      { col: 2, row: 3 },
    ],
  },
  {
    id: "celebrations",
    band: "upright",
    cols: 5,
    rows: 4,
    stops: [
      { col: 2, row: 0 },
      { col: 2, row: 1 },
      { col: 2, row: 2 },
      { col: 2, row: 3 },
    ],
  },
  {
    id: "wishes",
    band: "upright",
    cols: 5,
    rows: 4,
    stops: [
      { col: 2, row: 0 },
      { col: 2, row: 1, motif: "wishesLoop", scale: 0.42 },
      { col: 2, row: 2 },
      { col: 2, row: 3, motif: "bow", scale: 0.12 },
    ],
  },

  // wide — 7 x 4, centre column 3
  {
    id: "invite",
    band: "wide",
    cols: 7,
    rows: 4,
    stops: [
      { col: 3, row: 0 },
      { col: 3, row: 1 },
      { col: 3, row: 2, motif: "heart", scale: 0.34 },
      { col: 3, row: 3 },
    ],
  },
  {
    id: "event-info",
    band: "wide",
    cols: 7,
    rows: 4,
    stops: [
      { col: 3, row: 0 },
      { col: 3, row: 1, motif: "rings", scale: 0.44 },
      { col: 3, row: 2, motif: "knot", scale: 0.29 },
      { col: 3, row: 3 },
    ],
  },
  {
    id: "contact",
    band: "wide",
    cols: 7,
    rows: 4,
    stops: [
      { col: 3, row: 0 },
      { col: 3, row: 1 },
      { col: 3, row: 2, motif: "phone", scale: 0.28 },
      { col: 3, row: 3 },
    ],
  },
  {
    id: "family",
    band: "wide",
    cols: 7,
    rows: 4,
    stops: [
      { col: 3, row: 0 },
      { col: 3, row: 1, motif: "portraitLoop", scale: 0.3 },
      { col: 3, row: 2, motif: "portraitLoop", scale: 0.3 },
      { col: 3, row: 3 },
    ],
  },
  {
    id: "celebrations",
    band: "wide",
    cols: 7,
    rows: 4,
    stops: [
      { col: 3, row: 0 },
      { col: 3, row: 1 },
      { col: 3, row: 2 },
      { col: 3, row: 3 },
    ],
  },
  {
    id: "wishes",
    band: "wide",
    cols: 7,
    rows: 4,
    stops: [
      { col: 3, row: 0 },
      { col: 3, row: 1, motif: "wishesLoop", scale: 0.42 },
      { col: 3, row: 2 },
      { col: 3, row: 3, motif: "bow", scale: 0.12 },
    ],
  },
] as const;

/* A stop's cell CENTRE, as a fraction of the section on each axis — never pixels, because the
   section's own size is not known until the page lays out. */
export function routePoints(route: SectionRoute): Point[] {
  return route.stops.map((stop) => ({
    x: (stop.col + 0.5) / route.cols,
    y: (stop.row + 0.5) / route.rows,
  }));
}

/** The direction the thread travels through a stop, in degrees, plus that stop's own `nudge`. */
export function motifAngle(route: SectionRoute, stopIndex: number): number {
  return (
    splineDirection(routePoints(route), stopIndex) +
    (route.stops[stopIndex].nudge ?? 0)
  );
}
