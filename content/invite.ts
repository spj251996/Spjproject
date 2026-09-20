import type { InviteContent } from "./types.ts";
import { validateInvite } from "./validate.ts";

export const invite: InviteContent = validateInvite({
  eyebrow: "We are getting married",
  coupleNames: "Flemy & Sebastian",
  passage:
    "with all humility and gentleness, with patience, bearing with one another in love.",
  passageAttribution: "Ephesians 4:2",
});
