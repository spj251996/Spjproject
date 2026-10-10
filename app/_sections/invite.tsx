import type { FramePaint } from "@/components/layout/mounted-sheet-frame";
import type { FormattedDate } from "@/content/types";
import "@/app/couple-names.css";
import "@/app/invite.css";
import { eventById, splitCoupleNames } from "@/app/_sections/shared";
import dateBlock from "@/app/invite-date.module.css";
import { inviteFit } from "@/app/invite-fit";
import {
  Botanical,
  SECTION_PLACEMENT,
} from "@/components/background/botanical";
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
        className="type-date-day col-start-3 row-start-2 justify-self-center"
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

   The painted option returns by dropping the `?? "none"` from the paint prop below, so the hero takes
   the component's `"mount"` default like every other section. NOT by deleting the prop: that would also
   sever the lab routes' override — `/thread/stock` would render a mount-painted hero over five stock
   cards — and would leave `paint` destructured and unused. The sequence it needs back is recorded in
   `DESIGN.md` → Foundations → Layout → `mounted-sheet` → The card's three paints. */
export function InviteSection({ paint }: { paint?: FramePaint }) {
  const wedding = eventById("wedding");
  const weddingDate = formatEventDate(wedding.date);
  const names = splitCoupleNames(invite.coupleNames);

  return (
    <section className="relative" id="invite">
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

            {/* THE DRAWN NAMES, and the role STAYS on the `<h1>` doing two jobs, both
                load-bearing. It is the `em` the asset's width resolves against, so the names scale
                the owner settled in Half 1 — 94/110/110/156 — still governs the lockup's size
                rather than a figure chosen in the component. And in portrait it is
                `display: flex; flex-direction: column`, which is what stacks the ALTERNATE's three
                spans when `/preview` un-hides them. `[retire]` marks the ROLE, not this use of it:
                the class goes in Phase 9 and the TOKEN it reads must not go with it.

                THE BLOCK PADDING ON THE TWO LANDSCAPE BANDS MAKES THE DRAWN NAMES SIT IN THE AIR
                THE TYPESET ONES DID (owner, 2026-10-10), and it is ASYMMETRIC because the gaps it
                is matching are. Measured ink to ink, which is the only comparison that means
                anything here — the drawn asset's box is padded by a full stroke width while a
                script line box carries ~110px of leading its ink never uses, so the two states'
                BOX gaps were identical at a constant 24/4 while a reader saw nothing of the kind:

                  band      drawn, as it was   typeset      needed
                  laptop    43.5 / 22.5        78.5 / 42.5  +35.0 above, +20.0 below
                  desktop   48.0 / 30.0        97.0 / 57.0  +49.0 above, +27.0 below

                Both bands take `pt-space-xl` + `pb-space-lg` (+36 / +20), which lands laptop
                within a pixel on both gaps. Desktop asks for more than any clearing pair can
                give — see the constraint below.

                DESKTOP IS BOUNDED BY A HARD CONSTRAINT RATHER THAN BY THE SCALE, so its pair is
                the most air that clears every window rather than the closest match. The owner's
                rule is that the invite never runs past one screen, and a wide-and-short window —
                1600x700 and 1920x700 — is where the header's own height decides that. Six
                combinations measured there: `pt-2xl/pb-xl` lands 732px in a 700px viewport,
                `pt-2xl/pb-lg` and `pt-xl/pb-xl` both 716, and `pt-xl/pb-lg` is the first that
                fits at 700. So desktop takes the same pair laptop does.
                RE-MEASURED AFTER THE VIEWBOX PAD WENT TO THREE STROKES: that change grew the
                lockup's own box, which pushed `pt-2xl/pb-lg` from 700 to 716 — a pair that had
                cleared every window before it. A padding value settled against this header is
                only valid for the geometry it was settled against.
                `pt-`/`pb-` rather than the `py-` it replaces: one value cannot serve two different
                gaps, and the whole point is that the two gaps differ.

                `layout="orientation"` rather than the plain stack, and this is a deviation from the
                plan worth knowing: the asset's stacked box is 1.35:1 where today's three-line
                portrait lockup is 0.97:1, so at landscape a stacked lockup measures 276px wide and
                205px tall in an 864px card — +40px on the header against the +37px of headroom the
                date-block round left at the desktop tier line, and a shape the owner has never
                seen. The single line is 6.09:1, reproduces today's landscape width exactly and
                comes out 81px SHORTER, so it frees headroom instead of spending it. The switch is
                `(orientation: landscape)`, the same condition the role's own rule uses, so the two
                cannot disagree. */}
            <h1 className="type-display-name text-ink mt-space-md [@media(64rem<=width<100rem)_and_(orientation:landscape)]:pt-space-xl [@media(64rem<=width<100rem)_and_(orientation:landscape)]:pb-space-lg [@media(width>=100rem)_and_(orientation:landscape)]:pt-space-xl [@media(width>=100rem)_and_(orientation:landscape)]:pb-space-lg">
              {/* 1.6 units, down from the 2.2 Wishes takes (owner, 2026-10-09: "invite one is too thick").
                  This lockup renders about 1.75x larger relative to its own viewBox, so the same
                  unit count lands that much heavier in pixels — and it only needs 0.54 to clear a
                  device pixel on its smallest band, against Wishes' 2.44. 1.6 is still three times
                  its floor: the phone hairline lands at 1.34px and the laptop line at 1.81px. */}
              <CoupleNames
                layout="orientation"
                names={invite.coupleNames}
                strokeUnits={1.6}
              />
              {/* Lever 2's alternate — today's script markup, unchanged, so the couple compare the
                  two fairly. Hidden on the published page by `app/couple-names.css`; `/preview`
                  un-hides it. It keeps `text-ink`, the colour it ships in today, while the asset
                  takes `ink-muted`. */}
              <span data-names-alt>
                {names ? (
                  <>
                    <span>{names[0]}</span>
                    <span className="type-display-name__joiner">{" & "}</span>
                    <span>{names[1]}</span>
                  </>
                ) : (
                  invite.coupleNames
                )}
              </span>
            </h1>

            {/* The invitation's own sentence, in the couple's first-person voice — the same voice as
                the eyebrow above, and a literal here for the same reason: it names the occasion rather
                than carrying any of the couple's data.

                WITHIN a beat, so `space-3xs`: the names are this sentence's subject and it does not
                stand alone. It had been flush from `{breakpoints.md}` up, which the tablet band's
                arithmetic forced; the names stepping down at that tier is what pays for the 4px now,
                so the rule is one value at every width. */}
            <p
              className="type-body text-ink-muted mt-space-3xs"
              data-invite-line
            >
              invite you to celebrate our wedding
            </p>

            {/* BETWEEN beats, so `space-md` — one value at every width, where this gap was five
                values across five tiers and no two bands read the card the same way. The
                orientation-qualified rules it replaced are gone with it; the block absorbs the
                weekday, so the header runs four elements where it ran five. */}
            <div className="mt-space-md">
              <InviteDate date={weddingDate} />
            </div>

            {/* The state, not the town: where the wedding is rather than which venue. It keeps
                `type-date-primary` at weight 500 — the invite's one remaining use of that role, and
                the reason the role is not retired here. */}
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
