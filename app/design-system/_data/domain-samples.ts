/* Sample data for the `[standalone]` domain specimens (DESIGN.md → Domain Components).

   Same convention as `./ui-samples`: self-documenting strings at real copy length, zeroed numerals
   so demo data is never mistaken for the invitation's own content. These samples ARE object-shaped —
   `family` and `timeline` consume `FamilyGroup[]` and `Ritual[]` from the content schema, unlike the
   portable components, which take flat scalars. */

import type { FamilyGroup, Ritual } from "@/content/types";

/** `invite` takes flat scalars, not a domain type. `quote` is present here; passing `null` is the
    documented way to render no quote line at all. */
export const sampleInvite = {
  quote:
    "A placeholder scripture or blessing line, set at the length the real quote will occupy.",
  coupleNames: "Placeholder & Placeholder",
  date: "Saturday, 00 Month 0000",
  city: "Placeholder City",
  engagementSummary:
    "A placeholder summary of the engagement — the date, the city, and a single sentence of context, at the length the real copy will run to.",
};

/** Both sides, three members each — the arrangement the family section is composed around. Every
    `portrait` is null so each renders its designed missing-image state; portrait assets are carried
    to the sample-asset ask rather than invented. */
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
        family: [],
      },
    ],
  },
];

/** Four rituals alternating sides, mixing both statuses so the specimen shows the completed and
    upcoming node states together. `images` is empty throughout: Ship 1 launches all-`upcoming` with
    no galleries, and no ritual photography exists to sample. */
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

/** All-`upcoming`, at a different count from `sampleRituals` — the state Ship 1 actually launches
    with, since no ritual has occurred yet at launch. Demonstrates that the composition takes however
    many rituals exist rather than assuming a fixed count or a mix of statuses. */
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
