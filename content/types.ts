export type RitualStatus = "upcoming" | "completed";

export interface Ritual {
  id: string;
  title: string;
  description: string;
  status: RitualStatus;
  images: string[];
}

/** Named WeddingEvent because `Event` collides with the DOM global. */
export interface WeddingEvent {
  id: string;
  name: string;
  city: string;
  date: string;
  venue: string | null;
  time: string | null;
  address: string | null;
  mapUrl: string | null;
  contactPhone: string | null;
}

export interface FamilyMember {
  id: string;
  name: string;
  relationship: string;
  portrait: string | null;
}

export interface FamilyGroup {
  id: string;
  side: "bride" | "groom";
  familyName: string;
  members: FamilyMember[];
}
