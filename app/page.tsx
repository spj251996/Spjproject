import type { ComponentType } from "react";
import celebrations from "@/app/celebrations.module.css";
import "@/app/contact.css";
import { contactFit } from "@/app/contact-fit";
import "@/app/event-info.css";
import { eventInfoFit } from "@/app/event-info-fit";
import { familyFit } from "@/app/family-fit";
import "@/app/invite.css";
import { inviteFit } from "@/app/invite-fit";
import wishesStyles from "@/app/wishes.module.css";
import { wishesFit } from "@/app/wishes-fit";
import {
  Botanical,
  SECTION_PLACEMENT,
} from "@/components/background/botanical";
import { Family } from "@/components/family/family";
import {
  BetrothalIcon,
  CallIcon,
  ChatIcon,
  LoveIcon,
  LunchIcon,
  MapIcon,
  ReceptionIcon,
  SprigIcon,
  WeddingIcon,
} from "@/components/icons";
import { MountedPair } from "@/components/layout/mounted-pair";
import { MountedSheet } from "@/components/layout/mounted-sheet";
import { OrnamentalDivider } from "@/components/layout/ornamental-divider";
import { ButtonAction } from "@/components/ui/button-action";
import {
  type ContactPerson,
  contacts,
  type EventSegment,
  events,
  type FamilyGroup,
  type FormattedDate,
  familyGroups,
  formatEventDate,
  invite,
  rituals,
  type WeddingEvent,
  wishes,
} from "@/content";

/* Events are looked up by id, so inserting one cannot repoint a section. */

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
   so no `aria-hidden` is needed. The `<time>` carries the ISO value so the rendered string — which
   is split across spans and duplicated for two month spellings — is still readable as one date. */
function PrimaryDate({
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

function InvitePassage() {
  return (
    <>
      {/* The rule sits 60 : 40 between the place line above it and the passage below it, centre to
          centre, whatever slack the card has: the space above grows 3 where the space below grows
          2, over floors of 27.5px and 16.5px that already hold the ratio on a card with no slack at
          all. The floors are the split's own rather than scale steps (Cross-Cutting Rules), and
          they are derived from the rule's MEASURED height: `ornamental-divider` is 0.6875rem, 11px
          at every tier, so 27.5 + 5.5 of 55 is exactly 60 %.

          Growth shares, never `1fr` rows — the reason is on the stack in `InviteSection`.

          The floors drop to 8.3 and 3.7 between `{breakpoints.md}` and `{breakpoints.lg}`, taking
          the floor block from 55px to 23px. That band is the one tier where the card has no height
          to spare: its landscape card already stands 717px against a 720px cap, so a 55px floor
          block leaves the frame no tier line and the build refuses. 12px of floor is what the
          layout this replaces already left there — it zeroed its own gap in the same band — so the
          band's card measures within 0.015625px of what it always did. 8.3 + 5.5 of 23 is 60 %
          exactly, the same derivation as 27.5 + 5.5 of 55. */}
      <div
        aria-hidden
        className="shrink-0 grow-3 basis-[27.5px] md:basis-[8.3px] lg:basis-[27.5px]"
      />

      <OrnamentalDivider />

      <div className="flex grow-2 flex-col items-center">
        <div
          aria-hidden
          className="shrink-0 grow basis-[16.5px] md:basis-[3.7px] lg:basis-[16.5px]"
        />
        {/* No reading-column cap: the passage is one line wherever the card is wide enough to
            hold it, and the card's own content width is the only limit that should apply. */}
        <p className="type-caption text-ink-muted text-balance">
          {invite.passage}
        </p>
        {/* The dash is chrome, not content — the citation itself is the reference alone. */}
        <p className="type-caption-italic text-ink-muted mt-space-3xs">
          {`\u2014 ${invite.passageAttribution}`}
        </p>
      </div>
    </>
  );
}

/* Measured by `inviteFit`: any content or type change re-runs `npm run measure:fit`. The section
   carries no horizontal padding, margin or width cap, because `mounted-sheet` decides the ground
   against the window's own width. The stack uses per-child margins rather than `gap-*` because only
   the names-to-date gap varies. */
export function InviteSection() {
  const wedding = eventById("wedding");
  const weddingDate = formatEventDate(wedding.date);
  const names = splitCoupleNames(invite.coupleNames);

  return (
    <section className="relative">
      <Botanical fit={inviteFit} pieces={SECTION_PLACEMENT.invite} />
      <MountedSheet className="invite-settle" fit={inviteFit} hero>
        {/* The stack fills the card so the passage can settle against its bottom edge. Growth
            shares rather than `1fr` grid rows: a share with no free space collapses to 0 in
            `measure:fit`'s detached clone, so the measured height stays the content's own, while
            `1fr` rows held the card near its tallest at every width and put the section past the
            tablet tier's cap. */}
        <div
          className="flex h-full w-full flex-1 flex-col items-center text-center"
          data-invite-stack
        >
          {/* The header holds the card's centre: this spacer and the passage below it grow by the
              same share, so the card's slack splits in two around the header. Growth rather than
              the auto margins it replaces — an auto margin absorbs every pixel of free space before
              a growth share can claim any, and the rule's own split below needs its share of it. */}
          <div aria-hidden className="grow" />

          <div className="flex flex-col items-center">
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

            <p className="type-date-primary text-ink mt-space-lg [@media(width>=64rem)_and_(orientation:landscape)]:mt-space-sm">
              <PrimaryDate date={weddingDate} weekday={false} fullMonth />
            </p>

            {/* The state, not the town: where the wedding is rather than which venue. It takes the
                date's own role at the weight the role carried before the date went bold — same
                size, not bold. */}
            <p
              className="type-date-primary font-medium text-ink mt-space-3xs"
              data-invite-place
            >
              {wedding.state}
            </p>
          </div>

          {/* `grow`, not `flex-1`: a zero basis would hand the passage half the card's height
              instead of its content plus a share of the slack. */}
          <div
            className="flex w-full grow flex-col items-center"
            data-invite-passage
          >
            <InvitePassage />
          </div>
        </div>
      </MountedSheet>
    </section>
  );
}

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
      `sections: event "${eventId}" has no eyebrow. Add it to EVENT_EYEBROWS in app/page.tsx.`,
    );
  }
  return eyebrow;
}

