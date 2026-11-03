"use client";

import { useEffect, useState } from "react";

/* THROWAWAY SPIKE (owner, 2026-11-03): with the re-trace retiring, which cue says "keep scrolling" at the
   resting tip? Picked on the phone, then this file and its two reads in `PageThread` go. Lab route only. */

export type CueSpike = "trace" | "tip" | "pulse" | "none";

const KEY = "thread-cue-spike";
const CUES: readonly { value: CueSpike; label: string }[] = [
  { value: "trace", label: "Re-trace (now)" },
  { value: "tip", label: "Short re-trace at tip" },
  { value: "pulse", label: "Tip pulse" },
  { value: "none", label: "Nothing" },
];

/* The short re-trace's stretch behind the tip, and its loop. */
export const TIP_SPAN = 320;
export const TIP_LOOP_MS = 2400;

export function cueSpike(): CueSpike {
  try {
    const stored = window.localStorage.getItem(KEY);
    if (CUES.some((cue) => cue.value === stored)) return stored as CueSpike;
  } catch {}
  /* Unchanged until a cue is picked, so the thread's own tests still see the re-trace. */
  return "trace";
}

/* The pulse breathes the drawing head's own light: the head's group fades toward the ink beneath it and
   back. Never under reduced motion, where the loop that sets it never runs either. */
const PULSE_CSS = `
@media (prefers-reduced-motion: no-preference) {
  [data-thread-head][data-cue-pulse] { animation: cue-spike-pulse 2.4s ease-in-out infinite; }
}
@keyframes cue-spike-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.2; } }
`;

export function CueSpikeSwitch() {
  const [chosen, setChosen] = useState<CueSpike | null>(null);
  useEffect(() => setChosen(cueSpike()), []);
  const choose = (value: CueSpike) => {
    try {
      window.localStorage.setItem(KEY, value);
    } catch {}
    /* Back to the top, so each cue is seen from the opening's resting tip. */
    window.history.scrollRestoration = "manual";
    window.scrollTo(0, 0);
    window.location.reload();
  };
  return (
    <div
      style={{
        position: "fixed",
        left: 12,
        top: 12,
        display: "flex",
        flexDirection: "column",
        gap: 4,
        padding: 8,
        borderRadius: 8,
        boxShadow: "0 2px 10px rgb(0 0 0 / 0.2)",
        zIndex: "var(--z-modal)",
        background: "var(--color-surface-elevated)",
      }}
    >
      <style>{PULSE_CSS}</style>
      {CUES.map((cue) => (
        <button
          className="type-caption text-left text-ink"
          key={cue.value}
          onClick={() => choose(cue.value)}
          style={{
            padding: "6px 10px",
            outline:
              chosen === cue.value
                ? "2px solid var(--color-thread-red)"
                : undefined,
          }}
          type="button"
        >
          {cue.label}
        </button>
      ))}
    </div>
  );
}
