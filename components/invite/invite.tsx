import { MountedSheet } from "@/components/layout/mounted-sheet";
import { formatEventDate } from "@/content";
import type { WeddingEvent } from "@/content/types";

/* DESIGN.md → Domain Components → Invite [standalone].

   Server-rendered, no client boundary. The thread draw-in and the scroll-cue this section is
   credited with belong entirely to `thread-overlay`, which is not mounted during Phase 4 — so the
   invite carries no scroll cue until Phase 5. That is a dated gap against PROJECT.md → Sections →
   Invite, recorded in work/session.md, not an oversight here.

   Takes the two event records rather than flat date and city strings: PROJECT.md → Content Model →
   InviteContent requires both to be read from the WeddingEvent records so a corrected date cannot
   drift between this section and Event Info. Domain components may take domain types; the flatten
   rule applies to `ui/`, which this is not.

   The date renders through `formatEventDate` because the ordinal sets smaller than the day number,
   which a flat string cannot express (content/format.ts).

   PROVISIONAL, awaiting the owner's tweak pass. DESIGN.md says the betrothal block "recedes by size,
   weight, or tone" and picks none of the three. This renders the size route using the existing
   caption role, which is the only token the system already carries for secondary text. It is a
   baseline to judge, not a decision — see the plan's Task 3. */

interface InviteProps {
  eyebrow: string;
  coupleNames: string;
  wedding: WeddingEvent;
  betrothal: WeddingEvent;
  className?: string;
}

export function Invite({
  eyebrow,
  coupleNames,
  wedding,
  betrothal,
  className,
}: InviteProps) {
  const weddingDate = formatEventDate(wedding.date);
  const betrothalDate = formatEventDate(betrothal.date);

  return (
    <section
      className={`relative z-(--z-content) flex min-h-dvh flex-col justify-center px-space-md py-space-3xl ${className ?? ""}`}
    >
      {/* Foundations → Layout: content width caps at 1200px. The cap wraps the mount, not the
          sheet — the mount is part of the composition, so capping inside it would let the mount
          run wider than the content it frames. */}
      <div className="mx-auto w-full max-w-content">
        <MountedSheet hero>
          <div className="flex flex-col items-center gap-space-lg text-center">
            {/* `.type-eyebrow` owns its colour. Never pair it with a colour utility. */}
            <p className="type-eyebrow">{eyebrow}</p>

            <h1 className="type-display-name text-ink">{coupleNames}</h1>

            <div className="flex flex-col items-center gap-space-3xs">
              <p className="type-date-primary text-ink">
                {weddingDate.weekday}, {weddingDate.day}
                <span className="type-caption align-super">
                  {weddingDate.ordinal}
                </span>{" "}
                {weddingDate.month} {weddingDate.year}
              </p>
              <p className="type-date-primary text-ink">{wedding.cityTown}</p>
            </div>

            <div className="flex flex-col items-center gap-space-3xs">
              <p className="type-eyebrow">{betrothal.name}</p>
              <p className="type-caption text-ink">
                {betrothalDate.weekday}, {betrothalDate.day}
                {betrothalDate.ordinal} {betrothalDate.month}{" "}
                {betrothalDate.year}
              </p>
              <p className="type-caption text-ink">{betrothal.cityTown}</p>
            </div>
          </div>
        </MountedSheet>
      </div>
    </section>
  );
}
