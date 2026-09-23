import type { ContactPerson } from "./types.ts";
import { validateContacts } from "./validate.ts";

/* Each contact's name, relationship and number are carried from the legacy site and are NOT yet
   re-confirmed by the couple; the end-of-content confirmation pass owns those three. `id` and
   `side` are structural and are not theirs to confirm.

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
