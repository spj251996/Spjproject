import type { Ritual } from "./types.ts";
import { validateRituals } from "./validate.ts";

/* The four celebrations, in order, from the couple's own `Kerala Christian Wedding Traditions`
   document; every description is the couple's own copy, corrected for grammar only.

   Two cautions that cost a correction each and must not be undone:
   - **The pendant keeps the couple's own naming** — Minnukettu is the ritual, the sacred Thali the
     pendant. Their source never uses "Minnu" alone, so neither does this.
   - **The groom does not tie the Minnu.** The passive in the last description is deliberate; a
     draft that named the groom as the agent was simply wrong. If the copy should ever name who
     ties it, that comes from the couple — do not infer it.

   THE PHOTOGRAPHS ARE NOT LISTED HERE. Since Phase 8 a ritual gains its photographs by dropping
   files into `assets/rituals/<this ritual's id>/`; the build derives the deliveries and the
   dimensions into `content/ritual-photos.generated.ts`, and that module is the only list. An
   `images` array here would be a second hand-maintained copy of it. Strip order is by date and time
   taken, with the file name as the tiebreak and for undated files, so renaming a file does not move
   it.

   EVERY RITUAL GAINS ITS REAL PHOTOGRAPHS IN STAGES AFTER THE EVENTS (owner, 2026-10-14); the test
   photographs came out the same day. Each folder keeps its `.gitkeep`, since every ritual's folder
   must exist for the owner to upload into it from a phone. `public/rituals/` is generated and
   gitignored.

   The Malayalam is in logical codepoint order. Two of these arrived from the PDF in VISUAL order
   (the `െ` sign before its consonant) and are reordered here; `validateRituals` now refuses that
   form outright. */
export const rituals: Ritual[] = validateRituals([
  {
    id: "wedding-eve",
    title: "Wedding Eve",
    malayalam: "മധുരംവെപ്പ്",
    tagline: "Where the celebrations begin with sweetness.",
    description:
      "Madhuramveppu is a pre-wedding tradition, usually held separately at the bride's and groom's homes. On the eve of the betrothal or the wedding, family and loved ones gather to bless the bride and groom with sweets, prayers and good wishes.",
  },
  {
    id: "betrothal",
    title: "Betrothal",
    malayalam: "മനസ്സമ്മതം",
    tagline: "Where a promise is made.",
    description:
      "A sacred commitment made in the presence of family, witnesses and the Church, the betrothal formally declares the couple's intention to marry, marking the beginning of their journey towards the Sacrament of Marriage with faith and blessings.",
  },
  {
    id: "wedding",
    title: "Wedding",
    malayalam: "വിവാഹം",
    tagline: "Where two lives become one.",
    description:
      "Rooted in the beautiful traditions of the Syro-Malabar Catholic Church, the Sacrament of Marriage celebrates the sacred union of the bride and groom in a lifelong covenant of love. Surrounded by loved ones and blessed by the Church, they freely commit to a life together, receiving the priest's blessing and beginning their journey as husband and wife, grounded in faith, strengthened by God's grace and united in love.",
  },
  {
    id: "tying-the-knot",
    title: "Tying the Knot",
    malayalam: "മിന്നുകെട്ട്",
    tagline: "A promise tied close to the heart.",
    description:
      "The Minnukettu and Manthrakodi are cherished Kerala Christian wedding traditions celebrating love and new beginnings. The Minnukettu is the tying of the sacred, leaf-shaped gold Thali bearing the cross, symbolising the couple's lifelong bond. The Manthrakodi, gifted by the groom's family, welcomes the bride into a new chapter filled with love, blessings and togetherness.",
  },
]);
