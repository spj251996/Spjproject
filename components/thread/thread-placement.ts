import type { SectionThread } from "./thread-geometry.ts";

/* The ONE source for where the thread enters, leaves and what it draws on the way. `x`/`y` are
   fractions of the section box; `anchor` names an element the motif centres on instead, so the
   motif follows the content when the content moves. Values are seeds — Task 11 tunes them live.

   `scale` sizes the motif's SQUARE FIELD, not its ink, so two motifs sharing a scale do not share a
   visual weight: the art sits in a square viewBox, so a wide drawing fills the width and leaves the
   height to its aspect. `rings` at aspect 3.39 draws a third as tall as `wishesLoop` at aspect 1.01
   from the same number. The seeds below therefore equalise drawn HEIGHT against `heart`, the one
   motif reviewed and accepted so far, rather than sharing a scale. */
export const SECTION_THREADS: readonly SectionThread[] = [
  {
    id: "invite",
    entryX: null,
    exitX: 0.68,
    placements: [
      { motif: "heart", anchor: null, x: 0.68, y: 0.74, scale: 0.34 },
    ],
  },
  {
    id: "event-info",
    entryX: 0.68,
    exitX: 0.32,
    placements: [
      /* Betrothal above, wedding below, following the plates' own order down the page. Both sat at
         the section's centre until the first owner review, where — the anchors being inert — they
         resolved to the same point and drew on top of each other. */
      {
        motif: "rings",
        anchor: "[data-event-plate='betrothal']",
        x: 0.58,
        y: 0.35,
        scale: 0.44,
      },
      {
        motif: "knot",
        anchor: "[data-event-plate='wedding']",
        x: 0.42,
        y: 0.68,
        scale: 0.29,
      },
    ],
  },
  /* Contact's centre is taken by ContactMark (LoveIcon, 72/112px) from 64rem landscape, so the
     phone anchors to a plate, never the gap between them. */
  {
    id: "contact",
    entryX: 0.32,
    exitX: 0.3,
    placements: [
      {
        motif: "phone",
        anchor: "[data-contact-plate='groom']",
        x: 0.5,
        y: 0.62,
        scale: 0.28,
      },
    ],
  },
  /* Two loops, on the two people getting married, out of ten portraits. Stacked, six portraits and
     a long run separate them, so the join is a different gesture — hence the second set. */
  {
    id: "family",
    entryX: 0.3,
    exitX: 0.7,
    placements: [
      /* Side by side, the two loops are neighbours and the join between them is a short sweep. Like
         Event Info's pair, both sat at the section's centre and drew on top of each other until the
         anchors resolve. */
      {
        motif: "portraitLoop",
        anchor: "[data-portrait='flemy']",
        x: 0.32,
        y: 0.45,
        scale: 0.3,
      },
      {
        motif: "portraitLoop",
        anchor: "[data-portrait='sebastian']",
        x: 0.68,
        y: 0.58,
        scale: 0.3,
      },
    ],
    stacked: [
      /* Stacked, six portraits and a long run separate them: the join is down the page, not across.  */
      {
        motif: "portraitLoop",
        anchor: "[data-portrait='flemy']",
        x: 0.5,
        y: 0.3,
        scale: 0.38,
      },
      {
        motif: "portraitLoop",
        anchor: "[data-portrait='sebastian']",
        x: 0.5,
        y: 0.72,
        scale: 0.38,
      },
    ],
  },
  /* No motif. Phase 6's real timeline replaces this run, so tuning it now is spent work. */
  { id: "celebrations", entryX: 0.7, exitX: 0.4, placements: [] },
  {
    id: "wishes",
    entryX: 0.4,
    exitX: null,
    placements: [
      {
        motif: "wishesLoop",
        anchor: "[data-wishes-figure]",
        x: 0.5,
        y: 0.5,
        scale: 0.42,
      },
      { motif: "bow", anchor: null, x: 0.4, y: 0.94, scale: 0.12 },
    ],
  },
] as const;

/* The closed not-found thread (Task 9): the invite's own heart, standing alone with no entry or
   exit terminal — it belongs to no page position, only to this one screen. */
const NOT_FOUND_THREAD: SectionThread = {
  id: "not-found",
  entryX: null,
  exitX: null,
  placements: [{ motif: "heart", anchor: null, x: 0.5, y: 0.5, scale: 0.4 }],
};

/* Components resolve a thread by id from this list; `SECTION_THREADS` is still the only table a
   human edits — this appends the closed screen rather than copying the six sections again. */
export const ALL_THREADS: readonly SectionThread[] = [
  ...SECTION_THREADS,
  NOT_FOUND_THREAD,
] as const;
