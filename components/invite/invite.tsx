/* DESIGN.md → Domain Components → Invite [standalone].

   Server-rendered, no client boundary. The one gesture this section is credited with — the thread
   drawing in, settling low and leaving `scroll-cue` behind — belongs entirely to `thread-overlay`,
   which is a page-wide fixed overlay driven by root scroll progress. A section's motion is not
   automatically the component's, and here none of it is: this file attaches no motion and therefore
   has no reduced-motion gate to discharge.

   The overlay is NOT mounted here. It is a `shell/` singleton, which the repo's component-structure
   rule mounts in the root layout, and page composition is outside this run's scope — so the mount
   point stays reported and unwritten. The run's scratch route mounted it to verify the composition.

   No scroll-linked content reveal either, though Interaction Rules → Section entry makes that the
   global default. The invite occupies the first viewport, where scroll progress is zero, so a
   scroll-bound reveal would hold the opening content hidden — which the same rule forbids
   ("content is present and readable before its reveal completes"). Motion → Motion budget names the
   thread draw-in as the one major gesture at entry, and this section spends it there.

   The date is plain text, not `<time>`: the content schema carries a display string and no machine
   value, and fabricating an ISO date to satisfy the attribute would invent data the source does not
   have. Date and city render as two lines, both at `{typography.date-primary}` — the doc puts both
   at primary weight, and a joining separator glyph would be invented copy. */

interface InviteProps {
  /** Optional short quote above the names. Absent renders nothing — no placeholder line. */
  quote: string | null;
  coupleNames: string;
  date: string;
  city: string;
  engagementSummary: string;
  className?: string;
}

export function Invite({
  quote,
  coupleNames,
  date,
  city,
  engagementSummary,
  className,
}: InviteProps) {
  return (
    <section
      className={`relative z-(--z-content) flex min-h-dvh flex-col items-center justify-center px-space-md py-space-3xl text-center ${className ?? ""}`}
    >
      <div className="flex w-full max-w-content flex-col items-center gap-space-lg">
        {quote === null ? null : (
          <p className="type-body max-w-text text-ink">{quote}</p>
        )}

        <h1 className="type-display-name text-ink">{coupleNames}</h1>

        <div className="flex flex-col items-center gap-space-3xs">
          <p className="type-date-primary text-ink">{date}</p>
          <p className="type-date-primary text-ink">{city}</p>
        </div>

        <p className="type-body max-w-text text-ink">{engagementSummary}</p>
      </div>
    </section>
  );
}
