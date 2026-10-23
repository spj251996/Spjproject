import type { FormattedDate } from "@/content/types";
import "@/app/invite.css";
import { eventById } from "@/app/_sections/shared";
import dateBlock from "@/app/invite-date.module.css";
import "@/app/frames/invite.css";
import { inviteFit } from "@/app/invite-fit";
import { Botanical } from "@/components/background/botanical";
import { SECTION_PLACEMENT } from "@/components/background/botanical-placement";
import { MountedSheet } from "@/components/layout/mounted-sheet";
import { OrnamentalDivider } from "@/components/layout/ornamental-divider";
import { CoupleNames } from "@/components/ui/couple-names";
import { formatEventDate, invite } from "@/content";

/* The wedding date as a bracketed figure — DESIGN.md → Domain Components → Invite → `date-block`,
   which owns every ratio and every reason. The geometry is in `invite-date.module.css`; what is here
   is the figure's parts and where they sit in its grid.

   It composes the date's parts itself rather than taking `PrimaryDate`, which renders one line with a
   raised ordinal. The block's day is a BARE numeral: a superscript inside the bracket collides with
   the rule. */
function InviteDate({ date }: { date: FormattedDate }) {
  const hairline = (
    <span className={dateBlock.hairlineAnchor}>
      <span aria-hidden className={dateBlock.hairline} />
    </span>
  );

  return (
    <div className={`${dateBlock.block} text-ink`} data-invite-date>
      <p
        className={`type-date-label ${dateBlock.weekday} col-start-3 row-start-1`}
      >
        {date.weekday}
      </p>
      <p
        className={`type-date-label ${dateBlock.label} col-start-1 row-start-2 justify-self-end`}
      >
        {date.monthShort}
      </p>
      <span className="col-start-2 row-start-2">{hairline}</span>
      {/* The `<time>` carries the ISO value, so a date split across five elements is still readable
          as one date. */}
      <time
        className="type-date-day col-start-3 row-start-2 justify-self-center text-accent-gold"
        dateTime={date.iso}
      >
        {date.day}
      </time>
      <span className="col-start-4 row-start-2">{hairline}</span>
      <p
        className={`type-date-label ${dateBlock.label} col-start-5 row-start-2 justify-self-start`}
      >
        {date.year}
      </p>
    </div>
  );
}

function InvitePassage() {
  return (
    <>
      {/* The rule sits 60 : 40 between the place line above it and the passage below it, centre to
          centre, whatever slack the card has: the space above grows 3 where the space below grows
          2, over floors that hold the ratio on a card with no slack. Each floor is derived from its
          tier's measured mark height, so the floors are the split's own rather than scale steps
          (Cross-Cutting Rules). Growth shares, never `1fr` rows: the reason is on the stack in
          `InviteSection`.

          From `{breakpoints.xl}` the floor below is 32px and the 60 : 40 deliberately does not hold,
          because a desktop window leaves this stack about 190px unused (DESIGN.md →
          `ornamental-divider`).

          On an upright phone neither spacer grows: names, sentence, date and rule sit one 22px ink
          gap apart, and 13px lands the rule's ink there, measured rather than derived because the
          mark's box adds 9px of air above its ink. DESIGN.md → Domain Components → Invite. */}
      <div
        aria-hidden
        className="shrink-0 grow-3 basis-[17.345px] md:basis-[5.782px] lg:basis-[16.268px] [@media(width<48rem)_and_(orientation:portrait)]:grow-0 [@media(width<48rem)_and_(orientation:portrait)]:basis-[13px]"
      />

      <OrnamentalDivider />

      <div className="flex grow-2 flex-col items-center">
        <div
          aria-hidden
          className="shrink-0 grow basis-[7.845px] md:basis-[1.182px] lg:basis-[5.268px] xl:basis-[32px] [@media(width<48rem)_and_(orientation:portrait)]:grow-0"
        />
        {/* No reading-column cap: the passage is one line wherever the card is wide enough to
            hold it, and the card's own content width is the only limit that should apply. */}
        {/* Two passages, one per device class (owner, 2026-10-14): phones and tablets read the
            handheld one, laptops and desktops the other. `display: contents` keeps each pair's two
            lines as items of this column, and the pair not shown is `display: none`, so it is
            neither measured by `inviteFit` nor read twice. The swap is width alone, at
            `{breakpoints.lg}` — the width tier `measure:fit` sweeps on either side of. */}
        {[
          {
            show: "contents lg:hidden",
            text: invite.handheldPassage,
            cite: invite.handheldPassageAttribution,
          },
          {
            show: "hidden lg:contents",
            text: invite.passage,
            cite: invite.passageAttribution,
          },
        ].map(({ show, text, cite }) => (
          <div className={show} key={cite}>
            <p className="type-caption text-ink-muted text-balance">{text}</p>
            {/* The dash is chrome, not content — the citation itself is the reference alone. */}
            <p className="type-caption-italic text-ink-muted mt-space-3xs">
              {`\u2014 ${cite}`}
            </p>
          </div>
        ))}
      </div>
    </>
  );
}

