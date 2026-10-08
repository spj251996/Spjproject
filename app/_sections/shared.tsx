import { events, type FormattedDate } from "@/content";

/* Events are looked up by id, so inserting one cannot repoint a section. */

export function eventById(id: string) {
  const found = events.find((event) => event.id === id);
  if (found === undefined) {
    throw new Error(`sections: no event with id "${id}" in content/events.ts`);
  }
  return found;
}

/* The type role needs the names as separate spans. The split is presentation, so it lives here
   rather than in content; anything but two parts falls back to the whole string. */
export function splitCoupleNames(coupleNames: string): [string, string] | null {
  const parts = coupleNames.split(" & ");
  return parts.length === 2 ? [parts[0], parts[1]] : null;
}

/* Both month spellings render; `display: none` keeps the hidden one out of the accessibility tree,
   so no `aria-hidden` is needed. The `<time>` carries the ISO value so the rendered string — which
   is split across spans and duplicated for two month spellings — is still readable as one date. */
export function PrimaryDate({
  date,
  weekday = true,
  fullMonth = false,
}: {
  date: FormattedDate;
  weekday?: boolean;
  /* The invite spells the month out at every width. Elsewhere a phone takes the short form, where
     the date shares its line with a place and a time. */
  fullMonth?: boolean;
}) {
  return (
    <time dateTime={date.iso}>
      {weekday ? `${date.weekday}, ` : null}
      {date.day}
      <span className="type-caption type-date-ordinal align-super">
        {date.ordinal}
      </span>{" "}
      {fullMonth ? (
        date.month
      ) : (
        <>
          <span className="md:hidden">{date.monthShort}</span>
          <span className="hidden md:inline">{date.month}</span>
        </>
      )}{" "}
      {date.year}
    </time>
  );
}
