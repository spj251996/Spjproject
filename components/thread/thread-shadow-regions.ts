import { THREAD_FILTERS, type ThreadFilter } from "./thread-shadows.ts";

/* EVERY FILTERED ELEMENT GETS ITS OWN COPY OF ITS FILTER, ITS REGION FITTED TO ITS OWN BOX (DESIGN.md ->
   Thread -> The contact shadow). Neither shared region works in WebKit, which every iPhone browser is:
   - one spanning the svg's user space is page-length, and WebKit renders a filter region past its size
     cap at reduced resolution, so the ink itself came out soft; it also missed the card thread, whose
     viewBox starts at the Wishes card's offset, so that thread lost its shadow in every engine;
   - a bounding-box region is crisp, but a near-flat piece's box has almost no height, and it clipped
     the shadow on Wishes' card thread (2-3k px).
   A region in the element's own user space, its box grown by the shadow's reach, is small, crisp and
   holds every pixel. The shared filter (`ThreadFilters`) keeps the bounding-box region for the moments
   before the page is measured and for the gallery's static specimens. */

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export type ShadowProperty = "--bleed-thread" | "--halo-thread-head";

/* The filter id a token names, or nothing for `none` or any other value. */
export function recipeIdOf(value: string): string | undefined {
  return value.match(/url\(\s*["']?#([\w-]+)["']?\s*\)/)?.[1];
}

/* How far a filter's output reaches past its source: the furthest layer's offset plus three of its
   standard deviations, beyond which a Gaussian keeps about 1% of its peak, under one step of 8-bit
   colour at these alphas. */
export function reachOf(filter: ThreadFilter): number {
  return Math.max(
    ...filter.layers.map((layer) => Math.abs(layer.offsetY) + 3 * layer.blur),
  );
}

export function fittedRegion(box: Box, margin: number): Box {
  return {
    x: box.x - margin,
    y: box.y - margin,
    width: box.width + 2 * margin,
    height: box.height + 2 * margin,
  };
}

/* The element a piece's shadow sits on: the piece's own path, or the group round a path that carries a
   taper's cut (`ThreadInk`), so the ink is cut before the filter runs. */
export function filteredElementOf(path: SVGPathElement): SVGGraphicsElement {
  return path.parentElement instanceof SVGGElement ? path.parentElement : path;
}

let fittedCount = 0;

/* One fitter per `<svg>` and token. `defs` holds the copies; `sway` is the most the sway moves a
   point, since a piece's box is read from its unswayed `d`. A token naming no known filter (`none`)
   fits nothing, and the element keeps what its class gives it. */
export function createShadowFitter(
  defs: SVGDefsElement,
  property: ShadowProperty,
  sway: number,
) {
  const recipeId = recipeIdOf(
    getComputedStyle(document.documentElement).getPropertyValue(property),
  );
  const recipe = THREAD_FILTERS.find((filter) => filter.id === recipeId);
  const source =
    recipeId === undefined ? null : document.getElementById(recipeId);
  const copies = new Map<SVGGraphicsElement, SVGFilterElement>();
  const margin = recipe === undefined ? 0 : reachOf(recipe) + sway;

  return {
    /* `box` defaults to the element's own geometry; pass one for an element that is hidden when it is
       fitted (a hidden element's box reads empty). */
    fit(element: SVGGraphicsElement, box: Box = element.getBBox()) {
      if (recipe === undefined || !(source instanceof SVGFilterElement)) return;
      if (box.width === 0 && box.height === 0) return;
      let copy = copies.get(element);
      if (copy === undefined) {
        copy = source.cloneNode(true) as SVGFilterElement;
        fittedCount += 1;
        copy.id = `${source.id}-fit-${fittedCount}`;
        copy.setAttribute("filterUnits", "userSpaceOnUse");
        defs.append(copy);
        copies.set(element, copy);
        element.style.filter = `url(#${copy.id})`;
      }
      const region = fittedRegion(box, margin);
      copy.setAttribute("x", region.x.toFixed(1));
      copy.setAttribute("y", region.y.toFixed(1));
      copy.setAttribute("width", region.width.toFixed(1));
      copy.setAttribute("height", region.height.toFixed(1));
    },
  };
}

export type ShadowFitter = ReturnType<typeof createShadowFitter>;

/* One `<svg>`'s shadows: the contact shadow on each piece and on the tapered end, fitted when the page
   is measured, and the head's halo, fitted on every paint because the head moves. */
export function createThreadShadows(defs: SVGDefsElement, sway: number) {
  const bleed = createShadowFitter(defs, "--bleed-thread", sway);
  const halo = createShadowFitter(defs, "--halo-thread-head", sway);
  return {
    /* `taper` is the tapered end's group and the piece it lies on: the group is hidden when this runs,
       so it takes that piece's box, which holds every run. */
    measured(
      paths: readonly (SVGPathElement | null)[],
      taper: { group: SVGGElement; piece: SVGPathElement } | undefined,
    ) {
      for (const path of paths)
        if (path !== null) bleed.fit(filteredElementOf(path));
      if (taper !== undefined) bleed.fit(taper.group, taper.piece.getBBox());
    },
    headPainted(group: SVGGElement) {
      if (group.style.display !== "none") halo.fit(group);
    },
  };
}

export type ThreadShadows = ReturnType<typeof createThreadShadows>;
