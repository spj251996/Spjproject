import type { ComponentType } from "react";
import "@/app/event-info.css";
import { eventById, PrimaryDate } from "@/app/_sections/shared";
import { eventInfoFit } from "@/app/event-info-fit";
import {
  Botanical,
  SECTION_PLACEMENT,
} from "@/components/background/botanical";
import {
  BetrothalIcon,
  LunchIcon,
  MapIcon,
  ReceptionIcon,
  WeddingIcon,
} from "@/components/icons";
import { Divider } from "@/components/layout/divider";
import { MountedPair } from "@/components/layout/mounted-pair";
import { ButtonAction } from "@/components/ui/button-action";
import {
  type EventSegment,
  formatEventDate,
  type WeddingEvent,
} from "@/content";

/* The eyebrow names the occasion plainly; the heading is the couple's phrase for it. Both are fixed
   chrome at the composition site, like Family's and Wishes' eyebrows, rather than content fields. */
const EVENT_EYEBROWS: Readonly<Record<string, string>> = {
  engagement: "Betrothal",
  wedding: "Wedding",
};

const EVENT_HEADINGS: Readonly<Record<string, string>> = {
  engagement: "A Promise",
  wedding: "A Life Together",
};

function eyebrowFor(eventId: string): string {
  const eyebrow = EVENT_EYEBROWS[eventId];
  if (eyebrow === undefined) {
    throw new Error(
      `sections: event "${eventId}" has no eyebrow. Add it to EVENT_EYEBROWS in app/_sections/event-info.tsx.`,
    );
  }
  return eyebrow;
}

function headingFor(eventId: string): string {
  const heading = EVENT_HEADINGS[eventId];
  if (heading === undefined) {
    throw new Error(
      `sections: event "${eventId}" has no heading. Add it to EVENT_HEADINGS in app/_sections/event-info.tsx.`,
    );
  }
  return heading;
}

/* Keyed by segment id, so renaming a label cannot repoint a mark. */
const SEGMENT_MARKS: Readonly<
  Record<string, ComponentType<{ size?: number }>>
> = {
  "engagement-church": BetrothalIcon,
  "engagement-reception": LunchIcon,
  "wedding-church": WeddingIcon,
  "wedding-reception": ReceptionIcon,
};

function markFor(segmentId: string) {
  const mark = SEGMENT_MARKS[segmentId];
  if (mark === undefined) {
    throw new Error(
      `sections: segment "${segmentId}" has no mark. Add it to SEGMENT_MARKS in app/_sections/event-info.tsx.`,
    );
  }
  return mark;
}

