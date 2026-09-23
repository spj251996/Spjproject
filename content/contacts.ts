import type { ContactPerson } from "./types.ts";
import { validateContacts } from "./validate.ts";

/* Carried from the legacy site and NOT yet re-confirmed by the couple — the end-of-content
   confirmation pass owns these five fields.

   The groom-side relationship is not the legacy site's: it read "Brother of Sebastian", and the
   couple have since placed him as a cousin, which is why he does not appear in the family roster.

   Display names follow PROJECT.md → Naming and Ordering — full names for parents and for the two
   contacts, everyone else a first name. */
export const contacts: ContactPerson[] = validateContacts([
  {
    id: "bride-contact",
    side: "bride",
    name: "Amal Roy",
    relationship: "Brother",
    phone: "+919354187793",
  },
  {
    id: "groom-contact",
    side: "groom",
    name: "Christopher George",
    relationship: "Cousin",
    phone: "+919048054495",
  },
]);
