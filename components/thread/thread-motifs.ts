import type { Motif, MotifId } from "./thread-geometry.ts";

/* Each motif is drawn in a unit square and uniformly scaled at composition time, so a heart is a
   heart at every tier. Tangent angles are degrees, measured as the direction of travel: 0 is
   left-to-right. Source drawings: tmp/aaa/thread paths/. */
export const MOTIFS: Readonly<Record<MotifId, Motif>> = {
  /* heart 1.jpg — asymmetric, the heart off to one side so it clears the invite's centred type. */
  heart: {
    id: "heart",
    d: "",
    entry: { x: 0, y: 0.62, angle: 0 },
    exit: { x: 1, y: 0.58, angle: 0 },
    aspect: 2.4,
  },
  /* rings.jpg — two interlocked rings, tilted. Betrothal plate. */
  rings: {
    id: "rings",
    d: "",
    entry: { x: 0, y: 0.55, angle: 0 },
    exit: { x: 1, y: 0.55, angle: 0 },
    aspect: 3.1,
  },
  /* knot.jpg — a loose overhand knot. Tight reads as a tangle. Wedding plate. */
  knot: {
    id: "knot",
    d: "",
    entry: { x: 0, y: 0.5, angle: 0 },
    exit: { x: 1, y: 0.5, angle: 0 },
    aspect: 1.6,
  },
  /* phone 2.jpg — the receiver lies ON the line, exiting as small curls. */
  phone: {
    id: "phone",
    d: "",
    entry: { x: 0, y: 0.6, angle: 0 },
    exit: { x: 1, y: 0.55, angle: 0 },
    aspect: 2.2,
  },
  /* potrait loop 2.jpg — two to three circular passes with a natural offset, around one portrait. */
  portraitLoop: {
    id: "portraitLoop",
    d: "",
    entry: { x: 0, y: 0.55, angle: 0 },
    exit: { x: 1, y: 0.55, angle: 0 },
    aspect: 1.9,
  },
  /* The Wishes loop, rendered in two complementary segments so it weaves through the illustration. */
  wishesLoop: {
    id: "wishesLoop",
    d: "",
    entry: { x: 0, y: 0.4, angle: 0 },
    exit: { x: 0.5, y: 1, angle: 90 },
    aspect: 1.2,
  },
  /* final knot.jpg — a bow. A TERMINAL motif: it arrives, ties, and hangs. No exit tangent. */
  bow: {
    id: "bow",
    d: "",
    entry: { x: 0.5, y: 0, angle: 90 },
    exit: { x: 0.5, y: 1, angle: 90 },
    aspect: 0.55,
  },
} as const;
