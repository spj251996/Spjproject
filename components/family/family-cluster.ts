import type { FamilyMember } from "@/content/types";

/* `family` carries no role field: the order is the contract (PROJECT.md → FamilyMember), spouse
   first, then the children in birth order. */

export interface MemberCluster {
  row: FamilyMember[];
  children: FamilyMember[];
}

export function splitCluster(member: FamilyMember): MemberCluster {
  const [spouse, ...children] = member.family;
  return {
    row: spouse === undefined ? [member] : [member, spouse],
    children,
  };
}
