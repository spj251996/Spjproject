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
};

export type VariantAxis = {
  readonly id: string;
  readonly label: string;
  readonly options: readonly VariantOption[];
};

/* One axis per decision; the shipped value is the absence of a choice, never an option here, so the
   panel cannot show a stale "shipped" that differs from what ships. */
export const THREAD_VARIANT_AXES: readonly VariantAxis[] = [];

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
  return `(function(){try{var axes=${known};var chosen=JSON.parse(localStorage.getItem(${key})||"{}");if(!chosen||typeof chosen!=="object")return;var root=document.documentElement;axes.forEach(function(axis){var id=chosen[axis.id];var option=axis.options.filter(function(o){return o.id===id;})[0];if(!option)return;root.setAttribute("data-thread-variant-"+axis.id,option.id);var props=option.properties||{};Object.keys(props).forEach(function(name){root.style.setProperty(name,props[name]);});});}catch(e){}})();`;
}
