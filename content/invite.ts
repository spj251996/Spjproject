import type { InviteContent } from "./types.ts";
import { validateInvite } from "./validate.ts";

export const invite: InviteContent = validateInvite({
  eyebrow: "We are getting married",
  coupleNames: "Flemy & Sebastian",
});
