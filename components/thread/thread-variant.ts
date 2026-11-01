/* The thread review panel's candidates, and how a painter asks which one is chosen.

   TEMPORARY: candidates for the thread's new material are judged on a phone through a pushed
   preview of `/thread`, so they ride on the real route behind a review panel rather than on a dev-only
   route the preview would not carry. The panel, this module and the boot script leave before the guest
   release build, whatever the thread's fate.

   A choice is applied ONCE, before anything measures: the thread resolves its tokens once per load
   (`thread-tokens.ts`), so a property changed after hydration would be read by nothing. The boot script
   runs from the page's HTML ahead of `<main>`, and a change in the panel reloads the page. With nothing
   stored, or storage blocked, it sets nothing, and `/thread` is exactly the shipped thread. */

export type VariantOption = {
  readonly id: string;
  readonly label: string;
  /* Custom properties set on `<html>` while this option is chosen. A painter that reads its value in
     code instead asks `readVariant`, so an option may carry none. */
  readonly properties?: Readonly<Record<string, string>>;
  /* A stylesheet added to `<head>` while this option is chosen, for a value that must follow a media
     query, which an inline property cannot. */
  readonly css?: string;
};

export type VariantAxis = {
  readonly id: string;
  readonly label: string;
  readonly options: readonly VariantOption[];
};

/* One axis per decision; the shipped value is the absence of a choice, never an option here, so the
   panel cannot show a stale "shipped" that differs from what ships. */
export const THREAD_VARIANT_AXES: readonly VariantAxis[] = [
  /* Task 3's sway spike: the owner's pick and the faster sway they preferred (2026-11-01); the twist
     (long lay, rounder strands) and the 2.2px width are fixed, not offered. */
  {
    id: "sway",
    label: "Sway (spike)",
    options: [
      { id: "sg-8-p7-e8-g50", label: "Sway + gust · 8px (as picked)" },
      { id: "sg-8-p4-e8-g50", label: "Faster sway (4s)" },
    ],
  },
  /* Task 4's shadow, stronger: the shipped contact shadow (`--bleed-thread`, a tight contact plus a
     soft lift) read as too faint on a laptop and not at all on a phone. Each step darkens both layers
     and drops the lift further; the old red bleed is here only to tell a missing filter on the phone
     apart from a faint one. */
  {
    id: "shadow",
    label: "Shadow under the line",
    options: [
      contactShadow("deeper", "Deeper", [
        [0.75, 1, 55],
        [3, 5, 24],
      ]),
      contactShadow("deep", "Deep", [
        [1, 1.25, 65],
        [4, 6, 30],
      ]),
      contactShadow("deepest", "Deepest", [
        [1, 1.5, 75],
        [5, 8, 36],
      ]),
      {
        id: "red-bleed",
        label: "Old red bleed (to compare on the phone)",
        properties: {
          "--bleed-thread":
            "drop-shadow(0 0 0.875px color-mix(in srgb, var(--color-thread-vermilion) 68%, transparent)) drop-shadow(0 0 3px color-mix(in srgb, var(--color-thread-vermilion) 44%, transparent)) drop-shadow(0 0 8.25px color-mix(in srgb, var(--color-thread-vermilion) 30%, transparent))",
        },
      },
    ],
  },
  /* Task 4's light, as ONE pair (owner, 2026-11-01): the drawing head while a piece draws and the
     re-trace at rest always take the same look, so the two can never be judged apart. `sheen-<L>-<glow>`
     lifts the tip L hundredths of OKLCH lightness over the thread's red, the middle half that, at the
     ink's own width (`thread-tokens.ts`); the glow is the head's halo and the re-trace's glow strokes
     together. The shipped pair (the orange head and re-trace) is the absence of a choice. */
  {
    id: "light",
    label: "Light · drawing head and re-trace together",
    options: [
      {
        id: "sheen-12-half",
        label: "Sheen · lighter red, half glow",
        properties: { "--halo-thread-head": headHalo(50) },
        css: "[data-thread-retrace-glow]{opacity:.5}",
      },
      {
        id: "sheen-20-half",
        label: "Brighter sheen · half glow",
        properties: { "--halo-thread-head": headHalo(50) },
        css: "[data-thread-retrace-glow]{opacity:.5}",
      },
      {
        id: "sheen-12-none",
        label: "Sheen · no glow",
        properties: { "--halo-thread-head": "none" },
        css: "[data-thread-retrace-glow]{display:none}",
      },
    ],
  },
  /* Task 4's draw easing: the curve is chosen in `thread-catch-up.ts`, the duration here. */
  {
    id: "easing",
    label: "Draw catch-up",
    options: [
      {
        id: "out-cubic-0.6",
        label: "Ease-out cubic · 0.6s",
        properties: { "--thread-catchup": "0.6s" },
      },
      {
        id: "in-out-sine-0.7",
        label: "Ease-in-out sine · 0.7s",
        properties: { "--thread-catchup": "0.7s" },
      },
      {
        id: "out-quart-0.9",
        label: "Ease-out quart · 0.9s",
        properties: { "--thread-catchup": "0.9s" },
      },
    ],
  },
  /* Task 4's loop budget for the re-trace (the shipped 4 is the absence of a choice). */
  {
    id: "loops",
    label: "Re-trace loops when still",
    options: [
      { id: "2", label: "2 loops", properties: { "--retrace-loops": "2" } },
      { id: "1", label: "1 loop", properties: { "--retrace-loops": "1" } },
    ],
  },
];

