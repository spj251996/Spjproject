export type RitualStatus = "upcoming" | "completed";

export interface Ritual {
  id: string;
  title: string;
  description: string;
  status: RitualStatus;
  images: string[];
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
  cityTown: string;
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
  eyebrow: string;
  coupleNames: string;
  /** The passage set off from the rest of the invite by the ornamental divider. */
  passage: string;
  passageAttribution: string;
}

export interface WishesContent {
  passage: string;
  passageAttribution: string;
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
