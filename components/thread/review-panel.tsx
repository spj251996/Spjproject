"use client";

import { useEffect, useState } from "react";
import {
  readVariant,
  THREAD_VARIANT_AXES,
  THREAD_VARIANT_STORAGE_KEY,
} from "./thread-variant.ts";

/* TEMPORARY — the review panel for the thread's candidates on `/thread` (see `thread-variant.ts`). It
   leaves before the guest release build.

   Mounted as a sibling of `<main>`, never around it: a wrapping boundary could form a stacking context,
   and the thread's blend would then composite against it. Fixed to the viewport so it moves nothing
   it is judging. A choice reloads the page, because only the boot script applies one, before the
   thread measures; so what is on screen after a click is what that choice paints at load. */

type Choices = Record<string, string>;

function readStored(): Choices {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(THREAD_VARIANT_STORAGE_KEY) ?? "{}",
    );
    return parsed !== null && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function store(choices: Choices) {
  try {
    if (Object.keys(choices).length === 0) {
      localStorage.removeItem(THREAD_VARIANT_STORAGE_KEY);
    } else {
      localStorage.setItem(THREAD_VARIANT_STORAGE_KEY, JSON.stringify(choices));
    }
  } catch {
    /* Blocked storage: nothing can persist across the reload, so the page stays shipped. */
  }
  window.location.reload();
}

export function ReviewPanel() {
  const [open, setOpen] = useState(false);
  /* What the page carries, read off `<html>` after hydration — not what storage holds, which can name
     an option this round no longer offers. */
  const [live, setLive] = useState<Choices>({});
  useEffect(() => {
    const painted: Choices = {};
    for (const axis of THREAD_VARIANT_AXES) {
      const id = readVariant(axis.id);
      if (id !== undefined) painted[axis.id] = id;
    }
    setLive(painted);
  }, []);

  const choose = (axis: string, id: string | undefined) => {
    const next = { ...readStored() };
    if (id === undefined) delete next[axis];
    else next[axis] = id;
    store(next);
  };

  return (
    <div
      data-thread-review="true"
      className="fixed right-space-sm bottom-space-sm z-(--z-modal) flex flex-col items-end gap-space-2xs font-sans text-ink"
    >
      {open && (
        <div
          id="thread-review-panel"
          className="w-max max-w-[calc(100vw-2*var(--spacing-space-sm))] max-h-[70svh] overflow-y-auto rounded-card bg-surface-elevated p-space-sm shadow-mount"
        >
          <p className="type-caption text-ink-muted">
            Thread review — this page only, removed before release.
          </p>
          {THREAD_VARIANT_AXES.length === 0 && (
            <p className="type-caption mt-space-2xs">
              No candidates yet: this is the shipped thread.
            </p>
          )}
          {THREAD_VARIANT_AXES.map((axis) => (
            <fieldset key={axis.id} className="mt-space-sm">
              <legend className="type-caption font-bold">{axis.label}</legend>
              {[{ id: undefined, label: "Shipped" }, ...axis.options].map(
                (option) => (
                  <label
                    key={option.id ?? "shipped"}
                    className="type-caption flex items-center gap-space-2xs"
                  >
                    <input
                      type="radio"
                      name={`thread-review-${axis.id}`}
                      checked={live[axis.id] === option.id}
                      onChange={() => choose(axis.id, option.id)}
                    />
                    {option.label}
                  </label>
                ),
              )}
            </fieldset>
          ))}
          {Object.keys(live).length > 0 && (
            <button
              type="button"
              className="type-caption mt-space-sm underline"
              onClick={() => store({})}
            >
              Reset everything to shipped
            </button>
          )}
        </div>
      )}
      <button
        type="button"
        aria-expanded={open}
        aria-controls="thread-review-panel"
        aria-label="Thread review panel"
        onClick={() => setOpen((was) => !was)}
        className="size-(--touch-target) rounded-full bg-surface-elevated shadow-mount type-caption font-bold"
      >
        {Object.keys(live).length > 0 ? Object.keys(live).length : "T"}
      </button>
    </div>
  );
}
