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
