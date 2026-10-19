/* THE RETIRE REGISTER — the single list of things scheduled for removal.
 *
 * `DESIGN.md`'s `[retire]` tag marks these for a reader; this module is the machine-readable copy and
 * the only one. The list is NOT duplicated in the doc: `.claude/` is gitignored, so a committed gate
 * cannot read it, and a note that nothing checks outlives the thing it describes.
 *
 * `kind` is what each entry is owed:
 *   "unused"    — nothing references it; confirm zero consumers, then delete.
 *   "temporary" — still rendered somewhere on purpose; the deletion is a decision, not a confirmation.
 *
 * An entry is deleted from here in the SAME commit as its subject. `retire-register.test.mjs` fails
 * if one outlives the other.
 *
 * THE GATE IS ONE-DIRECTIONAL AND A GREEN RUN DOES NOT MEAN THIS LIST IS COMPLETE. It can catch an
 * entry whose subject is gone; it cannot catch a subject that was never added — which is the half
 * that actually bites, since the removal reads this list once and acts on it. Adding a file here is a
 * human step, and no check will notice if you skip it.
 *
 * AN ENTRY NAMES EITHER A `path` OR A `symbol` IN A FILE, never both:
 *   { path }          — a whole file or directory, checked with `existsSync`.
 *   { symbol, in }    — an exact source substring inside `in`, checked by reading that file.
 * The symbol shape exists because a thing can be scheduled for removal without its file being:
 * `{ path }` cannot express "these bytes, not this layout". `symbol` is matched LITERALLY, so it is
 * the source text to delete and not a description of it, which is what makes the gate fire when the
 * subject goes.
 */
export const RETIRE_REGISTER = Object.freeze([
  {
    path: "app/thread/page.tsx",
    kind: "temporary",
    why: "The thread lab; it becomes dev-only at Phase 10 → R1.",
  },
]);
