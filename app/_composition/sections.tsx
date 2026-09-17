import type { ComponentType } from "react";
import { eventInfoFit } from "@/app/_composition/event-info-fit";
import { inviteFit } from "@/app/_composition/invite-fit";
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
  type FormattedDate,
  formatEventDate,
  invite,
  type WeddingEvent,
} from "@/content";

/* The page and the dev-only preview route both render these. Sharing the WIRING is the point: a
   stale prop on the preview would poison the design judgement the preview exists to support, and
   nothing detects that — it typechecks, lints and renders. The section LIST is deliberately not
   shared. It is five lines in the phase's fixed order, visible at a glance in both files, and a
   missing entry shows the moment you scroll.

   Content is looked up by id rather than by array position so inserting an event cannot silently
   repoint the invite at the wrong one. */

function eventById(id: string) {
  const found = events.find((event) => event.id === id);
  if (found === undefined) {
    throw new Error(`sections: no event with id "${id}" in content/events.ts`);
  }
  return found;
}

/* The couple-names role sets three lines in portrait windows and stays one line in landscape
   (DESIGN.md → Foundations → Typography), which needs the two names as separate spans rather than
   one string — the split lives here, not in content, because it is presentation of
   `invite.coupleNames`, not a second copy of it. Falls back to the whole string in one span if it
   ever does not split into exactly two parts, so a future edit to the content can't render blank. */
function splitCoupleNames(coupleNames: string): [string, string] | null {
  const parts = coupleNames.split(" & ");
  return parts.length === 2 ? [parts[0], parts[1]] : null;
}

/* The primary date line's content: the ordinal set small and raised, and both month spellings with
   CSS showing one by `{breakpoints.md}` — first paint is already right, and `display: none` keeps
   the hidden spelling out of the accessibility tree. Shared by the invite and both event sheets. */
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

/* DESIGN.md → Domain Components → Invite [inline]. Moved inline from the retired
   components/invite/invite.tsx once the frame moved into `mounted-sheet` itself (interlude,
   2026-09-15): the section is now a short stack of text with no state or behaviour of its own, and
   the only extraction trigger it still met was the gallery rendering it — the gallery now lists it
   instead (app/design-system/_sections/domain.tsx).

   Server-rendered, no client boundary. The thread draw-in and the scroll-cue this section is
   credited with belong entirely to `thread-overlay`, which is not mounted during Phase 4 — so the
   invite carries no scroll cue until Phase 5. That is a dated gap against PROJECT.md → Sections →
   Invite, recorded in work/session.md, not an oversight here.

   Takes the two event records rather than flat date and city strings: PROJECT.md → Content Model →
   InviteContent requires both to be read from the WeddingEvent records so a corrected date cannot
   drift between this section and Event Info.

   The date renders through `formatEventDate` because the ordinal sets smaller than the day number,
   which a flat string cannot express (content/format.ts).

   The markup below is measured against by `inviteFit`; every content or type change re-runs
   `npm run measure:fit`. The frame's own contract (mounted-sheet.tsx) forbids horizontal padding,
   margin or width cap around the frame scope, which is why this section carries none: `mounted-sheet`
   decides the ground against the window's own width.

   Three things in this markup lean on rules that live outside this file, all in DESIGN.md →
   Domain Components → Invite:
   - The couple names split into three spans (`splitCoupleNames` above) so the couple-names TYPE
     ROLE can set them on three lines in portrait and one line in landscape — the stacking, the
     ampersand's 0.5em size and the 0.9 line spacing are `.type-display-name`'s own rules in
     app/styles/type-scale.css, not this section's, because the doc states the split as "a property
     of the role wherever it is used."
   - Both month spellings render for every date; `md:hidden` / `hidden md:inline` pick one by the
     same `{breakpoints.md}` the type ladder already switches on, so first paint is already correct
     and the hidden spelling is never announced to assistive technology (`display: none` removes it
     from the accessibility tree, so no separate `aria-hidden` is needed).
   - The stack's gaps are explicit margins, not one `gap-*` on the parent, because only the
     names-to-date gap changes with width (32px below `{breakpoints.lg}`, 16px from it up) while the
     other two stay 32px at every tier. */
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
          {/* `.type-eyebrow` owns its colour. Never pair it with a colour utility. */}
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

          <div className="flex flex-col items-center gap-space-3xs mt-space-lg lg:mt-space-sm">
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

/* The sheet's script heading names the event the way the couple speak of it, shorter than the
   content model's formal name. Keyed by event id; a missing id fails the build. */
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

/* Which mark a segment carries is presentation, not a fact about the event, so it lives here rather
   than in the content model (DESIGN.md → Domain Components → Event Info). Keyed by segment id, so
   renaming a label cannot silently repoint a mark; a segment missing here fails the build rather
   than rendering a label with no mark beside it. */
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
      `sections: segment "${segmentId}" has no mark. Add it to SEGMENT_MARKS in app/_composition/sections.tsx (DESIGN.md → Domain Components → Event Info).`,
    );
  }
  return mark;
}

