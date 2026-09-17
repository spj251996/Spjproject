import type { ComponentType } from "react";
import { eventInfoFit } from "@/app/_composition/event-info-fit";
import { familyFit } from "@/app/_composition/family-fit";
import { inviteFit } from "@/app/_composition/invite-fit";
import { Family } from "@/components/family/family";
import {
  BetrothalIcon,
  LunchIcon,
  MapIcon,
  ReceptionIcon,
  WeddingIcon,
} from "@/components/icons";
import { Divider } from "@/components/layout/divider";
import { MountedPair } from "@/components/layout/mounted-pair";
import { MountedSheet } from "@/components/layout/mounted-sheet";
import { ButtonAction } from "@/components/ui/button-action";
import {
  type EventSegment,
  events,
  type FamilyGroup,
  type FormattedDate,
  familyGroups,
  formatEventDate,
  invite,
  type WeddingEvent,
} from "@/content";

/* The page and the dev-only preview both render these, so a stale prop on the preview cannot
   silently diverge from the page. The section list itself is not shared.

   Events are looked up by id, so inserting one cannot repoint a section. */

function eventById(id: string) {
  const found = events.find((event) => event.id === id);
  if (found === undefined) {
    throw new Error(`sections: no event with id "${id}" in content/events.ts`);
  }
  return found;
}

/* The type role needs the names as separate spans. The split is presentation, so it lives here
   rather than in content; anything but two parts falls back to the whole string. */
function splitCoupleNames(coupleNames: string): [string, string] | null {
  const parts = coupleNames.split(" & ");
  return parts.length === 2 ? [parts[0], parts[1]] : null;
}

/* Both month spellings render; `display: none` keeps the hidden one out of the accessibility tree,
   so no `aria-hidden` is needed. */
function PrimaryDate({ date }: { date: FormattedDate }) {
  return (
    <>
      {date.weekday}, {date.day}
      <span className="type-caption type-date-ordinal align-super">
        {date.ordinal}
      </span>{" "}
      <span className="md:hidden">{date.monthShort}</span>
      <span className="hidden md:inline">{date.month}</span> {date.year}
    </>
  );
}

/* Measured by `inviteFit`: any content or type change re-runs `npm run measure:fit`. The section
   carries no horizontal padding, margin or width cap, because `mounted-sheet` decides the ground
   against the window's own width. The stack uses per-child margins rather than `gap-*` because only
   the names-to-date gap varies. */
export function InviteSection() {
  const wedding = eventById("wedding");
  const betrothal = eventById("engagement");
  const weddingDate = formatEventDate(wedding.date);
  const betrothalDate = formatEventDate(betrothal.date);
  const names = splitCoupleNames(invite.coupleNames);

  return (
    <section className="relative z-(--z-content)">
      <MountedSheet fit={inviteFit} hero>
        <div className="flex flex-col items-center text-center">
          {/* A colour utility here would override the colour `.type-eyebrow` owns. */}
          <p className="type-eyebrow">{invite.eyebrow}</p>

          <h1 className="type-display-name text-ink mt-space-lg">
            {names ? (
              <>
                <span>{names[0]}</span>
                <span className="type-display-name__joiner">{" & "}</span>
                <span>{names[1]}</span>
              </>
            ) : (
              invite.coupleNames
            )}
          </h1>

          <div className="flex flex-col items-center gap-space-3xs mt-space-lg [@media(width>=64rem)_and_(orientation:landscape)]:mt-space-sm">
            <p className="type-date-primary text-ink">
              <PrimaryDate date={weddingDate} />
            </p>
            <p className="type-date-primary text-ink">{wedding.cityTown}</p>
          </div>

          <div className="flex flex-col items-center gap-space-3xs mt-space-lg">
            <p className="type-eyebrow">{betrothal.name}</p>
            <p className="type-caption text-ink">
              {betrothalDate.weekday}, {betrothalDate.day}
              {betrothalDate.ordinal}{" "}
              <span className="md:hidden">{betrothalDate.monthShort}</span>
              <span className="hidden md:inline">{betrothalDate.month}</span>{" "}
              {betrothalDate.year}
            </p>
            <p className="type-caption text-ink">{betrothal.cityTown}</p>
          </div>
        </div>
      </MountedSheet>
    </section>
  );
}

