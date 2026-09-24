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
  c1: { x: number; y: number },
  c2: { x: number; y: number },
  to: { x: number; y: number },
): string {
  return `C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${to.x} ${to.y}`;
}

/* The section box a thread is composed against. Only its ASPECT is read, so a nominal tier box and
   the real window box of the same shape compose identically. */
export type SectionBox = { width: number; height: number };

/* A square section: the aspect-neutral default, under which a motif's two offsets scale both axes
   by `scale` — the shape this module had before the box entered it. */
const SQUARE_BOX: SectionBox = { width: 1, height: 1 };

/* Where one end of a connector sits, in the two units the PAGE resolves it in: a fraction of the
   section box, plus a multiple of `svmin`, the unit a motif's own square field is sized in. A
   terminal sits on the section's edge and carries no `svmin` term.

   Keeping the two apart is what makes a join exact. Collapsing them into one fraction needs the
   section's aspect, and the aspect is not known until the page lays out: a motif's square covers a
   different fraction of each axis at every window, so a fraction composed against a nominal box
   lands beside the motif rather than on it. The renderer pins each connector's own box to these
   same two numbers in CSS, where `svmin` and `%` both resolve for real; composing resolves them
   against a nominal box, which is all the connector's SHAPE needs. */
export type ConnectorEnd = {
  fraction: { x: number; y: number };
  svmin: { x: number; y: number };
  tangent: Tangent;
};

export type Connector = { from: ConnectorEnd; to: ConnectorEnd };

function terminalEnd(x: number, y: number): ConnectorEnd {
  return {
    fraction: { x, y },
    svmin: { x: 0, y: 0 },
    tangent: TERMINAL_TANGENT,
  };
}

/* `anchor` is resolved by the component (it names a live DOM element); this only knows
   `x`/`y`/`scale`, so it works identically whether the caller already resolved an anchor to a
   fraction or used a literal one. */
function motifEnd(placement: Placement, tangent: Tangent): ConnectorEnd {
  return {
    fraction: { x: placement.x, y: placement.y },
    svmin: {
      x: (tangent.x - 0.5) * placement.scale,
      y: (tangent.y - 0.5) * placement.scale,
    },
    tangent,
  };
}

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

/* A section's terminal points sit at its top/bottom edge, where the thread travels vertically
   between sections — so a terminal's own tangent is angle 90. A motif's own tangents are whatever
   its drawing declares, at any angle: both ends of a connector are smooth regardless, because each
   control point lies along the tangent it meets. */
const TERMINAL_TANGENT: Tangent = { x: 0, y: 0, angle: 90 };

/* Each motif renders as its own separately-positioned square SVG (the spike's settled mechanism —
   a non-uniform stretch cannot both scale a motif uniformly and stretch a connector). The thread's
   composition is therefore the CONNECTORS alone: one cubic from each exit tangent to the next entry
   tangent, spanning the gap a motif itself occupies, so nothing composed here doubles what a
   motif's own artwork already draws.

   This is the ONE walk. `composePath` spells it as a path and the renderer draws it a connector at
   a time; neither re-derives the order. */
export function composeConnectors(
  section: SectionThread,
  motifs: Record<MotifId, Motif>,
  placements: readonly Placement[] = section.placements,
): Connector[] {
  const connectors: Connector[] = [];
  let cursor: ConnectorEnd | null =
    section.entryX === null ? null : terminalEnd(section.entryX, 0);

  for (const placement of placements) {
    const motif = motifs[placement.motif];
    if (cursor !== null) {
      connectors.push({ from: cursor, to: motifEnd(placement, motif.entry) });
    }
    cursor = motifEnd(placement, motif.exit);
  }

  if (section.exitX !== null && cursor !== null) {
    connectors.push({ from: cursor, to: terminalEnd(section.exitX, 1) });
  }
  return connectors;
}

/* One connector's curve against a nominal box: its two resolved ends, the control points that make
   it leave and arrive along their tangents, and the `d` those four points spell. */
export function connectorCurve(
  { from, to }: Connector,
  box: SectionBox = SQUARE_BOX,
  overlap = 0,
): {
  from: { x: number; y: number };
  to: { x: number; y: number };
  c1: { x: number; y: number };
  c2: { x: number; y: number };
  d: string;
} {
  const start = resolveEnd(from, box, overlap, -1);
  const end = resolveEnd(to, box, overlap, 1);
  const reach = Math.hypot(end.x - start.x, end.y - start.y) / 3;
  const c1 = controlPoint(start, from.tangent, reach, 1);
  const c2 = controlPoint(end, to.tangent, reach, -1);
  return {
    from: start,
    to: end,
    c1,
    c2,
    d: `M ${start.x} ${start.y} ${connector(c1, c2, end)}`,
  };
}

/* The whole thread as one path, in section fractions: every connector as its own subpath, with the
   pen lifted across the footprint each motif draws for itself. The renderer draws each connector in
   its own pinned box instead, from the same walk — this is the composition in one piece, and what
   its own tests read. */
export function composePath(
  section: SectionThread,
  motifs: Record<MotifId, Motif>,
  box: SectionBox = SQUARE_BOX,
  overlap = 0,
): string {
  return composeConnectors(section, motifs)
    .map((piece) => connectorCurve(piece, box, overlap).d)
    .join(" ");
}
