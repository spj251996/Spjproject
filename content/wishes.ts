import type { WishesContent } from "./types.ts";
import { validateWishes } from "./validate.ts";

export const wishes: WishesContent = validateWishes({
  passage:
    "Charity suffereth long, and is kind; charity envieth not; charity vaunteth not itself, is not puffed up, doth not behave itself unseemly, seeketh not her own, is not easily provoked, thinketh no evil.",
  passageAttribution: "1 Corinthians 13:4–5",
  coupleNames: "Flemy Roy & Sebastian P Joseph",
  wishesLine: "Best compliments from Marietta Joseph, Harry William & Amal Roy",
});