/* Both segments of an event sit at one address today, so the sheet names it once, beneath the
   heading, and each segment keeps only its venue and map link. If the segments ever diverge the
   build fails here rather than printing one address for two places. The content model allows a
   null address, but the header has no form without one, so a missing address fails the build too. */
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

/* One line where it fits. Where it does not, it breaks only after the locality — "Paroppadi, /
   Kozhikode, Keralam" — because everything after the first comma never wraps, so the state is
   never left alone on a line. */
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

/* The heading block: the script name, then the date line and the event's address, which separate
   by weight alone at one size. */
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

/* Every class below that carries the arbitrary variant
   `[@media(width>=64rem)_and_(orientation:landscape)]:` applies only where the pair sits side by
   side — the frame's own `pairsSideBySide` condition, a landscape window at `{breakpoints.lg}` and
   wider. One window media condition drives the whole side-by-side form, so first paint is already
   right and `measure:fit`, which sets each window's orientation, measures what the window shows.
   Tailwind emits this variant after its `md:` and `lg:` rules, so it overrides them. Tailwind finds
   classes by scanning source, so each is written out whole. */

/* Stacked, the mark steps with the type tiers; side by side it takes one size of its own.
   `IconBase` takes a number rather than a class, so each size renders once and CSS shows exactly
   one. */
const PLATE_MARKS = [
  {
    size: 72,
    show: "block md:hidden [@media(width>=64rem)_and_(orientation:landscape)]:hidden",
  },
  {
    size: 96,
    show: "hidden md:block lg:hidden [@media(width>=64rem)_and_(orientation:landscape)]:hidden",
  },
  {
    size: 112,
    show: "hidden lg:block [@media(width>=64rem)_and_(orientation:landscape)]:hidden",
  },
  {
    size: 88,
    show: "hidden [@media(width>=64rem)_and_(orientation:landscape)]:block",
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

/* A square turned on its point, drawn as a path so it needs no transform. */
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

/* The time, a gold diamond and the label on one line. The diamond, the hidden comma and the whole
   label are one unbreakable run, so the only break is the `<wbr>` after the time: a wrapped line
   reads "10:00 AM / ◆ Church Ceremony" and the diamond never ends a line. The time's gap to the
   diamond is its own trailing margin, so a wrapped second line starts flush with the diamond. A
   screen reader hears the hidden comma in the diamond's place: "10:00 AM, Church Betrothal". */
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

/* A hyphenated word never breaks at its hyphen: "Syro-Malabar" stays whole. The venue is set
   `pretty` rather than balanced, because balancing broke that word. */
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

/* The segments as engraved plates, an ordered list centred in the sheet at its own width. Each
   entry is a column subgrid: stacked, one column, so the mark leads and the centred details follow
   it; side by side, the mark stands in an `auto` column shared by both entries, so it is as wide as
   the sheet's widest mark and both entries' text starts at one edge. Side by side the mark drops to
   meet the segment line's cap height. Below `{breakpoints.md}` and side by side there is no rule
   after the heading, so the list stands `space-lg` off it; on stacked sheets from `md` up the
   rule's own margins set the gap. */
function PlateSegments({ segments }: { segments: EventSegment[] }) {
  return (
    <ol className="mx-auto mt-space-lg grid w-fit max-w-full list-none grid-cols-1 gap-x-space-md gap-y-space-lg text-left md:mt-0 [@media(width>=64rem)_and_(orientation:landscape)]:mt-space-lg [@media(width>=64rem)_and_(orientation:landscape)]:grid-cols-[auto_1fr]">
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
                aria-label={`Map, ${segment.venue}`}
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

/* One event's sheet. The `h2` stays a direct child of this root `div`: `measure:fit` finds each
   sheet by it. The rule after the heading is the `divider`, cut to `space-2xl`. Measured by
   `eventInfoFit` — any content or type change re-runs `npm run measure:fit`. */
function EventSheet({ event }: { event: WeddingEvent }) {
  return (
    <div className="flex w-full flex-col items-center text-center">
      <EventSheetHeading event={event} />
      <Divider className="my-space-lg hidden w-space-2xl md:block [@media(width>=64rem)_and_(orientation:landscape)]:hidden" />
      <PlateSegments segments={event.segments} />
    </div>
  );
}

/* DESIGN.md → Domain Components → Event Info [inline]. Server-rendered, no client boundary. No
   section heading: each sheet leads with its event name. The id scopes `measure:fit`'s selector to
   this section, so a later section's `h2` stacks cannot leak into its fit. Stacked cards take the
   invite's padding. Entrance motion and the thread's passage are Phase 5 (DESIGN.md → Iteration
   Notes → Open Decisions). */
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
