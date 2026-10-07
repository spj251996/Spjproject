import type { Ritual } from "./types.ts";
import { validateRituals } from "./validate.ts";

/* The five celebrations, in order, from the couple's own `Kerala Christian Wedding Traditions`
   document; every description is the owner's approved rewrite of its prose, ritual by ritual.

   Two cautions that cost a correction each and must not be undone:
   - **The pendant keeps the couple's own naming** — Minnukettu is the ritual, the sacred Thali the
     pendant. Their source never uses "Minnu" alone, so neither does this.
   - **The groom does not tie the Minnu.** The passive in the last description is deliberate; a
     draft that named the groom as the agent was simply wrong. If the copy should ever name who
     ties it, that comes from the couple — do not infer it.

   THE PHOTOGRAPHS ON THE FIRST TWO RITUALS ARE TEMPORARY AND ARE DROPPED BEFORE MAIN (owner,
   2026-10-07). They ship on this branch only, so the preview row reaches the couple's review
   exercised rather than unseen — at launch no ritual has photographs, which is the condition under
   which this project's history says a component passes every gate and is wrong. Removing them is
   two steps, not one: empty both `images` arrays AND delete `public/rituals/`, then re-measure
   Celebrations' height back down (the thread's constants carry the WITH-photographs figures while
   these are here). `tasks.md` holds the gate.

   STRIP ORDER IS THIS ARRAY'S ORDER. `photo-row` renders `photos.slice(0, shown)` in place and
   nothing sorts, so the first path is the leftmost frame and the remainder is counted in the `+N`
   cue on the last visible one. To choose which frame leads, reorder here.

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
      "On the eve of the wedding, family and loved ones gather to bless the couple with sweets, prayers and good wishes. A cherished Kerala Christian tradition, Madhuramveppu marks the passage from one chapter to the next — honouring the life each has shared with their family before stepping into a new one.",
    images: [
      "/rituals/og-1.jpg",
      "/rituals/shoot-1.jpg",
      "/rituals/shoot-2.jpg",
      "/rituals/shoot-3.jpg",
    ],
  },
  {
    id: "betrothal",
    title: "Betrothal",
    malayalam: "മനസ്സമ്മതം",
    tagline: "Where a promise is made.",
    description:
      "In the presence of their families, witnesses and the Church, the couple formally give their consent to marry. The betrothal marks the beginning of their journey towards the sacrament of marriage — a promise made with faith, intention and the blessing of all who stand with them.",
    images: ["/rituals/og-2.jpg", "/rituals/shoot-4.jpg"],
  },
  {
    id: "wedding",
    title: "Wedding",
    malayalam: "വിവാഹം",
    tagline: "Where two lives become one.",
    description:
      "Before God and their loved ones, the bride and groom enter into the sacrament of marriage. Through prayer, Scripture and their solemn consent, they promise to walk together in love and faith, sharing in the joys and challenges of the life ahead.",
    images: [],
  },
  {
    id: "exchange-of-rings",
    title: "Exchange of Rings",
    malayalam: "മോതിരമാറ്റം",
    tagline: "A promise held in a circle.",
    description:
      "Each ring is an unbroken circle — enduring love, faithfulness and companionship, given to one another. With God and those they hold dear as witnesses, the rings they exchange become a promise to go on together, through all that life brings.",
    images: [],
  },
  {
    id: "tying-the-knot",
    title: "Tying the knot",
    malayalam: "മിന്നുകെട്ട്",
    tagline: "A promise tied close to the heart.",
    description:
      "Minnukettu is the tying of the sacred Thali — a small leaf-shaped gold pendant bearing the cross. As it is tied around the bride's neck, it becomes a lasting symbol of the covenant and the bond they now share. The Manthrakodi — a silk kasavu saree, gifted and blessed by the groom's family — is then draped over her shoulders, welcoming her into a new chapter surrounded by family and grace.",
    images: [],
  },
]);
