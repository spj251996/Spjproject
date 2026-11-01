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
     and the old red bleed, which only tells a missing filter on a phone apart from a faint one. */
  {
    id: "shadow",
    label: "Shadow under the line (shipped: deep)",
    options: [
      contactShadow("lighter", "Lighter", [
        [0.75, 1, 55],
        [3, 5, 24],
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
        id: "orange",
        label: "Orange tip, full glow (the earlier head)",
        properties: { "--halo-thread-head": headHalo(200) },
        css: "[data-thread-retrace-glow]{opacity:1}",
      },
    ],
  },
];

/* The head's halo (3.5 / 12 / 33px at 34 / 22 / 15%, `--halo-thread-head`) at `percent` of its shipped
   strength; 200 is the earlier full halo. */
function headHalo(percent: number): string {
  return (
    [
      [3.5, 34],
      [12, 22],
      [33, 15],
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
