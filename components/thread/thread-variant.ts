/* The thread review panel's candidates, and how a painter asks which one is chosen.

   TEMPORARY: candidates for the thread's new material are judged on a phone through a pushed
   preview of `/thread`, so they ride on the real route behind a review panel rather than on a dev-only
   route the preview would not carry. The panel, this module and the boot script leave before the guest
   release build, whatever the thread's fate.

   A choice is applied ONCE, before anything measures: the thread resolves its tokens once per load
   (`thread-tokens.ts`), so a property changed after hydration would be read by nothing. The boot script
   runs from the page's HTML ahead of `<main>`, and a change in the panel reloads the page. With nothing
   stored, or storage blocked, it sets nothing, and `/thread` is exactly the shipped thread. */

import type { ThreadFilter } from "./thread-shadows.ts";

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

/* The panel's own filters, rendered beside the shipped ones by `ThreadFilters`. */
function shadowFilter(
  id: string,
  layers: readonly (readonly [number, number, number])[],
): ThreadFilter {
  return {
    id,
    layers: layers.map(([offsetY, blur, percent]) => ({
      offsetY,
      blur,
      colour: "--color-shadow-warm",
      alpha: percent / 100,
    })),
  };
}

const LIGHTER_SHADOW = shadowFilter("thread-contact-shadow-lighter", [
  [0.75, 1, 55],
  [3, 5, 24],
]);
const DEEPEST_SHADOW = shadowFilter("thread-contact-shadow-deepest", [
  [1, 1.5, 75],
  [5, 8, 36],
]);
const RED_BLEED: ThreadFilter = {
  id: "thread-red-bleed",
  layers: [
    {
      offsetY: 0,
      blur: 0.875,
      colour: "--color-thread-vermilion",
      alpha: 0.68,
    },
    { offsetY: 0, blur: 3, colour: "--color-thread-vermilion", alpha: 0.44 },
    { offsetY: 0, blur: 8.25, colour: "--color-thread-vermilion", alpha: 0.3 },
  ],
};
/* The earlier full halo: the shipped halo's radii (3.5 / 12 / 33px) at twice its strength. */
const FULL_HALO: ThreadFilter = {
  id: "thread-head-halo-full",
  layers: [
    { offsetY: 0, blur: 3.5, colour: "--color-thread-vermilion", alpha: 0.68 },
    { offsetY: 0, blur: 12, colour: "--color-thread-vermilion", alpha: 0.44 },
    { offsetY: 0, blur: 33, colour: "--color-thread-vermilion", alpha: 0.3 },
  ],
};

export const VARIANT_FILTERS: readonly ThreadFilter[] = [
  LIGHTER_SHADOW,
  DEEPEST_SHADOW,
  RED_BLEED,
  FULL_HALO,
];

function filterOption(
  id: string,
  label: string,
  property: "--bleed-thread" | "--halo-thread-head",
  filter: ThreadFilter,
): VariantOption {
  return { id, label, properties: { [property]: `url(#${filter.id})` } };
}

/* One axis per decision; the shipped value is the absence of a choice, never an option here, so the
   panel cannot show a stale "shipped" that differs from what ships. */
export const THREAD_VARIANT_AXES: readonly VariantAxis[] = [
  /* The faster sway (4s) ships; the panel offers it off, or the slower 7s one. The twist (long lay,
     rounder strands) and the 2.2px width are fixed, not offered. */
  {
    id: "sway",
    label: "Sway (shipped: 4s)",
    options: [
      { id: "off", label: "No sway" },
      { id: "sg-8-p7-e8-g50", label: "Slower sway (7s)" },
    ],
  },
  /* The deep contact shadow ships (`--bleed-thread`); the panel offers one step lighter, one deeper,
     and the old red bleed, which only tells a missing filter on a phone apart from a faint one. Each
     names its own SVG filter (`thread-filters.tsx`), rendered from `VARIANT_FILTERS` below. */
  {
    id: "shadow",
    label: "Shadow under the line (shipped: deep)",
    options: [
      filterOption("lighter", "Lighter", "--bleed-thread", LIGHTER_SHADOW),
      filterOption("deepest", "Deepest", "--bleed-thread", DEEPEST_SHADOW),
      filterOption(
        "red-bleed",
        "Old red bleed (to compare on the phone)",
        "--bleed-thread",
        RED_BLEED,
      ),
    ],
  },
  /* The light, as ONE pair: the drawing head while a piece draws and the re-trace at rest always take
     the same look, so the two can never be judged apart. The sheen ships (lighter red, half glow);
     `sheen-<L>-<glow>` lifts the tip L hundredths of OKLCH lightness over the thread's red, the middle
     half that, at the ink's own width (`thread-tokens.ts`), and `orange` is the earlier pen-like head. */
  {
    id: "light",
    label: "Light · head and re-trace (shipped: sheen, half glow)",
    options: [
      { id: "sheen-20-half", label: "Brighter sheen · half glow" },
      {
        id: "sheen-12-none",
        label: "Sheen · no glow",
        properties: { "--halo-thread-head": "none" },
        css: "[data-thread-retrace-glow]{display:none}",
      },
      {
        ...filterOption(
          "orange",
          "Orange tip, full glow (the earlier head)",
          "--halo-thread-head",
          FULL_HALO,
        ),
        css: "[data-thread-retrace-glow]{opacity:1}",
      },
    ],
  },
];

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
