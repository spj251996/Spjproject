import type { Ritual } from "./types.ts";
import { validateRituals } from "./validate.ts";

export const rituals: Ritual[] = validateRituals([
  {
    id: "madhuramveppu",
    title: "Madhuramveppu",
    description:
      "A sweet-offering ceremony where rice cooked in milk and jaggery is shared as a blessing, symbolising a life filled with sweetness and grace.",
    status: "upcoming",
    images: [],
  },
  {
    id: "nischayam",
    title: "Nischayam — The Betrothal",
    description:
      "A formal church blessing where the couple exchange rings before the priest, publicly declaring their intent to marry as a sacred covenant.",
    status: "upcoming",
    images: [],
  },
  {
    id: "rite-of-marriage",
    title: "The Rite of Marriage",
    description:
      "The couple declare their intent, exchange solemn vows, and the priest blesses the rings — a binding covenant before God and all who witness.",
    status: "upcoming",
    images: [],
  },
  {
    id: "minnu-manthrakodi",
    title: "Minnu & Manthrakodi",
    description:
      "The groom ties the Minnu — a sacred gold pendant — around the bride's neck, then drapes the silk Manthrakodi kasavu saree over her shoulders.",
    status: "upcoming",
    images: [],
  },
  {
    id: "nuptial-qurbana",
    title: "Nuptial Qurbana & Blessing",
    description:
      "The couple receive the Nuptial Blessing and participate in the Holy Eucharist together for the first time as husband and wife.",
    status: "upcoming",
    images: [],
  },
  {
    id: "signing-recessional",
    title: "Signing & Recessional",
    description:
      "The couple sign the register and walk out as husband and wife while the choir fills the church with song and joy.",
    status: "upcoming",
    images: [],
  },
]);
