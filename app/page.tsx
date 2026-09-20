import type { ComponentType } from "react";
import celebrations from "@/app/celebrations.module.css";
import { eventInfoFit } from "@/app/event-info-fit";
import { familyFit } from "@/app/family-fit";
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
  LunchIcon,
  MapIcon,
  ReceptionIcon,
  WeddingIcon,
} from "@/components/icons";
import { Divider } from "@/components/layout/divider";
import { MountedPair } from "@/components/layout/mounted-pair";
import { MountedSheet } from "@/components/layout/mounted-sheet";
import { OrnamentalDivider } from "@/components/layout/ornamental-divider";
import { ButtonAction } from "@/components/ui/button-action";
import {
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
      <OrnamentalDivider />

      <div className="mt-space-xs flex flex-col items-center">
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
      <MountedSheet fit={inviteFit} hero>
        {/* The stack fills the card so the passage can settle against its bottom edge. Auto margins
            rather than `1fr` grid rows: an auto margin collapses to 0 in `measure:fit`'s detached
            clone, so the measured height stays the content's own, while `1fr` rows held the card
            near its tallest at every width and put the section past the tablet tier's cap. */}
        <div
          className="flex h-full w-full flex-1 flex-col items-center text-center"
          data-invite-stack
        >
          <div className="my-auto flex flex-col items-center">
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

          {/* A floor under the gap the auto margins open, so the rule never crowds the date on a
              card with no slack to give. */}
          <div
            className="mt-space-lg md:mt-0 lg:mt-space-lg flex w-full flex-col items-center"
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

const PLATE_LIST_CLASS =
  "mx-auto mt-space-lg grid w-fit max-w-full list-none grid-cols-1 gap-x-space-md gap-y-space-lg text-left md:mt-0 [@media(64rem<=width<100rem)_and_(orientation:landscape)]:mt-space-lg [@media(width>=64rem)_and_(orientation:landscape)]:grid-cols-[auto_1fr] [@media(width>=100rem)_and_(orientation:landscape)]:my-auto";

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
    <section className="relative" id="family">
      <Botanical fit={familyFit} pieces={SECTION_PLACEMENT.family} />
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
            ["--celebrations-spine-x" as string]: "0.5rem",
            ["--celebrations-row-indent" as string]: "2.5rem",
            ["--celebrations-row-gap" as string]: "var(--spacing-space-xl)",
            ["--celebrations-mark-size" as string]: "0.5rem",
            ["--celebrations-mark-offset" as string]: "0.5rem",
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
                {/* `rounded-full` is the project's circle shape (DESIGN.md → Foundations → Shapes
                    lists Circle for `timeline-node`'s node dot, drawn the same way): Circle has no
                    dedicated radius token, so this matches the codebase's own convention rather
                    than a raw `border-radius: 50%`. */}
                <span
                  aria-hidden
                  className={`${celebrations.mark} rounded-full`}
                />
                <h3 className="type-heading-lg text-ink">{ritual.title}</h3>
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
            ["--wishes-figure-ratio" as string]: "560 / 573",
          }}
        >
          <p className="type-eyebrow">A life in love</p>

          <div className="mt-space-lg [@media(64rem<=width<100rem)_and_(orientation:landscape)]:mt-space-md [@media(width>=100rem)_and_(orientation:landscape)]:mt-space-lg flex w-full flex-col items-center text-center">
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

          <p className="type-heading-script mt-space-lg [@media(64rem<=width<100rem)_and_(orientation:landscape)]:mt-space-xl [@media(width>=100rem)_and_(orientation:landscape)]:mt-space-2xl">
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
            className={`${wishesStyles.signoff} type-caption text-ink-muted mt-space-lg [@media(64rem<=width<100rem)_and_(orientation:landscape)]:mt-space-2xl [@media(width>=100rem)_and_(orientation:landscape)]:mt-space-2xl text-center`}
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
    <main className="flex flex-1 flex-col">
      <InviteSection />
      <EventInfoSection />
      <FamilySection />
      <CelebrationsSection />
      <WishesSection />
    </main>
  );
}
