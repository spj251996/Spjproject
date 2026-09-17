/* An `[inline]` domain entry has no component file, so it is listed, never rebuilt — rebuilding its
   markup would fabricate a component. */

export interface InlineEntry {
  /** The DESIGN.md entry name, e.g. "Event Info". */
  name: string;
  /** The page file documented as composing it, e.g. "app/page.tsx". */
  home: string;
  /** What the entry composes — the real components it is documented to arrange. */
  composes: string;
  /** Honest status when the documented composition does not exist in code yet. */
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
