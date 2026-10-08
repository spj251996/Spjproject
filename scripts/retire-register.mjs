/* THE RETIRE REGISTER — the single list of things scheduled for removal in Phase 9.
 *
 * `DESIGN.md`'s `[retire]` tag marks these for a reader; this module is the machine-readable copy and
 * the only one. The list is NOT duplicated in the doc: `.claude/` is gitignored, so a committed gate
 * cannot read it, and this project has lost six deferred entries to their own fixes already — a note
 * that nothing checks outlives the thing it describes.
 *
 * `kind` is what Phase 9 owes each entry:
 *   "unused"    — nothing references it; confirm zero consumers, then delete.
 *   "temporary" — still rendered somewhere on purpose; the deletion is a decision, not a confirmation.
 *
 * An entry is deleted from here in the SAME commit as its subject. `retire-register.test.mjs` fails
 * if one outlives the other. */
export const RETIRE_REGISTER = Object.freeze([
  {
    path: "public/rituals",
    kind: "temporary",
    why: "The first two rituals' photographs are stand-ins for the couple's Ship 1 review and come out before Ship 2. Removing them is three steps — empty both `images` arrays, delete this directory, and re-measure Celebrations' height back to the photo-free base.",
  },
  {
    path: "app/thread/[variant]/page.tsx",
    kind: "temporary",
    why: "The thread lab. Its deliverable is a decision — adopt the thread onto `/` or remove these routes — taken before Ship 2.",
  },
  {
    path: "app/_sections/contact.tsx",
    kind: "temporary",
    why: "Off the published page since Phase 7; still rendered on the lab routes because `contact` is in THREAD_IDS and the thread refuses to measure a page whose section count disagrees. It leaves the lab in Phase 7's Half 3, and the files go in Phase 9.",
  },
  {
    path: "app/contact-fit.ts",
    kind: "temporary",
    why: "Contact's measured fit. NOTE FOR WHOEVER REGENERATES IT: the source route must be a lab route, not `/` — `/` no longer carries the section, so `measure:fit --route=/` would find no selector to measure.",
  },
  {
    path: "content/contacts.ts",
    kind: "temporary",
    why: "Both contacts' names and numbers, still rendered on the lab routes. Goes with the section in Phase 9.",
  },
]);
