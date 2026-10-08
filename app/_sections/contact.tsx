import { contactFit } from "@/app/contact-fit";
import {
  Botanical,
  SECTION_PLACEMENT,
} from "@/components/background/botanical";
import { CallIcon, ChatIcon, LoveIcon, SprigIcon } from "@/components/icons";
import { MountedSheet } from "@/components/layout/mounted-sheet";
import type { FramePaint } from "@/components/layout/mounted-sheet-frame";
import { ButtonAction } from "@/components/ui/button-action";
import { type ContactPerson, contacts } from "@/content";

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
      {/* Always one column, never side by side: each action carries a mark as well as a label, so a
          side-by-side pair is wide enough to crowd a narrow plate, and one column keeps both
          targets the same width. */}
      {/* Flush at phone and tablet, opening to `space-2xs` from 64rem in landscape in step with the
          gap above it — the whole plate loosens at that window rather than the pair tightening
          against it. Flush does not read as touching: each 44px disc sits in a 52px target, so two
          flush actions still show 8px between their discs. */}
      {/* `w-fit` with `items-stretch` gives both actions the wider label's width, and `align="stretchStart"`
          puts both discs on that shared left edge. Centring each row independently instead left the
          two discs ~20px apart, because "WhatsApp" is wider than "Call" — which is what made the
          pair read as a ragged bulleted list (couple, 2026-10-02). Width only: Contact already
          passes one screen at 375x667, so the pair cannot afford height. */}
      <div className="mt-space-sm [@media(width>=64rem)_and_(orientation:landscape)]:mt-space-md mx-auto flex w-fit flex-col items-stretch gap-0 [@media(width>=64rem)_and_(orientation:landscape)]:gap-space-2xs">
        <ButtonAction
          align="stretchStart"
          aria-label={`Call, ${person.name}`}
          href={callHref(person.phone)}
          mark={<CallIcon size={20} />}
        >
          Call
        </ButtonAction>
        <ButtonAction
          align="stretchStart"
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

/* `data-contact-stack` on the inner div scopes `measure:fit`'s selector — the outer `#contact` section already carries the sheet's own
   padding and mount, so measuring it directly would double-count that padding against the frame's
   own addition of it. */
export function ContactSection({ paint }: { paint?: FramePaint }) {
  return (
    <section className="relative" id="contact">
      <Botanical fit={contactFit} pieces={SECTION_PLACEMENT.contact} />
      <MountedSheet fit={contactFit} paint={paint}>
        <div
          className="flex w-full flex-col items-center text-center [@media(width>=100rem)_and_(orientation:landscape)]:flex-1"
          data-contact-stack
        >
          <p className="type-eyebrow">For Assistance</p>
          <h2 className="type-heading-xl text-ink-muted mt-space-2xs">
            Get in Touch
          </h2>
          {/* The same condition `mounted-pair` goes side by side on, and the plates row below
              switches on. Absent when the plates stack — the vertical stack already separates the
              heading from the plates, so a mark between them would announce a division the layout
              has already made visible. Sized as an ornament rather than a label's companion —
              DESIGN.md → Contact carries the reasoning and the 48. Written out literally, not from
              a shared constant: Tailwind's content scanner reads class names as literal source
              text, and a name assembled through a JS template-literal variable at this spot never
              resolves to a generated rule. */}
          <SprigIcon
            className="my-space-md hidden text-accent-gold [@media(width>=64rem)_and_(orientation:landscape)]:block"
            size={48}
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
