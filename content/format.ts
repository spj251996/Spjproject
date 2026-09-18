import type { FormattedDate } from "./types.ts";

/* Locale is pinned to en-IN: it yields "Saturday, 9 January 2027" (day before month), and the site
   already declares en_IN. The ordinal is returned separately rather than concatenated because it
   renders at a smaller size than the day number — a flat string could not be styled that way. */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const DATE_PARTS = new Intl.DateTimeFormat("en-IN", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/* A separate formatter rather than a substring of the long month, which a short month is not
   guaranteed to prefix. Locale and timeZone match DATE_PARTS so the two read the same calendar. */
const MONTH_SHORT = new Intl.DateTimeFormat("en-IN", {
  month: "short",
  timeZone: "UTC",
});

/**
 * The one ISO-date rule, shared with `validate.ts` so the two cannot drift apart.
 * `new Date("2027-02-30")` rolls over to 2 March rather than failing, so the round-trip comparison —
 * not `Number.isNaN` — is what actually rejects a date the calendar does not have.
 */
export function parseIsoDate(value: string): Date | null {
  if (!ISO_DATE.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10) === value ? parsed : null;
}

function ordinalFor(day: number): string {
  if (day >= 11 && day <= 13) return "th";
  if (day % 10 === 1) return "st";
  if (day % 10 === 2) return "nd";
  if (day % 10 === 3) return "rd";
  return "th";
}

export function formatEventDate(iso: string): FormattedDate {
  const date = parseIsoDate(iso);
  if (date === null) {
    throw new Error(
      `formatEventDate: expected a real calendar date in ISO 8601 form, YYYY-MM-DD ("${iso}")`,
    );
  }
  const parts = DATE_PARTS.formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? "";
  const day = part("day");
  return {
    weekday: part("weekday"),
    day,
    ordinal: ordinalFor(Number(day)),
    month: part("month"),
    monthShort: MONTH_SHORT.format(date),
    year: part("year"),
    iso,
  };
}
