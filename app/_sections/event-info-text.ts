import type { EventSegment, WeddingEvent } from "../../content/types.ts";

export function sharedAddress(event: WeddingEvent): string {
  const addresses = new Set(event.segments.map((segment) => segment.address));
  if (addresses.size !== 1) {
    throw new Error(
      `sections: event "${event.id}" has segments at different addresses; the sheet header can only name one.`,
    );
  }
  const [address] = addresses;
  if (address === undefined || address === null) {
    throw new Error(
      `sections: event "${event.id}" has no address; the sheet header needs one.`,
    );
  }
  return address;
}

/* The first comma's space stays on the head, so the unbreakable tail never opens on a space. */
export function splitAddress(address: string): {
  head: string;
  tail: string | null;
} {
  const comma = address.indexOf(", ");
  if (comma === -1) return { head: address, tail: null };
  return { head: address.slice(0, comma + 2), tail: address.slice(comma + 2) };
}

export function venueRuns(venue: string): { text: string; nowrap: boolean }[] {
  const runs: { text: string; nowrap: boolean }[] = [];
  let from = 0;
  for (const hyphenated of venue.matchAll(/\S+-\S+/g)) {
    if (hyphenated.index > from) {
      runs.push({ text: venue.slice(from, hyphenated.index), nowrap: false });
    }
    runs.push({ text: hyphenated[0], nowrap: true });
    from = hyphenated.index + hyphenated[0].length;
  }
  if (from < venue.length) {
    runs.push({ text: venue.slice(from), nowrap: false });
  }
  return runs;
}

/* The spoken comma stands in for the diamond between the time and the label, so with no time there
   is nothing for it to separate. */
export function segmentLineParts(segment: EventSegment): {
  time: string | null;
  spokenSeparator: ", " | null;
  label: string;
} {
  return {
    time: segment.time,
    spokenSeparator: segment.time === null ? null : ", ",
    label: segment.label,
  };
}

export function mapLabel(segment: EventSegment): string {
  if (segment.venue === null) {
    throw new Error(
      `sections: segment "${segment.id}" has a map link but no venue; its map action is named for the venue.`,
    );
  }
  return `Meet us here, ${segment.venue}`;
}
