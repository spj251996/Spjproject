/* Class strings the client viewer and the server-renderable grid panel share — a plain module, so
   either can import it.

   The gallery's round control — previous / next, All photos and Close — shared by the client viewer
   and the server-renderable grid panel, so it lives in a plain module rather than either of them.
   48px, past the touch-target floor, on the scrim at 60% so a mark reads wherever it overlaps a
   photograph. On hover — and on press, since a phone has no hover — it goes fully dark and grows 10%: a
   darker ground alone was too slight to notice, and lightening it washed the white mark out over a
   pale photograph. */
export const CONTROL_CIRCLE =
  "inline-flex size-space-xl shrink-0 items-center justify-center rounded-full bg-scrim/60 text-ink-inverse hover:bg-scrim hover:scale-110 active:bg-scrim active:scale-110 motion-safe:transition-[background-color,scale] motion-safe:duration-(--duration-fast) motion-safe:ease-settle";

/* The grid's columns follow its photo count, so no column stands empty: masonry balancing only
   guarantees every column a photograph when there are at least as many photographs as columns, and
   four in three columns can leave one bare. A single photograph keeps two columns' width rather
   than filling the screen. Whole literals, so Tailwind sees every class. */
export function gridColumns(count: number) {
  if (count <= 1) {
    return "columns-1 mx-auto w-[calc((100%-var(--spacing-space-2xs))/2)]";
  }
  if (count <= 4) return "columns-2";
  return "columns-2 lg:columns-3";
}
