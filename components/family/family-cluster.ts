import type { FamilyMember } from "@/content/types";

/* `family` carries no role field: the order is the contract (PROJECT.md → FamilyMember), spouse
   first, then the children in birth order. */

export interface MemberCluster {
  row: FamilyMember[];
  children: FamilyMember[];
}

/* Members carry no role either: mother, then father, then the children in birth order
   (PROJECT.md → Naming and Ordering). */

export interface FamilyRoster {
  parents: [FamilyMember, FamilyMember];
  children: FamilyMember[];
}

export function splitRoster(members: FamilyMember[]): FamilyRoster {
  const [mother, father, ...children] = members;
  if (mother === undefined || father === undefined) {
    throw new Error(
      "family: a group's roster must open with its two parents, mother then father.",
    );
  }
  return { parents: [mother, father], children };
}

export function splitCluster(member: FamilyMember): MemberCluster {
  const [spouse, ...children] = member.family;
  return {
    row: spouse === undefined ? [member] : [member, spouse],
    children,
  };
}