/* Measured by `inviteFit`: any content or type change re-runs `npm run measure:fit`. The section
   carries no horizontal padding, margin or width cap, because `mounted-sheet` decides the ground
   against the window's own width. The stack uses per-child margins rather than `gap-*` because only
   the names-to-date gap varies.

   The hero is UNPAINTED (owner, 2026-10-05; final 2026-10-14): the type sits on the page's ground,
   with no mount, stock, shadow or cut corner at any width. The frame is KEPT rather than removed,
   because it carries the height contract that makes this section exactly one screen, and because the
   thread measures `.mounted-sheet-frame__box` for its per-card draw window and falls back to the
   whole section without it — which would re-place the invite's stretch across the full window width
   and move the page's height. Dropping the paint costs neither. */
export function InviteSection() {
  const wedding = eventById("wedding");
  const weddingDate = formatEventDate(wedding.date);

  return (
    <section className="relative" id="invite">
      {/* `corners`: the opening grows these pieces from their own corners (`app/invite.css`). */}
      <Botanical corners fit={inviteFit} pieces={SECTION_PLACEMENT.invite} />
      <MountedSheet fit={inviteFit} hero>
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
                literal, not a content field: a blessing rather than any of the couple's data (owner,
                2026-10-14), a literal like Family's and Wishes' eyebrows (owner, 2026-10-03). */}
            <p className="type-eyebrow">By God’s Grace</p>

            {/* The `<h1>` takes `--text-display-name` as its font size and nothing else: it is the
                `em` the drawn names' width resolves against, which is why that size token outlives
                the retired typeset names.

                On the two landscape bands the block padding matches the air the typeset names had,
                measured ink to ink, and is asymmetric because those gaps are; `pt-`/`pb-` rather
                than `py-` for that reason. Desktop takes the same pair as laptop because the invite
                must never run past one screen and a wide, short window (1600x700) refuses anything
                larger; re-measure it after any change to the lockup's box.

                `layout="orientation"`: at landscape the single line is shorter than the stacked
                lockup, which would overspend the header's headroom. */}
            <h1 className="text-(length:--text-display-name) text-ink mt-space-md [@media(width<48rem)_and_(orientation:portrait)]:mb-(--invite-names-gap) [@media(64rem<=width<100rem)_and_(orientation:landscape)]:pt-space-xl [@media(64rem<=width<100rem)_and_(orientation:landscape)]:pb-space-lg [@media(width>=100rem)_and_(orientation:landscape)]:pt-space-xl [@media(width>=100rem)_and_(orientation:landscape)]:pb-space-lg">
              {/* 1.6 units, down from the 2.2 Wishes takes.
                  This lockup renders about 1.75x larger relative to its own viewBox, so the same
                  unit count lands that much heavier in pixels — and it only needs 0.54 to clear a
                  device pixel on its smallest band, against Wishes' 2.44. 1.6 is still three times
                  its floor: the phone hairline lands at 1.34px and the laptop line at 1.81px. */}
              <CoupleNames
                layout="orientation"
                names={invite.coupleNames}
                strokeUnits={1.6}
              />
            </h1>

            {/* The invitation's own sentence, in the families' voice — third person, with the names
                above as its subject (owner, 2026-10-14) — and a literal here for the same reason as
                the eyebrow: it carries none of the couple's data.

                WITHIN a beat, so `space-3xs`: the names are this sentence's subject and it does not
                stand alone. On an upright phone `mt-[calc(var(--spacing-space-xs)-2px)]` replaces
                it. */}
            <p
              className="type-body text-ink-muted mt-space-3xs [@media(width<48rem)_and_(orientation:portrait)]:mt-[calc(var(--spacing-space-xs)-2px)]"
              data-invite-line
            >
              joyfully invite you to share in the celebration of their wedding
            </p>

            {/* BETWEEN beats: `space-md` from `{breakpoints.md}` up and `space-3xs` on a phone, which
                brings the invite inside one phone screen, each plus `--date-place-pull`; on an
                upright phone the gap is `--date-place-pull` alone. The block absorbs the weekday,
                so the header runs four elements where it ran five. `--date-place-pull` is what the
                place beneath takes back off its own margin: the block
                sits as close to the place as its weekday sits to its day. The place's own margin is
                `space-3xs` plus `--date-open` (8 / 12 / 11 / 12px by tier) because both of the block's
                inner gaps are opened by `--date-open` — the weekday's half
                lives in `--date-weekday-pull`. */}
            <div className="mt-[calc(var(--spacing-space-3xs)+var(--date-place-pull))] md:mt-[calc(var(--spacing-space-md)+var(--date-place-pull))] [@media(width<48rem)_and_(orientation:portrait)]:mt-(--date-place-pull)">
              <InviteDate date={weddingDate} />
            </div>

            {/* The state, not the town: where the wedding is rather than which venue. It keeps
                `type-date-primary` at weight 500 — the invite's one remaining use of that role, and
                the reason the role is not retired here. */}
            <p
              className="type-date-primary font-medium text-ink mt-[calc(var(--spacing-space-3xs)+var(--date-open)-var(--date-place-pull))]"
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