function sharedAddress(event: WeddingEvent): string {
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

/* Everything after the first comma is unbreakable, so a wrap falls after the locality and the
   state is never alone on a line. */
function AddressLine({ address }: { address: string }) {
  const comma = address.indexOf(", ");
  if (comma === -1) return address;
  return (
    <>
      {address.slice(0, comma + 2)}
      <span className="whitespace-nowrap">{address.slice(comma + 2)}</span>
    </>
  );
}

function EventSheetHeading({ event }: { event: WeddingEvent }) {
  const date = formatEventDate(event.date);
  return (
    <>
      {/* A colour utility here would override the colour `.type-eyebrow` owns. */}
      <p className="type-eyebrow">{eyebrowFor(event.id)}</p>
      <h2
        className="type-heading-xl text-ink-muted mt-space-2xs"
        data-event={event.id}
      >
        {headingFor(event.id)}
      </h2>
      <div className="flex flex-col items-center gap-space-3xs mt-space-sm">
        {/* The date carries the weight and the address steps back, the way the invite sets the same
            two lines (owner, 2026-10-07). `date-primary` and `heading-lg` share a size at every
            tier, so weight is the only thing telling these two apart. */}
        <p className="type-date-primary text-ink">
          <PrimaryDate date={date} />
        </p>
        <address className="type-heading-lg font-medium text-ink not-italic">
          <AddressLine address={sharedAddress(event)} />
        </address>
      </div>
    </>
  );
}

/* `IconBase` takes a number rather than a class, so each size renders once and CSS shows one.
   Tailwind emits the landscape variant after `md:` and `xl:`, so it overrides them; each class is
   written out whole because Tailwind finds classes by scanning source.

   Size 72 covers both the phone stack and the compact-laptop side-by-side plate, in one entry
   because a size may render only once per `PlateMark` (the array is keyed by size). */
const PLATE_MARKS = [
  {
    size: 72,
    show: "block md:hidden [@media(64rem<=width<100rem)_and_(orientation:landscape)]:block",
  },
  {
    size: 96,
    show: "hidden md:block xl:hidden [@media(width>=64rem)_and_(orientation:landscape)]:hidden",
  },
  {
    size: 112,
    show: "hidden xl:block [@media(width>=64rem)_and_(orientation:landscape)]:hidden",
  },
  {
    size: 88,
    show: "hidden [@media(width>=100rem)_and_(orientation:landscape)]:block",
  },
] as const;

function PlateMark({ segmentId }: { segmentId: string }) {
  const Mark = markFor(segmentId);
  return PLATE_MARKS.map(({ size, show }) => (
    <span className={`${show} *:block`} key={size}>
      <Mark size={size} />
    </span>
  ));
}

function Diamond() {
  return (
    <svg
      aria-hidden
      className="me-space-2xs inline-block align-middle text-accent-gold"
      fill="currentColor"
      height="6"
      viewBox="0 0 8 8"
      width="6"
    >
      <path d="M4 0 8 4 4 8 0 4Z" />
    </svg>
  );
}

/* The only break is the `<wbr>` after the time, so the diamond never ends a line. The time's gap is
   its own trailing margin, so a wrapped line starts flush with the diamond. The hidden comma is
   what a screen reader hears in the diamond's place. */
function SegmentLine({ segment }: { segment: EventSegment }) {
  return (
    <p className="type-heading-lg text-ink text-balance">
      <span className="me-space-2xs whitespace-nowrap">{segment.time}</span>
      <wbr />
      <span className="whitespace-nowrap">
        <span className="sr-only">, </span>
        <Diamond />
        {segment.label}
      </span>
    </p>
  );
}

/* Keeps hyphenated words whole. The venue line is `text-pretty`, not balanced, because balancing
   broke them. */
function VenueName({ venue }: { venue: string }) {
  const hyphenated = venue.match(/\S+-\S+/);
  if (hyphenated?.index === undefined) return venue;
  const end = hyphenated.index + hyphenated[0].length;
  return (
    <>
      {venue.slice(0, hyphenated.index)}
      <span className="whitespace-nowrap">{hyphenated[0]}</span>
      <VenueName venue={venue.slice(end)} />
    </>
  );
}

function mapLabel(segment: EventSegment): string {
  if (segment.venue === null) {
    throw new Error(
      `sections: segment "${segment.id}" has a map link but no venue; its map action is named for the venue.`,
    );
  }
  return `Map, ${segment.venue}`;
}

/* Centred in the space left below the heading block instead, the list closes to a few pixels of the
   place line as soon as the venue takes a second line.

   The phone band's gaps are half the rest's (owner, 2026-10-07): `space-sm` above the first mark
   and `space-2xs` between rows, against `space-lg` and `space-sm` from `md` up. What they give up
   is handed straight back as the card's own block padding in `EventSheet` — see the note there for
   why it has to be a trade. */
const PLATE_LIST_CLASS =
  "mx-auto mt-space-sm grid w-fit max-w-full list-none grid-cols-1 gap-x-space-md gap-y-space-2xs text-left md:mt-0 md:gap-y-space-sm [@media(width>=64rem)_and_(orientation:landscape)]:mt-space-lg [@media(width>=64rem)_and_(orientation:landscape)]:grid-cols-[auto_1fr] [@media(width>=100rem)_and_(orientation:landscape)]:mb-auto";

/* Each entry is a column subgrid, so side by side both entries share the `auto` mark column and
   their text starts at one edge. */
function PlateSegments({ segments }: { segments: EventSegment[] }) {
  return (
    // biome-ignore lint/a11y/noRedundantRoles: WebKit and VoiceOver need it once list-style is none
    <ol className={PLATE_LIST_CLASS} role="list">
      {segments.map((segment) => (
        <li
          className="col-span-full grid grid-cols-subgrid items-start gap-y-space-2xs md:gap-y-space-sm"
          key={segment.id}
        >
          <div className="flex shrink-0 justify-center text-accent-gold [@media(width>=64rem)_and_(orientation:landscape)]:pt-space-xs">
            <PlateMark segmentId={segment.id} />
          </div>
          <div className="flex min-w-0 flex-col items-center text-center [@media(width>=64rem)_and_(orientation:landscape)]:items-start [@media(width>=64rem)_and_(orientation:landscape)]:text-left">
            <SegmentLine segment={segment} />
            {segment.venue !== null && (
              <p className="type-body text-ink text-pretty">
                <VenueName venue={segment.venue} />
              </p>
            )}
            {segment.mapUrl !== null && (
              <ButtonAction
                aria-label={mapLabel(segment)}
                className="mt-space-2xs"
                href={segment.mapUrl}
                mark={<MapIcon size={24} />}
              >
                Meet us here
              </ButtonAction>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

/* `measure:fit` finds each sheet by an `h2` that is a direct child of this root `div`. Measured by
   `eventInfoFit`: any content or type change re-runs `npm run measure:fit`.

   THE PHONE PADDING IS A COUNTERWEIGHT, NOT A STYLE, and removing it does not simply tighten the
   card. The tighter plate gaps above and the smaller `--action-disc` take 56px out of a phone card;
   this hands the same 56px back, so the card's MEASURED HEIGHT does not move and `eventInfoFit`
   stays as it is.
   It has to balance because the band decides where a reduction goes. A sheet is at least
   `100svh - 2 * ground-block` tall: above roughly 844px of viewport the content sits inside that
   and slack would absorb a reduction as white, but below roughly 667px the content already
   overruns it, so the sheet follows the content and the saving comes off the PAGE while the white
   stays pinned at its padding floor. Both sides of that crossover are phones, so only a trade
   gives white on both. `md:py-0` because nothing above the phone band gives anything up. */
function EventSheet({ event }: { event: WeddingEvent }) {
  return (
    <div className="flex w-full flex-col items-center py-space-md text-center md:py-0 [@media(width>=100rem)_and_(orientation:landscape)]:flex-1">
      <EventSheetHeading event={event} />
      {/* Shows only in the tablet band, Event Info's tightest — DESIGN.md → Components →
          `divider` carries the reasoning and the revert record. Conditions written out literally:
          see ContactSection's Tailwind-content-scanner note below. */}
      <Divider className="my-space-lg hidden w-space-2xl md:block [@media(width>=64rem)_and_(orientation:landscape)]:hidden" />
      <PlateSegments segments={event.segments} />
    </div>
  );
}

/* The id scopes `measure:fit`'s selector, so a later section's `h2`s cannot leak into this fit. */
export function EventInfoSection() {
  return (
    <section className="relative" id="event-info">
      <Botanical fit={eventInfoFit} pieces={SECTION_PLACEMENT["event-info"]} />
      <MountedPair fit={eventInfoFit}>
        <EventSheet event={eventById("engagement")} />
        <EventSheet event={eventById("wedding")} />
      </MountedPair>
    </section>
  );
}
