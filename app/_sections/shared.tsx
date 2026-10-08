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

/* The event sheets' date line, and now their only one: the invite composes its own date as a block
   (`InviteDate`), which is a bare numeral rather than a line with a raised ordinal.

   Both month spellings render; `display: none` keeps the hidden one out of the accessibility tree,
   so no `aria-hidden` is needed. The `<time>` carries the ISO value so the rendered string — which
   is split across spans and duplicated for two month spellings — is still readable as one date.

   It took `weekday` and `fullMonth` props while the invite was the caller that needed the other arm
   of each. With one caller there is one behaviour, so both are gone rather than left as branches no
   render reaches. */
export function PrimaryDate({ date }: { date: FormattedDate }) {
  return (
    <time dateTime={date.iso}>
      {`${date.weekday}, `}
      {date.day}
      <span className="type-caption type-date-ordinal align-super">
        {date.ordinal}
      </span>{" "}
      <span className="md:hidden">{date.monthShort}</span>
      <span className="hidden md:inline">{date.month}</span> {date.year}
    </time>
  );
}
