/* Which layer of a ritual's gallery is open, and what "back" does — pure, so it is tested without a
   browser. Every forward step the guest takes is one browser-history entry, so the phone's back
   button pops exactly one layer: a viewer opened from the grid returns to the grid; a viewer opened
   from the strip, and the grid itself, close to the page. The grid button is NOT a forward step — it
   swaps the layer in place, so it adds no entry. */
export type GalleryState =
  | { layer: "grid" }
  | { layer: "viewer"; index: number; fromGrid: boolean };

export const openGallery = (start: number | null): GalleryState =>
  start === null
    ? { layer: "grid" }
    : { layer: "viewer", index: start, fromGrid: false };

export const tapTile = (index: number): GalleryState => ({
  layer: "viewer",
  index,
  fromGrid: true,
});

export function stepViewer(
  state: GalleryState,
  delta: number,
  count: number,
): GalleryState {
  if (state.layer !== "viewer") return state;
  const index = Math.min(count - 1, Math.max(0, state.index + delta));
  return index === state.index ? state : { ...state, index };
}

export const showGrid = (_state: GalleryState): GalleryState => ({
  layer: "grid",
});

export function back(state: GalleryState): GalleryState | null {
  return state.layer === "viewer" && state.fromGrid ? { layer: "grid" } : null;
}

export const historyDepth = (state: GalleryState): number =>
  state.layer === "viewer" && state.fromGrid ? 2 : 1;
