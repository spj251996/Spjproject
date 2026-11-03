"use client";

import { useEffect, useState } from "react";
import { HEAD_HALO } from "./thread-shadows";

/* THROWAWAY SPIKE (owner, 2026-11-03): the re-trace retires with no scroll cue in its place, and the drawing
   head's halo grows from half strength instead. The owner picks the strength on the phone; then this file and
   its read in `PageThread` go. Lab route only. */

const KEY = "thread-glow-spike";
const GLOWS = [
  { value: "1", label: "Half glow (now)" },
  { value: "1.5", label: "Three-quarter glow" },
  { value: "2", label: "Full glow" },
] as const;

function stored(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/* Off once a glow is picked, so the head is judged as it will be seen: alone. Never picked — the tests, and
   anyone who has not touched the switch — the page is unchanged. */
export function retraceOff(): boolean {
  return GLOWS.some((glow) => glow.value === stored());
}

/* Every copy of the halo's filter, the source and each element's fitted copy alike, at the picked multiple
   of today's alphas. A copy fitted later is cloned from the source, so it carries the change. */
function applyGlow(scale: number) {
  for (const filter of document.querySelectorAll<SVGFilterElement>(
    'filter[id^="thread-head-halo"]',
  )) {
    filter.querySelectorAll("feDropShadow").forEach((shadow, index) => {
      const layer = HEAD_HALO.layers[index];
      if (layer !== undefined)
        shadow.style.floodOpacity = String(Math.min(1, layer.alpha * scale));
    });
  }
}

export function GlowSpikeSwitch() {
  const [chosen, setChosen] = useState<string | null>(null);
  useEffect(() => {
    const picked = stored();
    setChosen(picked);
    const scale = Number(picked ?? "1");
    applyGlow(scale);
    /* The fitted copies are made after the thread measures; catch any made before the source changed. */
    const observer = new MutationObserver(() => applyGlow(scale));
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  const choose = (value: string) => {
    try {
      window.localStorage.setItem(KEY, value);
    } catch {}
    /* Back to the top, so each strength is seen from the opening's resting tip. */
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
      {GLOWS.map((glow) => (
        <button
          className="type-caption text-left text-ink"
          key={glow.value}
          onClick={() => choose(glow.value)}
          style={{
            padding: "6px 10px",
            outline:
              chosen === glow.value
                ? "2px solid var(--color-thread-red)"
                : undefined,
          }}
          type="button"
        >
          {glow.label}
        </button>
      ))}
    </div>
  );
}