function headingFor(eventId: string): string {
  const heading = EVENT_HEADINGS[eventId];
  if (heading === undefined) {
    throw new Error(
      `sections: event "${eventId}" has no heading. Add it to EVENT_HEADINGS in app/page.tsx.`,
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
      `sections: segment "${segmentId}" has no mark. Add it to SEGMENT_MARKS in app/page.tsx.`,
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
        {/* The weights invert the invite's: there the date is bold over a lighter place, here the
            address carries the weight and the date steps back. */}
        <p className="type-date-primary font-medium text-ink">
          <PrimaryDate date={date} />
        </p>
        <address className="type-heading-lg text-ink not-italic">
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
   place line as soon as the venue takes a second line. */
const PLATE_LIST_CLASS =
  "mx-auto mt-space-lg grid w-fit max-w-full list-none grid-cols-1 gap-x-space-md gap-y-space-lg text-left md:mt-0 [@media(width>=64rem)_and_(orientation:landscape)]:mt-space-lg [@media(width>=64rem)_and_(orientation:landscape)]:grid-cols-[auto_1fr] [@media(width>=100rem)_and_(orientation:landscape)]:mb-auto";

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
    <div className="flex w-full flex-col items-center text-center [@media(width>=100rem)_and_(orientation:landscape)]:flex-1">
      <EventSheetHeading event={event} />
      {/* The class conditions are unchanged from the rule this replaces, and are written out
          literally rather than from a shared constant: Tailwind's content scanner reads class names
          as literal source text, so a name assembled through a template literal never resolves. */}
      <SprigIcon
        className="my-space-md hidden text-accent-gold md:block [@media(width>=64rem)_and_(orientation:landscape)]:hidden"
        size={23}
      />
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

const CONTACT_SIDES: Readonly<Record<ContactPerson["side"], string>> = {
  bride: "Bride's Side",
  groom: "Groom's Side",
};

function contactBySide(side: ContactPerson["side"]) {
  const found = contacts.find((person) => person.side === side);
  if (found === undefined) {
    throw new Error(
      `sections: no contact with side "${side}" in content/contacts.ts`,
    );
  }
  return found;
}

function callHref(phone: string) {
  return `tel:${phone}`;
}

/* WhatsApp's own link form takes the digits without the leading "+". */
function whatsAppHref(phone: string) {
  return `https://wa.me/${phone.replace(/^\+/, "")}`;
}

/* The number is spaced for reading, never stored that way — see `ContactPerson.phone` for the
   one canonical form both hrefs derive from. */
function readableNumber(phone: string) {
  const match = phone.match(/^(\+\d{2})(\d{5})(\d{5})$/);
  return match === null ? phone : `${match[1]} ${match[2]} ${match[3]}`;
}

function ContactPlate({ person }: { person: ContactPerson }) {
  return (
    <div className="flex flex-col items-center text-center [@media(width>=64rem)_and_(orientation:landscape)]:flex-1">
      {/* The side is load-bearing, not a label: the relationship below is a bare noun, and this is
          what it resolves against. */}
      <p className="type-eyebrow">{CONTACT_SIDES[person.side]}</p>
      {/* The plate's primary line, so it takes the same serif role an event plate's segment line
          takes — the system carries no bold cut of `type-body`, and a raw weight at this call site
          would be a role with no token behind it. */}
      <p className="type-heading-lg text-ink mt-space-2xs [@media(width>=64rem)_and_(orientation:landscape)]:mt-space-xs">
        {person.name}
      </p>
      {/* `portrait`'s register, down to the negative margin it uses: the relationship one step
          quieter, drawn up into the name's line. A plate names a person, as a family row does. */}
      <p className="-mt-space-3xs type-caption-italic text-ink-muted">
        {person.relationship}
      </p>
      <p
        className="type-body text-ink mt-space-2xs [@media(width>=64rem)_and_(orientation:landscape)]:mt-space-xs"
        data-contact-number
      >
        {readableNumber(person.phone)}
      </p>
      {/* Always one column, never side by side: each action carries a mark as well as a label, so a
          side-by-side pair is wide enough to crowd a narrow plate, and one column keeps both
          targets the same width. */}
      {/* Flush, with the wider gap above: each target is 44px around a 28px mark, so 8px of
          invisible tap area sits either side of every action, and at equal declared gaps the pair
          and the number above it measure the same to the eye. */}
      <div className="mt-space-sm [@media(width>=64rem)_and_(orientation:landscape)]:mt-space-md flex flex-col items-center gap-0 [@media(width>=64rem)_and_(orientation:landscape)]:gap-space-2xs">
        <ButtonAction
          aria-label={`Call, ${person.name}`}
          href={callHref(person.phone)}
          mark={<CallIcon size={20} />}
        >
          Call
        </ButtonAction>
        <ButtonAction
          aria-label={`WhatsApp, ${person.name}`}
          href={whatsAppHref(person.phone)}
          mark={<ChatIcon size={20} />}
        >
          WhatsApp
        </ButtonAction>
      </div>
    </div>
  );
}

/* Shown only where the two plates stand side by side, because that is the only place the mark has
   a between to sit in — and there it costs no height, which is what lets it exist at all: stacked,
   this section's card has under 40px to spare. The two bands are bounded rather than open-ended:
   Tailwind emits arbitrary variants in string order, so an open `>=64rem` rule is written after
   the `>=100rem` one and would beat it wherever both match. */
const CONTACT_MARK_SIZES = [
  {
    size: 72,
    show: "hidden [@media(64rem<=width<100rem)_and_(orientation:landscape)]:block",
  },
  {
    size: 112,
    show: "hidden [@media(width>=100rem)_and_(orientation:landscape)]:block",
  },
] as const;

function ContactMark() {
  return CONTACT_MARK_SIZES.map(({ size, show }) => (
    <span className={`${show} *:block`} key={size}>
      <LoveIcon size={size} />
    </span>
  ));
}

/* The id scopes `app/contact.css`'s selection exception; `data-contact-stack` on the inner div
   scopes `measure:fit`'s selector — the outer `#contact` section already carries the sheet's own
   padding and mount, so measuring it directly would double-count that padding against the frame's
   own addition of it. */
export function ContactSection() {
  return (
    <section className="relative" id="contact">
      <Botanical fit={contactFit} pieces={SECTION_PLACEMENT.contact} />
      <MountedSheet fit={contactFit}>
        <div
          className="flex w-full flex-col items-center text-center [@media(width>=100rem)_and_(orientation:landscape)]:flex-1"
          data-contact-stack
        >
          <p className="type-eyebrow">For Assistance</p>
          <h2 className="type-heading-xl text-ink-muted mt-space-2xs">
            Get in Touch
          </h2>
          {/* The same condition `mounted-pair` goes side by side on, and the plates row below
              switches on. Absent when the plates stack — a horizontal rule above a vertical stack
              of plates adds a line where the stacking has already done the separating. Written out
              literally, not from a shared constant: Tailwind's content scanner reads class names as
              literal source text, and a name assembled through a JS template-literal variable at
              this spot never resolves to a generated rule. */}
          <SprigIcon
            className="my-space-md hidden text-accent-gold [@media(width>=64rem)_and_(orientation:landscape)]:block"
            size={23}
          />
          {/* The `48rem<=width<64rem` band is bounded rather than open-ended so the tablet-width
              margin step does not also apply in a large portrait window below the landscape switch.
              From `{breakpoints.xl}` in landscape, this row takes the sheet's remaining space below
              the heading block, so the heading sits at the top rather than floating centred with
              everything else — the same `mb-auto` treatment Event Info's `PLATE_LIST_CLASS` takes
              at that band. */}
          <div className="relative mt-space-lg [@media(48rem<=width<64rem)]:mt-space-md flex w-full flex-col items-center gap-space-xl [@media(48rem<=width<64rem)]:gap-space-lg [@media(width>=64rem)_and_(orientation:landscape)]:mt-0 [@media(width>=64rem)_and_(orientation:landscape)]:flex-row [@media(width>=64rem)_and_(orientation:landscape)]:items-start [@media(width>=64rem)_and_(orientation:landscape)]:gap-0 [@media(width>=100rem)_and_(orientation:landscape)]:mb-auto">
            <ContactPlate person={contactBySide("bride")} />
            {/* Between the two sides, not above them: the mark is what joins them.
                Out of flow, and that is load-bearing twice over. It is decoration sitting in the
                gap the columns already leave, so it must not drive the card's height — and
                `measure:fit` sweeps the measured clone's own width rather than the viewport, so a
                media query inside the clone never re-evaluates during the sweep. In flow, the
                harness would measure this mark into every width band including the stacked ones it
                never renders in, and the tablet card has no height to give. */}
            <span className="-translate-x-1/2 -translate-y-1/2 absolute top-1/2 left-1/2 text-accent-gold">
              <ContactMark />
            </span>
            <ContactPlate person={contactBySide("groom")} />
          </div>
        </div>
      </MountedSheet>
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
    <section className="relative" id="family">
      <Botanical fit={familyFit} pieces={SECTION_PLACEMENT.family} />
      <MountedPair fit={familyFit}>
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

/* The placeholder timeline card. The section is tall (`mounted-sheet`'s tall mode), so it takes no
   measured fit — it grows to its content and the page scrolls past it. Phase 6 replaces the whole
   interior with the real timeline; only the frame and the header are meant to survive. */
/* Two lines, not one paragraph, because the second does different work: it is what tells a guest
   photographs arrive here after the wedding, so it is set apart and set in italic. The card would
   otherwise read as finished rather than as still to come. */
const CELEBRATIONS_INTRO =
  "A look at the ceremonies and rituals that shape our wedding.";
const CELEBRATIONS_PROMISE =
  "Moments leading up to the day, shared as they unfold.";

/* No `mt-*` utility here: `celebrations.list`'s own `margin: 0` is a plain, unlayered rule, so it
   always beats a Tailwind margin utility regardless of value — the gap has to be set inside the
   module instead (celebrations.module.css), through `--celebrations-intro-gap`. */
const CELEBRATIONS_LIST_CLASS = `${celebrations.list} flex flex-col`;

export function CelebrationsSection() {
  return (
    <section className="relative" id="celebrations">
      <Botanical pieces={SECTION_PLACEMENT.celebrations} />
      <MountedSheet tall>
        <div
          className="flex w-full max-w-(--celebrations-measure) flex-col items-center text-center"
          style={{
            ["--celebrations-measure" as string]: "36rem",
            ["--celebrations-row-gap" as string]: "var(--spacing-space-xl)",
            ["--celebrations-intro-gap" as string]: "var(--spacing-space-lg)",
          }}
        >
          {/* A colour utility here would override the colour `.type-eyebrow` owns. */}
          <p className="type-eyebrow">Our traditions</p>
          <h2 className="type-heading-xl text-ink-muted mt-space-2xs">
            The Celebrations
          </h2>

          <div className="mt-space-2xs flex flex-col gap-space-sm">
            <p className="type-body text-ink text-pretty">
              {CELEBRATIONS_INTRO}
            </p>
            <p className="type-body-italic text-ink text-pretty">
              {CELEBRATIONS_PROMISE}
            </p>
          </div>

          {/* biome-ignore lint/a11y/noRedundantRoles: WebKit and VoiceOver need it once list-style is none */}
          <ol className={CELEBRATIONS_LIST_CLASS} role="list">
            {rituals.map((ritual) => (
              <li className={`${celebrations.row} text-left`} key={ritual.id}>
                {/* The mark sits on the title's own line so a wrapping description cannot orphan
                    it. `items-baseline` rather than `items-center`: the mark reads as punctuation
                    opening the title, and punctuation sits on the text's baseline. */}
                <div className="flex items-baseline gap-space-2xs">
                  <SprigIcon className="shrink-0 text-accent-gold" size={32} />
                  <h3 className="type-heading-lg text-ink">{ritual.title}</h3>
                </div>
                <p className="type-body text-ink mt-space-2xs text-pretty">
                  {ritual.description}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </MountedSheet>
    </section>
  );
}

/* The page's close. The illustration's size and bleed
   distance are settled in DESIGN.md → Wishes; it takes no crop, mask or edge fade of its own. The
   illustration is static — Phase 4 renders no motion, and its entrance is decided in Phase 5 with
   the thread. */
export function WishesSection() {
  const wishesNames = splitCoupleNames(wishes.coupleNames);

  return (
    <section className="relative" id="wishes">
      <Botanical fit={wishesFit} pieces={SECTION_PLACEMENT.wishes} />
      <MountedSheet fit={wishesFit}>
        <div
          className={`${wishesStyles.stack} wishes-stack flex w-full flex-col items-center`}
          style={{
            /* The drawing's own proportions once its transparent border is trimmed off. */
            ["--wishes-figure-ratio" as string]: "560 / 550",
          }}
        >
          <p className="type-eyebrow">A life in love</p>

          {/* This gap and the two below halve at phone, with `.figureCol`'s in `wishes.module.css`
              — the fourth of the same four, where the reason is written. */}
          <div className="mt-space-sm md:mt-space-lg [@media(64rem<=width<100rem)_and_(orientation:landscape)]:mt-space-md [@media(width>=100rem)_and_(orientation:landscape)]:mt-space-lg flex w-full flex-col items-center text-center">
            <p className="type-body text-pretty">{wishes.passage}</p>
            {/* The dash is chrome, not content — the citation itself is the reference alone, the
                same treatment the invite's citation gets. */}
            <p className="type-caption-italic text-ink-muted mt-space-xs [@media(64rem<=width<100rem)_and_(orientation:landscape)]:mt-space-sm [@media(width>=100rem)_and_(orientation:landscape)]:mt-space-md">
              {`— ${wishes.passageAttribution}`}
            </p>
          </div>

          <div className={wishesStyles.figureCol}>
            <div aria-hidden className={wishesStyles.figure} />
          </div>

          <p className="type-heading-script mt-space-sm md:mt-space-lg [@media(64rem<=width<100rem)_and_(orientation:landscape)]:mt-space-xl [@media(width>=100rem)_and_(orientation:landscape)]:mt-space-2xl">
            {wishesNames ? (
              <>
                <span>{wishesNames[0]}</span>
                <span className="type-heading-script__joiner">{" & "}</span>
                <span>{wishesNames[1]}</span>
              </>
            ) : (
              wishes.coupleNames
            )}
          </p>

          {/* Two lines in both layouts: the lead in italic, the names who send it in regular. */}
          <p
            className={`${wishesStyles.signoff} type-caption text-ink-muted mt-space-sm md:mt-space-lg [@media(64rem<=width<100rem)_and_(orientation:landscape)]:mt-space-2xl [@media(width>=100rem)_and_(orientation:landscape)]:mt-space-2xl text-center`}
          >
            <span className="type-caption-italic">{wishes.wishesLead}</span>
            <span>{wishes.wishesLine}</span>
          </p>
        </div>
      </MountedSheet>
    </section>
  );
}

export default function Home() {
  return (
    <main className="flex flex-1 flex-col overflow-y-clip">
      <InviteSection />
      <EventInfoSection />
      <ContactSection />
      <FamilySection />
      <CelebrationsSection />
      <WishesSection />
    </main>
  );
}
