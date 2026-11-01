/* Lists a domain entry (an `[inline]` section, or a component a specimen frame cannot render) with its
   source file and what it composes. It never rebuilds the markup, which would fabricate a component. */

export interface InlineEntry {
  /** The DESIGN.md entry name, e.g. "Event Info". */
  name: string;
  /** The source file documented as composing it, e.g. "app/_sections/event-info.tsx". */
  home: string;
  /** What the entry composes — the real components it is documented to arrange. */
  composes: string;
  /** Where the entry is live, and what the gallery cannot show of it. */
  note?: string;
}

interface InlineListProps {
  entries: InlineEntry[];
}

export function InlineList({ entries }: InlineListProps) {
  return (
    <ul className="flex list-none flex-col gap-space-md">
      {entries.map((entry) => (
        <li className="flex flex-col gap-space-3xs" key={entry.name}>
          <span className="type-body text-ink">{entry.name}</span>
          <span className="type-body text-ink">{entry.home}</span>
          <span className="type-body text-ink">{entry.composes}</span>
          {entry.note === undefined ? null : (
            <span className="type-body text-ink">{entry.note}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
