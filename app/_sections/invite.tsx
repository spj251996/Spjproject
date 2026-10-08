import type { FramePaint } from "@/components/layout/mounted-sheet-frame";
import "@/app/invite.css";
import {
  eventById,
  PrimaryDate,
  splitCoupleNames,
} from "@/app/_sections/shared";
import { inviteFit } from "@/app/invite-fit";
import {
  Botanical,
  SECTION_PLACEMENT,
} from "@/components/background/botanical";
import { MountedSheet } from "@/components/layout/mounted-sheet";
import { OrnamentalDivider } from "@/components/layout/ornamental-divider";
import { formatEventDate, invite } from "@/content";

function InvitePassage() {
  return (
    <>
      {/* The rule sits 60 : 40 between the place line above it and the passage below it, centre to
          centre, whatever slack the card has: the space above grows 3 where the space below grows
          2, over floors that already hold the ratio on a card with no slack at all. The floors are
          the split's own rather than scale steps (Cross-Cutting Rules), and each is derived from
          its tier's MEASURED mark height — 22px on phone, 16px in the tablet band, 33px from
          `{breakpoints.lg}`:

            phone  21.845 + 22.310 + 10.845 = 55, and (21.845 + 11.155) / 55 = 60 %
            tablet  5.782 + 16.035 +  1.182 = 23, and ( 5.782 +  8.018) / 23 = 60 %
            laptop 16.268 + 33.465 +  5.268 = 55, and (16.268 + 16.733) / 55 = 60 %

          The mark grew from the 11px the whole drawing used to stand at, and **that growth is taken
          equally from the floor above and the floor below** — which is what keeps every block at
          the height it had before, so no measured fit moves, and keeps the 60 : 40 exact, since
          subtracting the same amount from both floors changes neither the ratio nor the total.

          Growth shares, never `1fr` rows — the reason is on the stack in `InviteSection`.

          From `{breakpoints.xl}` the floor below jumps to 32px and the 60 : 40 deliberately does
          not hold — a desktop window leaves this stack about 190px unused, so the tier with the
          most room was the one giving the passage the least air beneath the mark. DESIGN.md →
          `ornamental-divider` states the exception.

          The tablet band's block is 23px rather than 55px, and its mark is the one that does not
          grow: its landscape card already stands 717px against a 720px cap, so a 55px block leaves
          the frame no tier line and the build refuses. */}
      <div
        aria-hidden
        className="shrink-0 grow-3 basis-[21.845px] md:basis-[5.782px] lg:basis-[16.268px]"
      />

      <OrnamentalDivider />

      <div className="flex grow-2 flex-col items-center">
        <div
          aria-hidden
          className="shrink-0 grow basis-[10.845px] md:basis-[1.182px] lg:basis-[5.268px] xl:basis-[32px]"
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
   the names-to-date gap varies.

   Takes the hero card's UNPAINTED option (owner, 2026-10-05): the type sits on the page's ground,
   with no mount, stock, shadow or cut corner at any width. The frame is KEPT rather than removed,
   because it carries the height contract that makes this section exactly one screen, and because the
   thread measures `.mounted-sheet-frame__box` for its per-card draw window and falls back to the
   whole section without it — which would re-place the invite's stretch across the full window width
   and move the page's height. Dropping the paint costs neither.

   The painted option returns by deleting the one prop; the sequence it needs back is recorded in
   `DESIGN.md` → Foundations → Layout → `mounted-sheet` → The hero card's two options. */
export function InviteSection({ paint }: { paint?: FramePaint }) {
  const wedding = eventById("wedding");
  const weddingDate = formatEventDate(wedding.date);
  const names = splitCoupleNames(invite.coupleNames);

  return (
    <section className="relative">
      <Botanical fit={inviteFit} pieces={SECTION_PLACEMENT.invite} />
      <MountedSheet
        className="invite-settle"
        fit={inviteFit}
        hero
        paint={paint ?? "none"}
      >
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
            {/* A colour utility here would override the colour `.type-eyebrow` owns. The copy is a
                literal, not a content field: it names the occasion rather than carrying any of the
                couple's data, exactly like Family's and Wishes' eyebrows (owner, 2026-10-03). */}
            <p className="type-eyebrow">We are getting married</p>

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
