import type { FormattedDate } from "./types.ts";

/* Locale is pinned to en-IN: it yields "Saturday, 9 January 2027" (day before month), and the site
   already declares en_IN. The ordinal is returned separately rather than concatenated because it
   renders at a smaller size than the day number — a flat string could not be styled that way. */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function ordinalFor(day: number): string {
  if (day >= 11 && day <= 13) return "th";
  if (day % 10 === 1) return "st";
  if (day % 10 === 2) return "nd";
  if (day % 10 === 3) return "rd";
  return "th";
}

export function formatEventDate(iso: string): FormattedDate {
  if (!ISO_DATE.test(iso)) {
    throw new Error(
      `formatEventDate: expected an ISO 8601 date, YYYY-MM-DD ("${iso}")`,
    );
  }
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`formatEventDate: not a real calendar date ("${iso}")`);
  }
  const part = (type: Intl.DateTimeFormatPartTypes): string => {
    const parts = new Intl.DateTimeFormat("en-IN", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).formatToParts(date);
    return parts.find((p) => p.type === type)?.value ?? "";
  };
  const day = part("day");
  return {
    weekday: part("weekday"),
    day,
    ordinal: ordinalFor(Number(day)),
    month: part("month"),
    year: part("year"),
  };
}
