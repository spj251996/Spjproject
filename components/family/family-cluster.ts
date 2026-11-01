import type { FamilyMember } from "@/content/types";

/* Members carry no role field: mother, then father, then the children in birth order
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

/* A cluster child's whole family stands on ONE row (sister, then her spouse, then their children) so
   the sister's family reads as one line; the children with no family of their own take the row after
   it. `content/family.ts` keeps the nesting, which still expresses the relationships; only the layout
   flattens it. `family` carries no role field, so its order is the contract (PROJECT.md →
   FamilyMember): spouse first, then the children in birth order. */

export function flattenCluster(member: FamilyMember): FamilyMember[] {
  return [member, ...member.family];
}

export interface ChildRows {
  clusters: FamilyMember[];
  plain: FamilyMember[];
}

export function splitChildren(children: FamilyMember[]): ChildRows {
  return {
    clusters: children.filter((child) => child.family.length > 0),
    plain: children.filter((child) => child.family.length === 0),
  };
}
