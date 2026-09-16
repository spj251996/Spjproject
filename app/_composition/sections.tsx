import { inviteFit } from "@/app/_composition/invite-fit";
import { MountedSheet } from "@/components/layout/mounted-sheet";
import { events, formatEventDate, invite } from "@/content";

/* The page and the dev-only preview route both render these. Sharing the WIRING is the point: a
   stale prop on the preview would poison the design judgement the preview exists to support, and
   nothing detects that — it typechecks, lints and renders. The section LIST is deliberately not
   shared. It is five lines in the phase's fixed order, visible at a glance in both files, and a
   missing entry shows the moment you scroll.

   Content is looked up by id rather than by array position so inserting an event cannot silently
   repoint the invite at the wrong one. */

function eventById(id: string) {
  const found = events.find((event) => event.id === id);
  if (found === undefined) {
    throw new Error(`sections: no event with id "${id}" in content/events.ts`);
  }
  return found;
}

/* The couple-names role sets three lines in portrait windows and stays one line in landscape
   (DESIGN.md → Foundations → Typography), which needs the two names as separate spans rather than
   one string — the split lives here, not in content, because it is presentation of
   `invite.coupleNames`, not a second copy of it. Falls back to the whole string in one span if it
   ever does not split into exactly two parts, so a future edit to the content can't render blank. */
function splitCoupleNames(coupleNames: string): [string, string] | null {
  const parts = coupleNames.split(" & ");
  return parts.length === 2 ? [parts[0], parts[1]] : null;
}

/* DESIGN.md → Domain Components → Invite [inline]. Moved inline from the retired
   components/invite/invite.tsx once the frame moved into `mounted-sheet` itself (interlude,
   2026-09-15): the section is now a short stack of text with no state or behaviour of its own, and
   the only extraction trigger it still met was the gallery rendering it — the gallery now lists it
   instead (app/design-system/_sections/domain.tsx).

   Server-rendered, no client boundary. The thread draw-in and the scroll-cue this section is
   credited with belong entirely to `thread-overlay`, which is not mounted during Phase 4 — so the
   invite carries no scroll cue until Phase 5. That is a dated gap against PROJECT.md → Sections →
   Invite, recorded in work/session.md, not an oversight here.

   Takes the two event records rather than flat date and city strings: PROJECT.md → Content Model →
   InviteContent requires both to be read from the WeddingEvent records so a corrected date cannot
   drift between this section and Event Info.

   The date renders through `formatEventDate` because the ordinal sets smaller than the day number,
   which a flat string cannot express (content/format.ts).

   The markup below is measured against by `inviteFit`; every content or type change re-runs
   `npm run measure:fit`. The frame's own contract (mounted-sheet.tsx) forbids horizontal padding,
   margin or width cap around the frame scope, which is why this section carries none: `mounted-sheet`
   decides the ground against the window's own width.

   Three things in this markup lean on rules that live outside this file, all in DESIGN.md →
   Domain Components → Invite:
   - The couple names split into three spans (`splitCoupleNames` above) so the couple-names TYPE
     ROLE can set them on three lines in portrait and one line in landscape — the stacking, the
     ampersand's 0.5em size and the 0.9 line spacing are `.type-display-name`'s own rules in
     app/styles/type-scale.css, not this section's, because the doc states the split as "a property
     of the role wherever it is used."
   - Both month spellings render for every date; `md:hidden` / `hidden md:inline` pick one by the
     same `{breakpoints.md}` the type ladder already switches on, so first paint is already correct
     and the hidden spelling is never announced to assistive technology (`display: none` removes it
     from the accessibility tree, so no separate `aria-hidden` is needed).
   - The stack's gaps are explicit margins, not one `gap-*` on the parent, because only the
     names-to-date gap changes with width (32px below `{breakpoints.lg}`, 16px from it up) while the
     other two stay 32px at every tier. */
export function InviteSection() {
  const wedding = eventById("wedding");
  const betrothal = eventById("engagement");
  const weddingDate = formatEventDate(wedding.date);
  const betrothalDate = formatEventDate(betrothal.date);
  const names = splitCoupleNames(invite.coupleNames);

  return (
    <section className="relative z-(--z-content)">
      <MountedSheet fit={inviteFit} hero>
        <div className="flex flex-col items-center text-center">
          {/* `.type-eyebrow` owns its colour. Never pair it with a colour utility. */}
          <p className="type-eyebrow">{invite.eyebrow}</p>

          <h1 className="type-display-name text-ink mt-space-lg">
            {names ? (
              <>
                <span>{names[0]}</span>
                <span className="type-display-name__joiner">{" & "}</span>
                <span>{names[1]}</span>
              </>
            ) : (
              invite.coupleNames
            )}
          </h1>

          <div className="flex flex-col items-center gap-space-3xs mt-space-lg lg:mt-space-sm">
            <p className="type-date-primary text-ink">
              {weddingDate.weekday}, {weddingDate.day}
              <span className="type-caption align-super">
                {weddingDate.ordinal}
              </span>{" "}
              <span className="md:hidden">{weddingDate.monthShort}</span>
              <span className="hidden md:inline">{weddingDate.month}</span>{" "}
              {weddingDate.year}
            </p>
            <p className="type-date-primary text-ink">{wedding.cityTown}</p>
          </div>

          <div className="flex flex-col items-center gap-space-3xs mt-space-lg">
            <p className="type-eyebrow">{betrothal.name}</p>
            <p className="type-caption text-ink">
              {betrothalDate.weekday}, {betrothalDate.day}
              {betrothalDate.ordinal}{" "}
              <span className="md:hidden">{betrothalDate.monthShort}</span>
              <span className="hidden md:inline">{betrothalDate.month}</span>{" "}
              {betrothalDate.year}
            </p>
            <p className="type-caption text-ink">{betrothal.cityTown}</p>
          </div>
        </div>
      </MountedSheet>
    </section>
  );
}
