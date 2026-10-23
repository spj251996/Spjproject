/* Removes one section from a band's authored thread data, joining the thread across the gap.

   Contact left the page and then the thread lab (owner, 2026-10-14) while the owner's drawn sheets
   still carry it. The section is removed here rather than in the authored JSON, which is the source
   of record and is never hand-edited: its motifs go, the connector arriving at its first motif and
   the one leaving its last become ONE connector — the arriving one's points above the section and
   the leaving one's points below it — and everything below moves up by the section's height. That
   join is machine-made, not drawn; the thread's redraw replaces it.

   `margin` drops the drawn points within that many px of the seam on both sides: a drawing that
   hooks into the removed section turns sharply at its edge, and a vertex left on the seam keeps that
   turn as a kink. */

/**
   @typedef {{ x: number, y: number }} Point
   @typedef {{ top: number, height: number }} Section
   @typedef {{ section: string, motif: string, which: string, x: number, y: number, top?: number }} Attachment
   @typedef {{ connector: number, points: Point[] }} Connector
   @typedef {{ sections: Section[], attachments: Attachment[], connectors: Connector[], order: string[] }} SectionData */

/** @param {SectionData & { id: string, margin?: number }} options
    @returns {SectionData} */
export function withoutSection({
  sections,
  attachments,
  connectors,
  order,
  id,
  margin = 0,
}) {
  const index = order.indexOf(id);
  if (index === -1) throw new Error(`no section "${id}" to remove`);
  const { top, height } = sections[index];
  const bottom = top + height;
  /** @param {number} y */
  const liftY = (y) => (y >= bottom ? y - height : y);
  /** @template {Point} T @param {T} point */
  const lift = (point) => ({ ...point, y: liftY(point.y) });

  /* Attachments are entry/exit pairs, one pair per motif, in page order — so pair `i / 2` is motif
     `i / 2`, and connector `k` arrives at motif `k`. */
  /** @type {number[]} */
  const motifs = [];
  for (let i = 0; i < attachments.length; i += 2) {
    if (attachments[i].section === id) motifs.push(i / 2);
  }
  if (motifs.length === 0) throw new Error(`section "${id}" places no motif`);
  const first = motifs[0];
  const last = /** @type {number} */ (motifs.at(-1));

  const above = connectors[first].points.filter((p) => p.y < top - margin);
  const below = connectors[last + 1].points
    .filter((p) => p.y >= bottom + margin)
    .map(lift);
  if (above.length === 0) {
    throw new Error(`"${id}": no drawn points above the section`);
  }
  if (below.length === 0) {
    throw new Error(`"${id}": no drawn points below the section`);
  }

  /** @param {Connector} c */
  const liftConnector = (c) => ({ ...c, points: c.points.map(lift) });
  return {
    order: order.filter((other) => other !== id),
    sections: sections
      .filter((_, i) => i !== index)
      .map((s) => ({ ...s, top: liftY(s.top) })),
    attachments: attachments
      .filter((a) => a.section !== id)
      .map((a) =>
        "top" in a
          ? { ...lift(a), top: liftY(/** @type {number} */ (a.top)) }
          : lift(a),
      ),
    connectors: [
      ...connectors.slice(0, first).map(liftConnector),
      { ...connectors[first], points: [...above, ...below] },
      ...connectors.slice(last + 2).map(liftConnector),
    ],
  };
}
