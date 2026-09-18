import type { FamilyGroup, Ritual } from "@/content/types";

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

/* Two rows only: enough to show the spine's own rule (Timeline → "The spine and its marks") —
   a segment reaches from one mark to the next, so the last row carries none. `status` and `images`
   are present for schema validity only; The Celebrations placeholder (app/page.tsx)
   reads just `title` and `description`, so both rows share one value and it goes unrendered here. */
export const sampleRituals: Ritual[] = [
  {
    id: "placeholder-ritual-1",
    title: "Placeholder Ritual",
    description:
      "A ritual in the sequence, described at the length the real entries will run to — a sentence or two of what happens and who takes part.",
    status: "upcoming",
    images: [],
  },
  {
    id: "placeholder-ritual-2",
    title: "Placeholder Final Ritual",
    description:
      "The last ritual in the list, where the spine ends exactly on this row's own mark.",
    status: "upcoming",
    images: [],
  },
];
