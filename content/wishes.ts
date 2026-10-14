import type { WishesContent } from "./types.ts";
import { validateWishes } from "./validate.ts";

export const wishes: WishesContent = validateWishes({
  passage:
    "Love is patient, love is kind. It does not envy, it does not boast, it is not proud. It is not rude, it is not self-seeking, it is not easily angered, it keeps no account of wrongs.",
  passageAttribution: "1 Corinthians 13:4–5",
  handheldPassage:
    "Two are better than one, for if they fall, one will lift up the other.",
  handheldPassageAttribution: "Ecclesiastes 4:9–10",
  coupleNames: "Sebastian & Flemy",
  wishesLead: "With love and joy, from",
  wishesLine: "Marietta Joseph, Harry William & Amal Roy",
});
