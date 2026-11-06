/* The red thread's pure geometry: the motif and section ids, a motif as a small square drawing with a
   tangent at each end, and the section box a thread is composed against. No React, no DOM. */

export type MotifId = "heart" | "rings" | "knot" | "portraitLoop" | "bow";

export type ThreadId =
  | "invite"
  | "event-info"
  | "family"
  | "celebrations"
  | "wishes";

/* Where the line crosses itself, which of its two passes lies on top, counted in draw order. */
export type Over = "first" | "second";

/* One crossing inside a motif, named by where its two passes fall along the motif (fractions of its
   length), so it is the same crossing at every size; close crossings merge as a motif shrinks, so a
   list position would not be. */
export type WeaveCrossing = {
  readonly first: number;
  readonly second: number;
  readonly over: Over;
};

/* angle is degrees, the direction of travel: 0 is left-to-right, 90 is top-to-bottom. */
export type Tangent = { x: number; y: number; angle: number };

export type Motif = {
  id: MotifId;
  d: string;
  entry: Tangent;
  exit: Tangent;
  aspect: number;
  /* Which strand lies on top at each of the drawing's own crossings, confirmed by the owner. */
  weave: readonly WeaveCrossing[];
};

/* The section box a thread is composed against. A band's nominal box states both its ASPECT and its
   PIXELS: the aspect decides where a motif's square lands on each axis, and the pixels are the
   coordinate system every curve is emitted in, so that at the band's own device the render is 1:1
   and a dash advances at the rate it was measured at. */
export type SectionBox = { width: number; height: number };
