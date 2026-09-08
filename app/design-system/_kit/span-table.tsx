/* curate-gallery visualizer kit — SpanTable (skill → references/visualizer-kit.md § 9).

   The skill has this table inherit a `.prose-content` editorial layer supplied by the caller. This
   project has no prose layer and none may be invented (work/gallery-spine.md → "Consequence of
   Prose's absence"), so the table carries its own structure from real tokens: the documented divider
   for rules, the `space-*` scale for cell padding, and the type-scale classes for text.

   Name and Width merge down each zone with `rowSpan`, so a zone reads as one block however many
   changes it lists. */

export interface SpanZone {
  name: string;
  /** Breakpoint range, e.g. "48rem – 64rem". */
  width: string;
  changes: string[];
}

interface SpanTableProps {
  zones: SpanZone[];
}

const CELL =
  "border-b-(length:--stroke-divider) border-accent-gold-on-base p-space-2xs text-left align-top";

/* Gallery layout constant (skill → visualizer-kit.md → documented bare-px exceptions), the same
   allowance DurationScale's TRACK_W/LABEL_W take. Below this the Key-changes column is squeezed to a
   sliver and wraps into rows tall enough to read as blank bands, while the nowrap zone cells hold the
   table open anyway — so the table scrolls at a readable width instead of compressing to an
   unreadable one. */
const MIN_TABLE_W = 480;

export function SpanTable({ zones }: SpanTableProps) {
  return (
    /* The zone name and width cells are `whitespace-nowrap`, so the table has a min-content floor
       that `w-full` cannot shrink past — below that it pushed the whole page into horizontal scroll,
       breaking the 320px floor this very section documents. Scrolling the wide content in its own
       container is the design system's answer (design-system.md → Responsive), and the same shape
       DurationScale already uses in this kit. */
    <div className="overflow-x-auto">
      <table
        className="w-full border-collapse"
        style={{ minWidth: MIN_TABLE_W }}
      >
        <thead>
          <tr>
            <th className={`type-eyebrow text-accent-gold-on-base ${CELL}`}>
              Name
            </th>
            <th className={`type-eyebrow text-accent-gold-on-base ${CELL}`}>
              Width
            </th>
            <th className={`type-eyebrow text-accent-gold-on-base ${CELL}`}>
              Key changes
            </th>
          </tr>
        </thead>
        <tbody>
          {zones.flatMap((zone) =>
            zone.changes.map((change, index) => (
              <tr key={`${zone.name}-${change}`}>
                {index === 0 ? (
                  <>
                    <td
                      className={`type-eyebrow whitespace-nowrap text-accent-gold-on-base ${CELL}`}
                      rowSpan={zone.changes.length}
                    >
                      {zone.name}
                    </td>
                    <td
                      className={`type-eyebrow whitespace-nowrap text-accent-gold-on-base ${CELL}`}
                      rowSpan={zone.changes.length}
                    >
                      {zone.width}
                    </td>
                  </>
                ) : null}
                <td className={`type-body text-ink ${CELL}`}>{change}</td>
              </tr>
            )),
          )}
        </tbody>
      </table>
    </div>
  );
}
