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

/* A cluster child's whole family stands on ONE row, sister then her spouse then their children, and
   the children who have no family of their own take the row after it (owner, 2026-10-08; the groom
   asked for his sister's family to read as one line).

   This replaces a nested arrangement where the nephews sat in a row of their own beneath their
   parents. The nesting in `content/family.ts` is unchanged and still expresses the relationships; only
   how it is laid out changed. `family` carries no role field, so its order is the contract
   (PROJECT.md → FamilyMember): spouse first, then the children in birth order. */

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
