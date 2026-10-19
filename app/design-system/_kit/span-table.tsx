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

export function SpanTable({ zones }: SpanTableProps) {
  return (
    /* The zone cells wrap below md so the table fits a phone column; the scroll stays as a safety
       net, keeping the page itself free of horizontal scroll at 320px. */
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
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
                      className={`type-eyebrow md:whitespace-nowrap ${CELL}`}
                      rowSpan={zone.changes.length}
                    >
                      {zone.name}
                    </td>
                    <td
                      className={`type-eyebrow md:whitespace-nowrap ${CELL}`}
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
