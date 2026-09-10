import type { FamilyGroup } from "./types.ts";
import { validateFamilyGroups } from "./validate.ts";

export const familyGroups: FamilyGroup[] = validateFamilyGroups([
  {
    id: "bride-family",
    side: "bride",
    familyName: "Edatt Family",
    members: [
      {
        id: "minimol-roy",
        name: "Minimol Roy",
        relationship: "Mother",
        portrait: "/family/minimol-roy.jpg",
        family: [],
      },
      {
        id: "roy-john-edatt",
        name: "Roy John Edatt",
        relationship: "Father",
        portrait: "/family/roy-john-edatt.jpg",
        family: [],
      },
      {
        id: "flemy-roy",
        name: "Flemy",
        relationship: "Bride",
        portrait: "/family/flemy-roy.jpg",
        family: [],
      },
      {
        id: "amal-roy",
        name: "Amal",
        relationship: "Brother",
        portrait: "/family/amal-roy.jpg",
        family: [],
      },
    ],
  },
  {
    id: "groom-family",
    side: "groom",
    familyName: "Plackeel Family",
    members: [
      {
        id: "rani-joseph",
        name: "Rani Joseph",
        relationship: "Mother",
        portrait: "/family/rani-joseph.jpg",
        family: [],
      },
      {
        id: "p-d-joseph",
        name: "P D Joseph",
        relationship: "Father",
        portrait: "/family/p-d-joseph.jpg",
        family: [],
      },
      {
        id: "marietta-joseph",
        name: "Marietta",
        relationship: "Sister",
        portrait: "/family/marietta-joseph.jpg",
        family: [
          {
            id: "harry-william",
            name: "Harry",
            relationship: "Brother-in-law",
            portrait: "/family/harry-william.jpg",
            family: [],
          },
          {
            id: "oliver-harry",
            name: "Oliver",
            relationship: "Nephew",
            portrait: "/family/oliver-harry.jpg",
            family: [],
          },
        ],
      },
      {
        id: "sebastian",
        name: "Sebastian",
        relationship: "Groom",
        portrait: "/family/sebastian.jpg",
        family: [],
      },
    ],
  },
]);