/* The head's shipped halo (3.5 / 12 / 33px at 68 / 44 / 30%, `--halo-thread-head`) at `percent` of
   its strength, as the sheen's glow is drawn at half. */
function headHalo(percent: number): string {
  return (
    [
      [3.5, 68],
      [12, 44],
      [33, 30],
    ] as const
  )
    .map(
      ([blur, alpha]) =>
        `drop-shadow(0 0 ${blur}px color-mix(in srgb, var(--color-thread-vermilion) ${(alpha * percent) / 100}%, transparent))`,
    )
    .join(" ");
}

function shadowLayer(offsetY: number, blur: number, alpha: number): string {
  return `drop-shadow(0 ${offsetY}px ${blur}px color-mix(in srgb, var(--color-shadow-warm) ${alpha}%, transparent))`;
}

function contactShadow(
  id: string,
  label: string,
  layers: readonly (readonly [number, number, number])[],
): VariantOption {
  return {
    id,
    label,
    properties: {
      "--bleed-thread": layers
        .map(([offsetY, blur, alpha]) => shadowLayer(offsetY, blur, alpha))
        .join(" "),
    },
  };
}

export const THREAD_VARIANT_STORAGE_KEY = "thread-review";

export function variantAttribute(axis: string): string {
  return `data-thread-variant-${axis}`;
}

/* The chosen option's id, read off the document the boot script wrote, so what a painter acts on is
   what the page carries rather than what storage says. Undefined means the shipped value. */
export function readVariant(axis: string): string | undefined {
  return (
    document.documentElement.getAttribute(variantAttribute(axis)) ?? undefined
  );
}

/* Self-contained, because it runs from the HTML before any bundle loads. Only a stored id that names a
   known option of a known axis is applied; anything else — a stale axis from an earlier round, a
   malformed value — is ignored, so storage cannot paint something the panel does not offer. */
export function variantBootScript(
  axes: readonly VariantAxis[] = THREAD_VARIANT_AXES,
): string {
  const known = JSON.stringify(axes);
  const key = JSON.stringify(THREAD_VARIANT_STORAGE_KEY);
  return `(function(){try{var axes=${known};var chosen=JSON.parse(localStorage.getItem(${key})||"{}");if(!chosen||typeof chosen!=="object")return;var root=document.documentElement;axes.forEach(function(axis){var id=chosen[axis.id];var option=axis.options.filter(function(o){return o.id===id;})[0];if(!option)return;root.setAttribute("data-thread-variant-"+axis.id,option.id);var props=option.properties||{};Object.keys(props).forEach(function(name){root.style.setProperty(name,props[name]);});if(option.css){var sheet=document.createElement("style");sheet.setAttribute("data-thread-variant-css",axis.id);sheet.textContent=option.css;document.head.appendChild(sheet);}});}catch(e){}})();`;
}
