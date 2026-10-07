/* ONE ROW HEIGHT FOR THE WHOLE SECTION, and that is the point of this module.

   Celebrations' height is a stated constant plus a constant per ritual that gains photographs —
   the number of photographs INSIDE a ritual costs nothing, because a row shows two or three and
   counts the rest. Two rules deliver that, and each was found by the property failing without it:
   the aspect cap below, and solving the height across every ritual rather than per ritual. Solved
   per ritual the increment varied (measured 171, 161, 145, 159, 159px at 360px wide), because a
   ritual gaining photographs could change which ritual binds the shared height.

   Pure: no DOM, no React, no fetching. Where the aspects come from is `use-aspects`' business. */

export const PHOTO_GAP = 8;

/* THE SIZING CAP. A frame wider than this is laid out AS IF it were this wide and cropped to fit
   by `object-fit: cover`. Without it a single panorama decides the row height for the whole
   section — the height is shared, so one 2.64 frame shortens every other ritual's row and moves
   the section's total height retroactively, long after the layout was signed off. Nothing caps the
   NARROW end: a tall frame only makes its own tile narrower, which can never force the row down. */
export const DEFAULT_ASPECT_CAP = 3 / 2;

const MIN_ROW_HEIGHT = 64;
const PREVIEW_CAP = 3;

/** The aspect the LAYOUT uses, which is not always the file's own. */
export function cappedAspect(
  src: string,
  aspects: Record<string, number>,
  cap: number,
): number {
  return Math.min(aspects[src] ?? 1, cap);
}

function widthAt(
  photos: string[],
  count: number,
  height: number,
  aspects: Record<string, number>,
  cap: number,
): number {
  return (
    photos
      .slice(0, count)
      .reduce(
        (total, src) => total + cappedAspect(src, aspects, cap) * height,
        0,
      ) +
    PHOTO_GAP * Math.max(0, count - 1)
  );
}

export interface PhotoFit {
  /** The single height every preview row in the section uses. */
  rowHeight: number;
  /** How many frames each ritual shows, keyed by ritual id. */
  shown: Record<string, number>;
  /** False until every aspect is known; callers should not measure a section mid-load. */
  ready: boolean;
}

/** `sets` is each ritual's photographs, in order, keyed by its id. */
export function photoFit(
  sets: Record<string, string[]>,
  nominalHeight: number,
  available: number,
  aspects: Record<string, number>,
  cap: number = DEFAULT_ASPECT_CAP,
): PhotoFit {
  const entries = Object.entries(sets).filter(
    ([, photos]) => photos.length > 0,
  );
  const previews = entries.flatMap(([, photos]) =>
    photos.slice(0, PREVIEW_CAP),
  );

  /* `available` is 0 on the first render, before any layout pass, and an aspect is undefined until
     its file has decoded. Either way the nominal height is returned unsolved rather than divided
     into: a loop bounded by a measured value is unbounded before the first measurement. */
  const ready =
    available > 0 && previews.every((src) => aspects[src] !== undefined);

  if (!ready || entries.length === 0) {
    return {
      rowHeight: nominalHeight,
      shown: Object.fromEntries(
        entries.map(([id, photos]) => [id, Math.min(2, photos.length)]),
      ),
      ready: false,
    };
  }

  /* The height every ritual can show at least two frames at — the binding one decides for all. A
     ritual with two 16:9 frames binds harder than one with two portraits, and that is exactly the
     variation that must NOT reach the section's height. */
  let rowHeight = nominalHeight;
  for (const [, photos] of entries) {
    const count = Math.min(2, photos.length);
    if (widthAt(photos, count, rowHeight, aspects, cap) <= available) {
      continue;
    }
    const aspectSum = photos
      .slice(0, count)
      .reduce((total, src) => total + cappedAspect(src, aspects, cap), 0);
    const room = available - PHOTO_GAP * Math.max(0, count - 1);
    rowHeight = Math.max(
      MIN_ROW_HEIGHT,
      Math.min(rowHeight, Math.floor(room / Math.max(aspectSum, 0.01))),
    );
  }

  /* Count is decided per ritual AFTER the height is fixed, because it costs no height. */
  const shown = Object.fromEntries(
    entries.map(([id, photos]) => [
      id,
      photos.length >= PREVIEW_CAP &&
      widthAt(photos, PREVIEW_CAP, rowHeight, aspects, cap) <= available
        ? PREVIEW_CAP
        : Math.min(2, photos.length),
    ]),
  );

  return { rowHeight, shown, ready: true };
}
