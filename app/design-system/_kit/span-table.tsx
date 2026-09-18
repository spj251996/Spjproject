/* With no prose layer to inherit, the table styles itself: divider rules, `space-*` padding, type
   roles. */

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
  "border-b-(length:--stroke-divider) border-accent-gold p-space-2xs text-left align-top";

/* Gallery layout constant. Narrower, the changes column wraps into near-blank bands while the
   nowrap zone cells hold the table open anyway, so the table scrolls instead. */
const MIN_TABLE_W = 480;

export function SpanTable({ zones }: SpanTableProps) {
  return (
    /* The nowrap cells give the table a min-content floor; scrolling here keeps the page itself
       free of horizontal scroll at 320px. */
    <div className="overflow-x-auto">
      <table
        className="w-full border-collapse"
        style={{ minWidth: MIN_TABLE_W }}
      >
        <thead>
          <tr>
            <th className={`type-eyebrow ${CELL}`}>Name</th>
            <th className={`type-eyebrow ${CELL}`}>Width</th>
            <th className={`type-eyebrow ${CELL}`}>Key changes</th>
          </tr>
        </thead>
        <tbody>
          {zones.flatMap((zone) =>
            zone.changes.map((change, index) => (
              <tr key={`${zone.name}-${change}`}>
                {index === 0 ? (
                  <>
                    <td
                      className={`type-eyebrow whitespace-nowrap ${CELL}`}
                      rowSpan={zone.changes.length}
                    >
                      {zone.name}
                    </td>
                    <td
                      className={`type-eyebrow whitespace-nowrap ${CELL}`}
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
