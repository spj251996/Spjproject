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
 * if one outlives the other.
 *
 * THE GATE IS ONE-DIRECTIONAL AND A GREEN RUN DOES NOT MEAN THIS LIST IS COMPLETE. It can catch an
 * entry whose subject is gone; it cannot catch a subject that was never added — which is the half
 * that actually bites, since Phase 9 reads this list once and acts on it. Adding a file here is a
 * human step, and no check will notice if you skip it.
 *
 * AN ENTRY NAMES EITHER A `path` OR A `symbol` IN A FILE, never both:
 *   { path }          — a whole file or directory, checked with `existsSync`.
 *   { symbol, in }    — an exact source substring inside `in`, checked by reading that file.
 * The symbol shape exists because a thing can be scheduled for removal without its file being:
 * Half 2 loads a second Malayalam font weight purely so the owner can judge it, and `{ path }`
 * cannot express "these bytes, not this layout". `symbol` is matched LITERALLY, so it is the
 * source text to delete and not a description of it — which is what makes the gate fire when the
 * subject goes.
 */
export const RETIRE_REGISTER = Object.freeze([
  {
    path: "app/preview",
    kind: "temporary",
    why: "The couple's review route and everything that serves it — the route, the panel, the alternates' stylesheet and its gate. REGISTERED 2026-10-10 after a whole-branch review found it tagged `[retire]` in `DESIGN.md` while appearing in no machine-readable list, which falsified that doc's own statement that this file is where the members live. ITS WINDOW IS THE NARROWEST HERE AND IT IS NOT PHASE 9: it goes BEFORE THE BRANCH MERGES, once the couple have answered. THE REMOVAL IS NOT ONE ROW IN THE EXPORT GATE — deleting `preview.css` empties that gate's `variantSheets`, whose claim reads `variantSheets.length > 0 && ...`, so the gate fails on the removal commit unless the `EXPECTED` row is REPLACED by a `FORBIDDEN` entry and both `data-pv-` blocks go with it.",
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
  {
    path: "components/ui/contact-actions.test.ts",
    kind: "temporary",
    why: "Contact's own gate — the Call/WhatsApp actions and the long-press callout exemption. It outlives the section only as long as the section does, so it goes in the same Phase 9 sweep.",
  },
]);
