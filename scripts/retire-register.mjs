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
 *
 * Every entry today is `temporary`, and the `unused` arm has never fired on a real one. An earlier
 * version of this header predicted Half 2 would add the first `unused` entries — it does not:
 * `type-display-name`, `type-heading-script` and `splitCoupleNames` keep consumers as the /preview
 * route's alternates, so they enter as `temporary` and become `unused` only in Half 3. */
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
  {
    symbol: 'weight: ["400", "600"]',
    in: "app/layout.tsx",
    kind: "temporary",
    why: 'The Malayalam\'s second weight, loaded only so the owner can judge 600 against 400 — a synthetic bold cannot be judged fairly. ITS COST IS +64KB, NOT THE +22KB A SECOND STATIC CUT WOULD BE: two weights make the loader fetch the variable face, so the three subset files go 41,172 to 105,256 bytes, and +36KB of that sits on every route\'s critical path because the preloaded Malayalam-range file serves both weights. Measured by building both ways, 2026-10-09. Half 3 drops the losing weight and this entry with it. Removing it is one edit here — `weight: "400"` or `"600"` — with no other site to sweep, because nothing in the sections names a weight.',
  },
  {
    path: "components/ui/contact-actions.test.ts",
    kind: "temporary",
    why: "Contact's own gate — the Call/WhatsApp actions and the long-press callout exemption. It outlives the section only as long as the section does, so it goes in the same Phase 9 sweep.",
  },
]);
