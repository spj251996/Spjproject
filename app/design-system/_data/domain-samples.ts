import type { FamilyGroup } from "@/content/types";

/* The two groups mirror the real roster's shape: the bride's two siblings, and the groom's sibling
   with a spouse and a child beside a second sibling. Family's name overruns are verified against the
   real roster only, so each sample name is no wider than the real name in the same slot, and each
   relationship is the real one for that slot; a wider sample would collide where the page does not. */

export const sampleFamilyGroups: FamilyGroup[] = [
  {
    id: "placeholder-bride-family",
    side: "bride",
    familyName: "Bride Family",
    members: [
      {
        id: "placeholder-bride-parent-1",
        name: "Parent",
        relationship: "Mother",
        portrait: null,
        family: [],
      },
      {
        id: "placeholder-bride-parent-2",
        name: "Parent",
        relationship: "Father",
        portrait: null,
        family: [],
      },
      {
        id: "placeholder-bride-sibling-1",
        name: "Name",
        relationship: "Bride",
        portrait: null,
        family: [],
      },
      {
        id: "placeholder-bride-sibling-2",
        name: "Kin",
        relationship: "Brother",
        portrait: null,
        family: [],
      },
    ],
  },
  {
    id: "placeholder-groom-family",
    side: "groom",
    familyName: "Groom Family",
    members: [
      {
        id: "placeholder-groom-parent-1",
        name: "Parent",
        relationship: "Mother",
        portrait: null,
        family: [],
      },
      {
        id: "placeholder-groom-parent-2",
        name: "Parent",
        relationship: "Father",
        portrait: null,
        family: [],
      },
      {
        id: "placeholder-groom-sibling-1",
        name: "Name",
        relationship: "Sister",
        portrait: null,
        /* Keep this nested sample: it is the gallery's only view of the wrapped cluster. */
        family: [
          {
            id: "placeholder-groom-sibling-spouse",
            name: "Mate",
            relationship: "Brother-in-law",
            portrait: null,
            family: [],
          },
          {
            id: "placeholder-groom-sibling-child",
            name: "Child",
            relationship: "Nephew",
            portrait: null,
            family: [],
          },
        ],
      },
      {
        id: "placeholder-groom-sibling-2",
        name: "Name",
        relationship: "Groom",
        portrait: null,
        family: [],
      },
    ],
  },
];