const EVENT_HEADINGS: Readonly<Record<string, string>> = {
  engagement: "Betrothal",
  wedding: "Wedding",
};

function headingFor(eventId: string): string {
  const heading = EVENT_HEADINGS[eventId];
  if (heading === undefined) {
    throw new Error(
      `sections: event "${eventId}" has no heading. Add it to EVENT_HEADINGS in app/_composition/sections.tsx.`,
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
      `sections: segment "${segmentId}" has no mark. Add it to SEGMENT_MARKS in app/_composition/sections.tsx.`,
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
      <h2 className="type-heading-script text-ink">{headingFor(event.id)}</h2>
      <div className="flex flex-col items-center gap-space-3xs mt-space-2xs">
        <p className="type-date-primary text-ink">
          <PrimaryDate date={date} />
        </p>
        <p className="type-heading-lg text-ink">
          <AddressLine address={sharedAddress(event)} />
        </p>
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

const PLATE_LIST_CLASS =
  "mx-auto mt-space-lg grid w-fit max-w-full list-none grid-cols-1 gap-x-space-md gap-y-space-lg text-left md:mt-0 [@media(width>=64rem)_and_(orientation:landscape)]:mt-space-lg [@media(width>=64rem)_and_(orientation:landscape)]:grid-cols-[auto_1fr]";

/* Each entry is a column subgrid, so side by side both entries share the `auto` mark column and
   their text starts at one edge. */
function PlateSegments({ segments }: { segments: EventSegment[] }) {
  return (
    // biome-ignore lint/a11y/noRedundantRoles: WebKit and VoiceOver need it once list-style is none
    <ol className={PLATE_LIST_CLASS} role="list">
      {segments.map((segment) => (
        <li
          className="col-span-full grid grid-cols-subgrid items-start gap-y-space-sm"
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
                Map
              </ButtonAction>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

/* `measure:fit` finds each sheet by an `h2` that is a direct child of this root `div`. Measured by
   `eventInfoFit`: any content or type change re-runs `npm run measure:fit`. */
function EventSheet({ event }: { event: WeddingEvent }) {
  return (
    <div className="flex w-full flex-col items-center text-center">
      <EventSheetHeading event={event} />
      <Divider className="my-space-lg hidden w-space-2xl md:block [@media(width>=64rem)_and_(orientation:landscape)]:hidden" />
      <PlateSegments segments={event.segments} />
    </div>
  );
}

/* The id scopes `measure:fit`'s selector, so a later section's `h2`s cannot leak into this fit. */
export function EventInfoSection() {
  return (
    <section className="relative z-(--z-content)" id="event-info">
      <MountedPair fit={eventInfoFit} stackedPadding={inviteFit}>
        <EventSheet event={eventById("engagement")} />
        <EventSheet event={eventById("wedding")} />
      </MountedPair>
    </section>
  );
}

const FAMILY_EYEBROWS: Readonly<Record<FamilyGroup["side"], string>> = {
  bride: "Bride's Family",
  groom: "Groom's Family",
};

function familyGroupBySide(side: FamilyGroup["side"]) {
  const found = familyGroups.find((group) => group.side === side);
  if (found === undefined) {
    throw new Error(
      `sections: no family group with side "${side}" in content/family.ts`,
    );
  }
  return found;
}

/* The id scopes `measure:fit`'s selector. Measured by `familyFit`: any content or type change
   re-runs `npm run measure:fit`. */
export function FamilySection() {
  return (
    <section className="relative z-(--z-content)" id="family">
      <MountedPair fit={familyFit} stackedPadding={inviteFit}>
        <Family
          eyebrow={FAMILY_EYEBROWS.bride}
          group={familyGroupBySide("bride")}
        />
        <Family
          eyebrow={FAMILY_EYEBROWS.groom}
          group={familyGroupBySide("groom")}
        />
      </MountedPair>
    </section>
  );
}
