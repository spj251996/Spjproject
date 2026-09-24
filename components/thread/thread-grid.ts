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
   motif's SQUARE FIELD, not its ink, so two motifs sharing a scale do not share a visual weight.

   `offsetX` and `offsetY` move the stop off its cell's CENTRE — the grid alone cannot land a motif
   exactly where it is wanted, and this is the sub-cell correction. Each is a fraction of the
   SECTION on its own axis, the same unit `routePoints` returns, so nothing converts between the two
   and a tuned value keeps its absolute size when the panel changes the grid's granularity: the cell
   the stop sits in moves, the offset does not. Neither turns anything — `nudge` is the only field
   that rotates.

   `anchor` is a CSS selector for content this motif wraps, resolved inside the section at runtime by
   `thread-anchors.ts`. It OVERRIDES the cell rather than replacing it: the cell is still authored
   and is still what the motif sits on before the script runs, or if it never runs at all. */
export type GridStop = GridCell & {
  motif?: MotifId;
  nudge?: number;
  scale?: number;
  offsetX?: number;
  offsetY?: number;
  anchor?: string;
};

/* The custom-property segment an anchor writes to: `[data-portrait='flemy']` becomes
   `data-portrait-flemy`, so the generated sheet reads `var(--thread-anchor-data-portrait-flemy-x,
   <cell>)`. Derived rather than authored beside the selector, so the two cannot drift. */
export function anchorKey(selector: string): string {
  return selector
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Every distinct anchor a section's route names, in the shape the client module consumes. */
export function sectionAnchors(
  id: ThreadId,
): { key: string; selector: string }[] {
  const found = new Map<string, string>();
  for (const route of THREAD_ROUTES) {
    if (route.id !== id) continue;
    for (const stop of route.stops) {
      if (stop.anchor !== undefined)
        found.set(anchorKey(stop.anchor), stop.anchor);
    }
  }
  return [...found].map(([key, selector]) => ({ key, selector }));
}

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
  /* The bride's family is rendered first, so the descending thread meets Flemy's portrait before
     Sebastian's — which is why the upper loop anchors to hers. Re-pairing them is a content change,
     not a tuning one: the selectors follow the page's order, not the grid's. */
  {
    id: "family",
    band: "tall",
    cols: 3,
    rows: 4,
    stops: [
      { col: 1, row: 0 },
      {
        col: 1,
        row: 1,
        motif: "portraitLoop",
        scale: 0.3,
        anchor: "[data-portrait='flemy']",
      },
      {
        col: 1,
        row: 2,
        motif: "portraitLoop",
        scale: 0.3,
        anchor: "[data-portrait='sebastian']",
      },
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
      {
        col: 1,
        row: 1,
        motif: "wishesLoop",
        scale: 0.42,
        anchor: "[data-wishes-figure]",
      },
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
      {
        col: 2,
        row: 1,
        motif: "portraitLoop",
        scale: 0.3,
        anchor: "[data-portrait='flemy']",
      },
      {
        col: 2,
        row: 2,
        motif: "portraitLoop",
        scale: 0.3,
        anchor: "[data-portrait='sebastian']",
      },
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
      {
        col: 2,
        row: 1,
        motif: "wishesLoop",
        scale: 0.42,
        anchor: "[data-wishes-figure]",
      },
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
      {
        col: 3,
        row: 1,
        motif: "portraitLoop",
        scale: 0.3,
        anchor: "[data-portrait='flemy']",
      },
      {
        col: 3,
        row: 2,
        motif: "portraitLoop",
        scale: 0.3,
        anchor: "[data-portrait='sebastian']",
      },
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
      {
        col: 3,
        row: 1,
        motif: "wishesLoop",
        scale: 0.42,
        anchor: "[data-wishes-figure]",
      },
      { col: 3, row: 2 },
      { col: 3, row: 3, motif: "bow", scale: 0.12 },
    ],
  },
] as const;

/* Clamped to the section rather than carried past its edge: a point outside has no cell, hands
   nothing usable to the next section's terminal (which inherits the last stop's resolved x) and
   paints the thread where it cannot be seen. The slider stops having effect at the edge, which is
   visible; a motif that has silently left the page is not. */
function insideSection(fraction: number): number {
  return Math.min(1, Math.max(0, fraction));
}

/* A stop's cell CENTRE plus its own offset, as a fraction of the section on each axis — never
   pixels, because the section's own size is not known until the page lays out. */
export function routePoints(route: SectionRoute): Point[] {
  return route.stops.map((stop) => ({
    x: insideSection((stop.col + 0.5) / route.cols + (stop.offsetX ?? 0)),
    y: insideSection((stop.row + 0.5) / route.rows + (stop.offsetY ?? 0)),
  }));
}

/** The direction the thread travels through a stop, in degrees, plus that stop's own `nudge`. */
export function motifAngle(route: SectionRoute, stopIndex: number): number {
  return (
    splineDirection(routePoints(route), stopIndex) +
    (route.stops[stopIndex].nudge ?? 0)
  );
}
