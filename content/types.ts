export type RitualStatus = "upcoming" | "completed";

export interface Ritual {
  id: string;
  title: string;
  description: string;
  status: RitualStatus;
  images: string[];
}

/** One sub-event within a day — the church service and the reception are separate places and times. */
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
  name: string;
  /** Locality alone — district and state live in each segment's `address`. */
  cityTown: string;
  date: string;
  segments: EventSegment[];
}

export interface FamilyMember {
  id: string;
  /** Display name: full for parents, first name for everyone else. */
  name: string;
  relationship: string;
  portrait: string | null;
  /** A sibling's spouse and child. Empty for everyone else. */
  family: FamilyMember[];
}

export interface FamilyGroup {
  id: string;
  side: "bride" | "groom";
  familyName: string;
  /** Mother, father, then children in birth order, eldest first. */
  members: FamilyMember[];
}

export interface InviteContent {
  eyebrow: string;
  coupleNames: string;
}

export interface WishesContent {
  passage: string;
  passageAttribution: string;
  coupleNames: string;
  wishesLine: string;
}

/** Parts, not a flat string — the ordinal renders at a smaller size than the day number. */
export interface FormattedDate {
  weekday: string;
  day: string;
  ordinal: string;
  month: string;
  /** The month abbreviated ("Jan"), derived from the same date as `month`. Both render and CSS
      shows one (DESIGN.md → Domain Components → Invite), so the hidden spelling still needs to
      exist at first paint rather than being computed client-side after the breakpoint is known. */
  monthShort: string;
  year: string;
}
