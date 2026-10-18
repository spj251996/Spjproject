/** One ritual photograph's three deliveries and the display copy's post-rotation dimensions.
    Written by `scripts/generate-images.mjs` into `content/ritual-photos.generated.ts`, which is
    gitignored — this type is committed so a fresh clone still typechecks the shape.

    The dimensions are the EMITTED file's own, straight off sharp's `toFile`, so they are
    post-rotation by construction. The aspect is scale-invariant, which is all `photoFit` needs. */
export interface RitualPhoto {
  /** Web path to the copy bounded 600×600 that the preview strip renders. */
  thumb: string;
  /** Web path to the 1000px-wide copy the grid renders. Also the photograph's identity. */
  display: string;
  /** Web path to the copy bounded 2000×2000 that the full-screen viewer shows. Fetched only for the
      photograph on screen. */
  full: string;
  width: number;
  height: number;
}

export interface Ritual {
  id: string;
  title: string;
  /** The ritual's name in Malayalam, shown beside the English title at every band. */
  malayalam: string;
  /** One line, set in italic beneath the title. */
  tagline: string;
  description: string;
}

export interface EventSegment {
  id: string;
  label: string;
  time: string | null;
  venue: string | null;
  address: string | null;
  mapUrl: string | null;
}

/** Named WeddingEvent because `Event` collides with the DOM global. */
export interface WeddingEvent {
  id: string;
  /** The state the event is held in. Read by the invite, printed beneath the date. */
  state: string;
  date: string;
  segments: EventSegment[];
}

export interface FamilyMember {
  id: string;
  name: string;
  relationship: string;
  portrait: string | null;
  family: FamilyMember[];
}

export interface FamilyGroup {
  id: string;
  side: "bride" | "groom";
  familyName: string;
  members: FamilyMember[];
}

export interface InviteContent {
  coupleNames: string;
  /** The passage set off from the rest of the invite by the ornamental divider — laptops and desktops. */
  passage: string;
  passageAttribution: string;
  /** The passage phones and tablets read instead (owner, 2026-10-14). */
  handheldPassage: string;
  handheldPassageAttribution: string;
}

export interface WishesContent {
  /** Laptops and desktops. */
  passage: string;
  passageAttribution: string;
  /** The passage phones and tablets read instead (owner, 2026-10-14). */
  handheldPassage: string;
  handheldPassageAttribution: string;
  coupleNames: string;
  /** The sign-off's opening line; its names follow in `wishesLine`. */
  wishesLead: string;
  wishesLine: string;
}

/** Parts, not a flat string — the ordinal renders at a smaller size than the day number. */
export interface FormattedDate {
  weekday: string;
  day: string;
  ordinal: string;
  month: string;
  /** Both spellings exist at first paint, so CSS picks one without client code. */
  monthShort: string;
  year: string;
  /** The ISO date this was formatted from, carried so a caller can emit `<time datetime>` without
      being handed the raw value separately. */
  iso: string;
}
