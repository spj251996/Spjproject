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
 * THE FIRST `unused` ENTRIES ARRIVED ON 2026-10-10, which corrects an earlier version of this
 * header that predicted Half 2 would add none. The names lever was DROPPED from the couple's
 * review rather than decided by it — the drawn asset ships and there is nothing to arbitrate — so
 * the typeset alternate it existed to show has no consumer from that moment.
 *
 * THE OLD TYPESET NAMES HAVE A STATED REMOVAL WINDOW (owner, 2026-10-10), and it is narrower than
 * this register's default: EARLIEST once the couple confirm the preview, LATEST Phase 9. They are
 * kept until then on purpose — the couple see the drawn asset and nothing else, and until they
 * have said so the typeset form is the only way back without re-deriving it. It covers four
 * things that must go together: `splitCoupleNames`, `app/couple-names.css`, and the
 * `[data-names-alt]` span in each of `app/_sections/invite.tsx` and `app/_sections/wishes.tsx`.
 * Removing the stylesheet without the spans PAINTS BOTH FORMS AT ONCE rather than failing
 * quietly, which is why the two spans are named here rather than registered separately.
 *
 * The two type ROLES stay `temporary` and outlive all of it: the classes are still on their
 * elements carrying the `em` the drawn lockup's width resolves against. */
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
    symbol: ".type-display-name {",
    in: "app/styles/type-scale.css",
    kind: "temporary",
    why: "The invite's script heading role, superseded by the drawn names asset. TEMPORARY rather than unused because the class is still ON the `<h1>`, carrying the `em` the lockup's width resolves against — the asset needs it even though nothing paints the role's own type any more. Its alternate markup is dead as of 2026-10-10 and goes with the two entries below. WARNING FOR WHOEVER SWEEPS IT: the TOKEN `--text-display-name` must NOT go with the class. `couple-names.tsx` resolves the lockup's 2.513em against it, which is what keeps the asset on the names scale the owner settled in Half 1.",
  },
  {
    symbol: ".type-heading-script {",
    in: "app/styles/type-scale.css",
    kind: "temporary",
    why: "Wishes' signature role, superseded by the same asset on one line, and kept on the `<p>` for the same reason. `--text-heading-script` must survive it: the single line's 4.656em resolves against that token.",
  },
  {
    symbol: ".type-display-name__joiner",
    in: "app/styles/type-scale.css",
    kind: "temporary",
    why: "The half-size ampersand rule, shared by both script roles in one declaration (— and `.type-heading-script__joiner` with it). It styles the alternates' middle span and nothing else; it goes with them.",
  },
  {
    symbol: "splitCoupleNames",
    in: "app/_sections/shared.tsx",
    kind: "unused",
    why: "Splits the couple's names into the three spans the script roles need. UNUSED as of 2026-10-10: the names lever was dropped from the couple's review rather than decided by it, so the two alternates it fed have no consumer and this has no reachable caller. REMOVAL WINDOW (owner): earliest once the couple confirm the preview, latest Phase 9 — and it goes in one commit with the other three parts of the typeset alternate, listed in this file's header. The drawn asset takes the whole string as its accessible name and never splits it.",
  },
  {
    path: "app/couple-names.css",
    kind: "unused",
    why: "The one rule hiding the typeset alternate on the published page. UNUSED as of 2026-10-10, when the names lever was dropped rather than decided: nothing un-hides the alternate any more, so this file's only job is to keep dead markup invisible. REMOVE IT WITH THAT MARKUP, NOT BEFORE — the `[data-names-alt]` span in `app/_sections/invite.tsx` and the one in `app/_sections/wishes.tsx`, neither registered separately, because deleting this file alone would PAINT both forms of the names at once rather than fail quietly.",
  },
  {
    path: "components/ui/contact-actions.test.ts",
    kind: "temporary",
    why: "Contact's own gate — the Call/WhatsApp actions and the long-press callout exemption. It outlives the section only as long as the section does, so it goes in the same Phase 9 sweep.",
  },
]);
