export interface LineRect {
  top: number;
  left: number;
  right: number;
}

/* A Range's client rects grouped into visual lines by their top edge. One line can carry several
   rects — a hyphenated word held whole is its own inline box — so lines are counted by position,
   never by rect. Width is ink extent, left-most to right-most on the line. */
export function widestLine(rects: readonly LineRect[]): {
  lines: number;
  width: number;
} {
  const lines: LineRect[] = [];
  for (const rect of rects) {
    if (rect.right - rect.left <= 0) continue;
    const line = lines.find((l) => Math.abs(l.top - rect.top) < 2);
    if (line === undefined) {
      /* Copied field by field: a `DOMRect`'s edges are prototype getters, which a spread drops. */
      lines.push({ top: rect.top, left: rect.left, right: rect.right });
    } else {
      line.left = Math.min(line.left, rect.left);
      line.right = Math.max(line.right, rect.right);
    }
  }
  return {
    lines: lines.length,
    width: lines.reduce((w, l) => Math.max(w, l.right - l.left), 0),
  };
}
