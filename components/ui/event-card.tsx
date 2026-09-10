import { Divider } from "../layout/divider";
import { ButtonAction } from "./button-action";
import { EyebrowLabel } from "./eyebrow-label";

/* DESIGN.md → Components → UI → `event-card`.

   Server-rendered. The fade-and-translate reveal belongs to the composing Event Info section, not to
   this component — motion described under a domain entry never forces a component's boundary.

   The two shadows are one design value, so they compose into a single `shadow-*` utility; two would
   overwrite each other and silently drop a layer.

   Heading level is `h3` because the card's own composition implies it sits under a section heading;
   the composing section owns the outer levels. Optional fields render nothing when absent — no
   placeholder label stands in for a missing venue, time, address, or action target. */

interface EventCardProps {
  name: string;
  city: string;
  date: string;
  venue: string | null;
  time: string | null;
  address: string | null;
  mapUrl: string | null;
  contactPhone: string | null;
  className?: string;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-space-3xs">
      <EyebrowLabel>{label}</EyebrowLabel>
      <p className="type-body text-ink">{value}</p>
    </div>
  );
}

export function EventCard({
  name,
  city,
  date,
  venue,
  time,
  address,
  mapUrl,
  contactPhone,
  className,
}: EventCardProps) {
  return (
    <article
      className={`relative z-(--z-elevated) flex flex-col gap-space-md rounded-lg bg-surface-elevated p-space-md shadow-sheet ${className ?? ""}`}
    >
      <div className="flex flex-col gap-space-2xs">
        <h3 className="type-heading-lg text-ink">
          {name}, {city}
        </h3>
        <p className="type-date-primary text-ink">{date}</p>
      </div>

      <Divider />

      <div className="flex flex-col gap-space-sm">
        {venue === null ? null : <Field label="Venue" value={venue} />}
        {time === null ? null : <Field label="Time" value={time} />}
        {address === null ? null : <Field label="Address" value={address} />}
      </div>

      {mapUrl === null && contactPhone === null ? null : (
        <div className="flex flex-wrap gap-space-xs">
          {mapUrl === null ? null : (
            <ButtonAction href={mapUrl}>Map</ButtonAction>
          )}
          {contactPhone === null ? null : (
            <ButtonAction href={`tel:${contactPhone}`}>Contact</ButtonAction>
          )}
        </div>
      )}
    </article>
  );
}
