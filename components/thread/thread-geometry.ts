/* The red thread's pure geometry: a motif is a small square drawing with a tangent at each end; a
   section thread composes zero or more motifs, in order, into one path with a connector between
   every pair (and from/to the section's own terminals). No React, no DOM — the component consuming
   this owns rendering and scroll-scrubbing. */

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

export type Placement = {
  motif: MotifId;
  anchor: string | null;
  x: number;
  y: number;
  scale: number;
};

export type SectionThread = {
  id: ThreadId;
  entryX: number | null;
  exitX: number | null;
  placements: readonly Placement[];
  stacked?: readonly Placement[];
};

/* A cubic control point one third of the way along the tangent's own direction makes the curve
   leave (or arrive at) each end exactly along that tangent — the join is smooth because the math
   guarantees it, not because the numbers were picked by eye. */
function controlPoint(
  point: { x: number; y: number },
  tangent: Tangent,
  reach: number,
  sign: 1 | -1,
) {
  const radians = (tangent.angle * Math.PI) / 180;
  return {
    x: point.x + sign * reach * Math.cos(radians),
    y: point.y + sign * reach * Math.sin(radians),
  };
}

function connector(
  from: { x: number; y: number },
  fromTangent: Tangent,
  to: { x: number; y: number },
  toTangent: Tangent,
): string {
  const reach = Math.hypot(to.x - from.x, to.y - from.y) / 3;
  const c1 = controlPoint(from, fromTangent, reach, 1);
  const c2 = controlPoint(to, toTangent, reach, -1);
  return `C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${to.x} ${to.y}`;
}

/* The section box a thread is composed against. Only its ASPECT is read, so a nominal tier box and
   the real window box of the same shape compose identically. */
export type SectionBox = { width: number; height: number };

/* A square section: the aspect-neutral default, under which `place` reduces to scaling both axes by
   `scale` — the shape this module had before the box entered it. */
const SQUARE_BOX: SectionBox = { width: 1, height: 1 };

/* Placements' unit-square points, scaled and moved to where the section wants them. `anchor`
   itself is resolved by the component (it names a live DOM element); this function only knows
   `x`/`y`/`scale`, so it works identically whether the caller already resolved an anchor to a
   fraction or used a literal one.

   A motif renders as a SQUARE of side `scale x min(section width, section height)`, while `x`/`y`
   are fractions of the section — so the one side covers a different fraction of each axis, and the
   section's aspect enters the geometry. It cannot be removed: a square that is 0.34 of a 390x844
   phone's shorter side spans 34% of its width and 16% of its height. The caller composes once per
   tier with that tier's box rather than pretending one path serves every aspect. */
function place(
  point: { x: number; y: number },
  placement: Placement,
  box: SectionBox,
) {
  const side = placement.scale * Math.min(box.width, box.height);
  return {
    x: placement.x + (point.x - 0.5) * (side / box.width),
    y: placement.y + (point.y - 0.5) * (side / box.height),
  };
}

/* A section's terminal points sit at its top/bottom edge, where the thread travels vertically
   between sections — so a terminal's own tangent is angle 90. A connector therefore leaves a
   terminal vertically and arrives at a motif horizontally; both of its ends are smooth, because
   each control point lies along the tangent it meets. The two ends differing is the design, not a
   kink: the connectors do the vertical transit and the motifs are horizontal events within it. */
const TERMINAL_TANGENT: Tangent = { x: 0, y: 0, angle: 90 };

/* Each motif renders as its own separately-positioned square SVG (the spike's settled mechanism —
   a non-uniform stretch cannot both scale a motif uniformly and stretch a connector). `composePath`
   therefore draws only the CONNECTORS: a cubic from the previous exit tangent to the next entry
   tangent, lifting the pen (`M`, no line drawn) across the gap a motif itself occupies, so the
   returned path never doubles what the motif's own artwork already draws. */
export function composePath(
  section: SectionThread,
  motifs: Record<MotifId, Motif>,
  box: SectionBox = SQUARE_BOX,
): string {
  let cursor = section.entryX === null ? null : { x: section.entryX, y: 0 };
  let cursorTangent: Tangent = TERMINAL_TANGENT;
  const segments: string[] = [];

  if (cursor !== null) {
    segments.push(`M ${cursor.x} ${cursor.y}`);
  }

  for (const placement of section.placements) {
    const motif = motifs[placement.motif];
    const entryPoint = place(motif.entry, placement, box);
    const exitPoint = place(motif.exit, placement, box);

    if (cursor === null) {
      segments.push(`M ${entryPoint.x} ${entryPoint.y}`);
    } else {
      segments.push(connector(cursor, cursorTangent, entryPoint, motif.entry));
    }

    segments.push(`M ${exitPoint.x} ${exitPoint.y}`);
    cursor = exitPoint;
    cursorTangent = motif.exit;
  }

  if (section.exitX !== null) {
    const exitTerminal = { x: section.exitX, y: 1 };
    if (cursor === null) {
      segments.push(`M ${exitTerminal.x} ${exitTerminal.y}`);
    } else {
      segments.push(
        connector(cursor, cursorTangent, exitTerminal, TERMINAL_TANGENT),
      );
    }
  }

  return segments.join(" ");
}
