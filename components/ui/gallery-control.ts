/* The gallery's round control — previous / next, All photos and Close — shared by the client viewer
   and the server-renderable grid panel, so it lives in a plain module rather than either of them.
   48px, past the touch-target floor, on the scrim at 60% so a mark reads wherever it overlaps a
   photograph; the ground darkens on hover, so the mark stays clear even over a pale photograph (a device that can hover) and the press dims it. */
export const CONTROL_CIRCLE =
  "inline-flex size-space-xl shrink-0 items-center justify-center rounded-full bg-scrim/60 text-ink-inverse hover:bg-scrim/85 active:opacity-80 motion-safe:transition-[background-color,opacity] motion-safe:duration-(--duration-fast) motion-safe:ease-settle";
