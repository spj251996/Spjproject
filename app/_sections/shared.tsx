import { events, type FormattedDate } from "@/content";

/* Events are looked up by id, so inserting one cannot repoint a section. */

export function eventById(id: string) {
  const found = events.find((event) => event.id === id);
  if (found === undefined) {
    throw new Error(`sections: no event with id "${id}" in content/events.ts`);
  }
  return found;
}

/* The event sheets' date line; the invite composes its own date as a block (`InviteDate`).

   Both month spellings render; `display: none` keeps the hidden one out of the accessibility tree,
   so no `aria-hidden` is needed. The `<time>` carries the ISO value so the rendered string — which
   is split across spans and duplicated for two month spellings — is still readable as one date. */
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
