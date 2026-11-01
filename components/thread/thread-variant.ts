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
  /* Task 3's twist: the long lay the owner liked best (2026-10-30), as measured off the reference
     and one change from it per option (`ROPES`). Ticks on mechanism (b) are still parsed, not offered. */
  {
    id: "twist",
    label: "Twist · long lay (spike)",
    options: [
      { id: "long-ref", label: "Long lay · as the reference" },
      { id: "long-tight", label: "Tighter lay (more strands, steeper)" },
      { id: "long-loose", label: "Looser lay (fewer strands, flatter)" },
      { id: "long-gaps", label: "Wider gaps" },
      { id: "long-soft", label: "Softer gaps (less light)" },
      { id: "long-bright", label: "Brighter gaps" },
      { id: "long-round", label: "Rounder strands (more bow)" },
    ],
  },
  /* The owner picked 2.2px from laptop up (2026-10-30); the phone candidates scale it toward the same
     ratio (1.6 -> 2.2 is x1.375). A stylesheet, not an inline property, so each width follows the
     window across the 64rem line. */
  {
    id: "width",
    label: "Line width (laptop up: 2.2px, picked)",
    options: [
      {
        id: "2.2",
        label: "Phone 1.6px (as shipped)",
        css: "@media (width >= 64rem){:root{--stroke-thread:2.2px}}",
      },
      {
        id: "2.2-p1.8",
        label: "Phone 1.8px",
        css: ":root{--stroke-thread:1.8px}@media (width >= 64rem){:root{--stroke-thread:2.2px}}",
      },
      {
        id: "2.2-p2.0",
        label: "Phone 2.0px",
        css: ":root{--stroke-thread:2px}@media (width >= 64rem){:root{--stroke-thread:2.2px}}",
      },
      {
        id: "2.2-p2.2",
        label: "Phone 2.2px (same ratio as laptop)",
        css: ":root{--stroke-thread:2.2px}",
      },
    ],
  },
  /* Task 3's sway spike: the owner's pick, sway + gust at 8px, and one change from it per option
     (`parseSway`). */
  {
    id: "sway",
    label: "Sway (spike)",
    options: [
      { id: "sg-8-p7-e8-g50", label: "Sway + gust · 8px (as picked)" },
      { id: "sg-8-p11-e8-g50", label: "Slower sway (11s)" },
      { id: "sg-8-p4-e8-g50", label: "Faster sway (4s)" },
      { id: "sg-8-p7-e5-g50", label: "Gusts more often (every 5s)" },
      { id: "sg-8-p7-e13-g50", label: "Gusts rarer (every 13s)" },
      { id: "sg-8-p7-e8-g70", label: "More gust, less sway" },
      { id: "sg-8-p7-e8-g30", label: "More sway, less gust" },
      { id: "sg-10-p7-e8-g50", label: "Bigger · 10px" },
      { id: "sg-12-p7-e8-g50", label: "Bigger · 12px" },
    ],
  },
  /* Task 4's shadow: the bleed's filter re-valued as a contact shadow in the warm shadow ink, so the
     thread reads as laid on the paper rather than soaked into it. One-layer contact shadows, then
     two-layer "elevated" ones (a tight contact plus a softer ambient further off), then the smallest
     contact shadow under the current bleed's first layer. */
  {
    id: "shadow",
    label: "Shadow under the line",
    options: [
      contactShadow("contact-s", "Contact · small", [[0.5, 0.75, 45]]),
      contactShadow("contact-m", "Contact · medium", [[0.75, 1.25, 35]]),
      contactShadow("contact-l", "Contact · large", [[1, 2, 28]]),
      contactShadow("lift-s", "Lifted · slightly", [
        [0.5, 0.75, 40],
        [2, 3, 18],
      ]),
      contactShadow("lift-m", "Lifted · more", [
        [0.5, 0.75, 40],
        [3, 5, 14],
      ]),
      contactShadow("lift-l", "Lifted · most", [
        [0.5, 0.75, 40],
        [4, 7, 12],
      ]),
      {
        id: "blend",
        label: "Small contact + the bleed's tightest layer",
        properties: {
          "--bleed-thread": `${shadowLayer(0.5, 0.75, 45)} drop-shadow(0 0 0.875px color-mix(in srgb, var(--color-thread-vermilion) 68%, transparent))`,
        },
      },
    ],
  },
  /* Task 4's live end: the drawing head as shipped, or none, so the line's own round cap is its end. */
  {
    id: "end",
    label: "Live end of the line",
    options: [
      {
        id: "none",
        label: "No head (the ink's own round end)",
        css: "[data-thread-head]{display:none}",
      },
    ],
  },
  /* Task 4's at-rest re-trace as a silk sheen: a lighter tip of the thread's own red rather than the
     head's hot core, then one change from that base per option (`sheenFor` in `thread-tokens.ts`). */
  {
    id: "rest",
    label: "At rest (re-trace)",
    options: [
      {
        id: "sheen-12-half-89",
        label: "Sheen · tip lighter red, half glow",
        css: "[data-thread-retrace-glow]{opacity:.5}",
      },
      {
        id: "sheen-20-half-89",
        label: "Brighter sheen",
        css: "[data-thread-retrace-glow]{opacity:.5}",
      },
      {
        id: "sheen-12-none-89",
        label: "Sheen with no glow",
        css: "[data-thread-retrace-glow]{display:none}",
      },
      {
        id: "sheen-12-half-40",
        label: "Shorter sheen",
        css: "[data-thread-retrace-glow]{opacity:.5}",
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
