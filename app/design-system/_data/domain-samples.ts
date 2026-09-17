import type { FamilyGroup, Ritual } from "@/content/types";

export const sampleFamilyGroups: FamilyGroup[] = [
  {
    id: "placeholder-bride-family",
    side: "bride",
    familyName: "Placeholder Bride Family",
    members: [
      {
        id: "placeholder-bride-parent-1",
        name: "Placeholder Parent Name",
        relationship: "Placeholder Relation",
        portrait: null,
        family: [],
      },
      {
        id: "placeholder-bride-parent-2",
        name: "Placeholder Parent Name",
        relationship: "Placeholder Relation",
        portrait: null,
        family: [],
      },
      {
        id: "placeholder-bride-sibling",
        name: "Placeholder Sibling Name",
        relationship: "Placeholder Relation",
        portrait: null,
        family: [],
      },
    ],
  },
  {
    id: "placeholder-groom-family",
    side: "groom",
    familyName: "Placeholder Groom Family",
    members: [
      {
        id: "placeholder-groom-parent-1",
        name: "Placeholder Parent Name",
        relationship: "Placeholder Relation",
        portrait: null,
        family: [],
      },
      {
        id: "placeholder-groom-parent-2",
        name: "Placeholder Parent Name",
        relationship: "Placeholder Relation",
        portrait: null,
        family: [],
      },
      {
        id: "placeholder-groom-sibling",
        name: "Placeholder Sibling Name",
        relationship: "Placeholder Relation",
        portrait: null,
        /* Keep this nested sample: it is the gallery's only view of the wrapped cluster. */
        family: [
          {
            id: "placeholder-groom-sibling-spouse",
            name: "Placeholder Spouse Name",
            relationship: "Placeholder Relation",
            portrait: null,
            family: [],
          },
          {
            id: "placeholder-groom-sibling-child",
            name: "Placeholder Child Name",
            relationship: "Placeholder Relation",
            portrait: null,
            family: [],
          },
        ],
      },
    ],
  },
];

export const sampleRituals: Ritual[] = [
  {
    id: "placeholder-ritual-1",
    title: "Placeholder Completed Ritual",
    description:
      "The first ritual in the sequence, described at the length the real entries will run to — a sentence or two of what happens and who takes part.",
    status: "completed",
    images: [],
  },
  {
    id: "placeholder-ritual-2",
    title: "Placeholder Second Ritual",
    description:
      "The second ritual, alternating to the opposite side of the spine on wide viewports and stacking beneath the first on narrow ones.",
    status: "completed",
    images: [],
  },
  {
    id: "placeholder-ritual-3",
    title: "Placeholder Upcoming Ritual",
    description:
      "An upcoming ritual, still ahead of the couple — its node shows title and description only, and offers no gallery to open.",
    status: "upcoming",
    images: [],
  },
  {
    id: "placeholder-ritual-4",
    title: "Placeholder Final Ritual",
    description:
      "The last node in the timeline, where the thread comes to rest at the closing section of the page.",
    status: "upcoming",
    images: [],
  },
];

export const sampleRitualsAllUpcoming: Ritual[] = [
  {
    id: "placeholder-upcoming-ritual-1",
    title: "Placeholder First Ritual",
    description:
      "The first ritual ahead of the couple, described at the length the real entries will run to.",
    status: "upcoming",
    images: [],
  },
  {
    id: "placeholder-upcoming-ritual-2",
    title: "Placeholder Second Ritual",
    description:
      "A second upcoming ritual, alternating to the opposite side of the spine on wide viewports.",
    status: "upcoming",
    images: [],
  },
  {
    id: "placeholder-upcoming-ritual-3",
    title: "Placeholder Third Ritual",
    description:
      "A third upcoming ritual, showing the spine extend to a different node count than the mixed-status sample above.",
    status: "upcoming",
    images: [],
  },
];
