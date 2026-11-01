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

/** The slice of `window.history` the gallery uses, so a test can stand in for it. */
export interface HistoryLike {
  readonly state: unknown;
  back(): void;
  pushState(data: unknown, unused: string): void;
}

/** What a `popstate` means for the open gallery: a layer to show, the close, or nothing. */
export type PopOutcome = GalleryState | "close" | "ignore";

export interface GalleryHistory {
  readonly closing: boolean;
  open(): void;
  openPhoto(): boolean;
  goBack(): void;
  pop(shown: GalleryState): PopOutcome;
}

/* The entry each layer stands on: the gallery's first entry is depth 1, a photograph opened from the
   grid depth 2, and the page's own entry carries no depth. */
const entryDepth = (state: GalleryState) =>
  state.layer === "viewer" && state.fromGrid ? 2 : 1;

const depthOf = (entry: unknown) => {
  const depth = (entry as { gallery?: unknown } | null)?.gallery;
  return typeof depth === "number" ? depth : 0;
};

/* The gallery's side of the history. `history.back()` lands asynchronously, so a double tap on Close
   would otherwise go back twice and take the guest off the invitation: a back on its way is not asked
   for again until its pop arrives. Once the pop that closes the gallery has arrived it is fading out,
   and nothing more is ours — no step, no entry, no pop.

   A pop can only be a Back when it lands BELOW the shown layer's entry. One that lands above it is the
   browser's Forward onto an entry no layer stands on; ignoring it in place would leave the history a
   step ahead, and the close would then strand that entry under the page. So it is stepped straight
   back past, and that step's own pop — landing on the shown layer's entry — changes nothing. */
export function createGalleryHistory(history: HistoryLike): GalleryHistory {
  let opened = false;
  let backPending = false;
  let closing = false;
  return {
    get closing() {
      return closing;
    },
    open() {
      if (opened) return;
      opened = true;
      history.pushState({ gallery: 1 }, "");
    },
    openPhoto() {
      if (closing) return false;
      history.pushState({ gallery: 2 }, "");
      return true;
    },
    goBack() {
      if (backPending || closing) return;
      backPending = true;
      history.back();
    },
    pop(shown) {
      if (closing) return "ignore";
      const landed = depthOf(history.state);
      if (landed > entryDepth(shown)) {
        history.back();
        return "ignore";
      }
      if (landed === entryDepth(shown)) return "ignore";
      backPending = false;
      const next = back(shown);
      if (next === null) {
        closing = true;
        return "close";
      }
      return next;
    },
  };
}
