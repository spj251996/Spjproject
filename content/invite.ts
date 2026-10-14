import type { InviteContent } from "./types.ts";
import { validateInvite } from "./validate.ts";

export const invite: InviteContent = validateInvite({
  coupleNames: "Sebastian & Flemy",
  passage:
    "with all humility and gentleness, with patience, bearing with one another in love.",
  passageAttribution: "Ephesians 4:2",
  handheldPassage: "I have found the one whom my soul loves",
  handheldPassageAttribution: "Song of Solomon 3:4",
});
