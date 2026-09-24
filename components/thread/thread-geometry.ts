/* The red thread's pure geometry: a motif is a small square drawing with a tangent at each end, and
   an end of a connector is a point stated in the two units the page resolves it in. Routing itself
   lives in `thread-grid.ts` and composition in `thread-css.ts`. No React, no DOM. */

export type MotifId =
  | "heart"
  | "rings"
  | "knot"
  | "phone"
  | "portraitLoop"
  | "wishesLoop"
  | "bow";

export type ThreadId =
  | "invite"
  | "event-info"
  | "contact"
  | "family"
  | "celebrations"
  | "wishes"
  | "not-found";

/* angle is degrees, the direction of travel: 0 is left-to-right, 90 is top-to-bottom. */
export type Tangent = { x: number; y: number; angle: number };

export type Motif = {
  id: MotifId;
  d: string;
  entry: Tangent;
  exit: Tangent;
  aspect: number;
};

/* The section box a thread is composed against. A band's nominal box states both its ASPECT and its
   PIXELS: the aspect decides where a motif's square lands on each axis, and the pixels are the
   coordinate system every curve is emitted in, so that at the band's own device the render is 1:1
   and a dash advances at the rate it was measured at. */
export type SectionBox = { width: number; height: number };

/* Where one end of a connector sits, in the two units the PAGE resolves it in: a fraction of the
   section box, plus a multiple of `svmin`, the unit a motif's own square field is sized in. A
   terminal sits on the section's edge and a waypoint in the middle of one; neither carries an
   `svmin` term.

   Keeping the two apart is what makes a join exact. Collapsing them into one fraction needs the
   section's aspect, and the aspect is not known until the page lays out: a motif's square covers a
   different fraction of each axis at every window, so a fraction composed against a nominal box
   lands beside the motif rather than on it. The renderer pins each connector's own box to these
   same two numbers in CSS, where `svmin` and `%` both resolve for real; composing resolves them
   against the band's nominal box, which is all the connector's SHAPE needs. */
export type ConnectorEnd = {
  fraction: { x: number; y: number };
  svmin: { x: number; y: number };
  tangent: Tangent;
};

/* A section's terminal points sit at its top/bottom edge, where the thread travels vertically
   between sections — so a terminal's own tangent is angle 90. A motif's own tangents are whatever
   its drawing declares, turned by however far the route turns the motif: both are met smoothly,
   because the connector is built through the point each tangent names. */
export const TERMINAL_TANGENT: Tangent = { x: 0, y: 0, angle: 90 };

/* An end's point in section fractions, against a nominal box — and `overlap` past it, in that box's
   pixels, along the tangent it is met on. `sign` is -1 at the end a connector LEAVES and 1 at the
   end it arrives at, so both run past the join in the same sense: into the motif, or past the
   section's own edge at a terminal. */
export function resolveEnd(
  end: ConnectorEnd,
  box: SectionBox,
  overlap: number,
  sign: 1 | -1,
): { x: number; y: number } {
  const unit = Math.min(box.width, box.height);
  const radians = (end.tangent.angle * Math.PI) / 180;
  return {
    x:
      end.fraction.x +
      end.svmin.x * (unit / box.width) +
      (sign * overlap * Math.cos(radians)) / box.width,
    y:
      end.fraction.y +
      end.svmin.y * (unit / box.height) +
      (sign * overlap * Math.sin(radians)) / box.height,
  };
}
